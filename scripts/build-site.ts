/**
 * Turns `data/latest.json` into `docs/data.js`, a plain `window.SHADOW_DATA = {...}` assignment
 * rather than a `.json` file, so `docs/index.html` can open the dashboard via a `<script>` tag. That
 * works both double-clicked locally (file://, where `fetch()` of a sibling JSON file is blocked by the
 * browser's own CORS rule for the file protocol) and once GitHub Pages serves the folder for real.
 *
 * All the arithmetic here (histogram buckets, averages, the report sentences) is display-only summary
 * of numbers the engine already computed; nothing here feeds back into the sim.
 */
import type { CarrierAgent, FlaggedEvent, Lane, RelationshipEdge, SimConfig } from '../src/core/model';
import { DEFAULT_CONFIG } from '../src/core/model';
import type { LeaderboardPoint, ReviewedEvent } from '../src/core/council/leaderboard';
import { deriveOutcome } from '../src/core/council/outcome';

export interface SimSnapshot {
  day: number;
  generatedAt: string;
  seed: string;
  carriers: CarrierAgent[];
  lanes: Lane[];
  relationships: RelationshipEdge[];
  todaysIncidents: FlaggedEvent[];
  todaysVerdicts: ReviewedEvent[];
  leaderboard: LeaderboardPoint[];
}

export interface SiteData {
  day: number;
  generatedAt: string;
  seed: string;
  stats: {
    totalCarriers: number;
    activeCarriers: number;
    exitedCarriers: number;
    avgLegitimacy: number;
    corruptCount: number;
    corruptionThreshold: number;
    totalLanes: number;
    totalRelationships: number;
    totalReviewed: number;
    cumulativeWinRatePct: number | null;
  };
  legitimacyHistogram: { bucket: string; count: number }[];
  leaderboardTrend: LeaderboardPoint[];
  lanes: (Lane & { carrierCount: number })[];
  incidents: (FlaggedEvent & { groundTruthLabel: 'fraud' | 'benign' })[];
  verdicts: { eventId: string; decision: string; confidence: number; reasoning: string; outcome: string }[];
  reportText: string[];
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function legitimacyHistogram(carriers: CarrierAgent[]): { bucket: string; count: number }[] {
  const buckets = Array.from({ length: 10 }, (_, i) => ({
    bucket: i === 9 ? '90-100' : `${i * 10}-${i * 10 + 9}`,
    count: 0,
  }));
  for (const c of carriers) {
    const idx = Math.min(9, Math.max(0, Math.floor(c.legitimacyScore / 10)));
    buckets[idx].count += 1;
  }
  return buckets;
}

function buildReportText(snapshot: SimSnapshot, stats: SiteData['stats'], config: SimConfig): string[] {
  const lines: string[] = [];
  lines.push(`Day ${snapshot.day} of the simulation (seed "${snapshot.seed}"), generated ${snapshot.generatedAt}.`);
  lines.push(
    `${stats.totalCarriers} carriers (${stats.activeCarriers} active, ${stats.exitedCarriers} exited) across ` +
      `${stats.totalLanes} lanes. Average legitimacy score ${stats.avgLegitimacy}.`,
  );
  lines.push(
    stats.corruptCount > 0
      ? `${stats.corruptCount} carrier(s) have drifted below the corruption threshold (${config.corruptionThreshold}) and are now eligible to offend.`
      : `No carrier has drifted below the corruption threshold (${config.corruptionThreshold}) yet.`,
  );
  if (snapshot.todaysIncidents.length > 0) {
    const fraudCount = snapshot.todaysIncidents.filter((e) => e.kind === 'fraud').length;
    const anomalyCount = snapshot.todaysIncidents.length - fraudCount;
    lines.push(`${snapshot.todaysIncidents.length} new flagged event(s) today: ${fraudCount} fraud pattern(s), ${anomalyCount} benign anomaly/anomalies.`);
  } else {
    lines.push('No flagged events today. Expected in the sim\'s early days, before enough carriers drift corrupt.');
  }
  lines.push(
    stats.totalReviewed > 0
      ? `Across ${stats.totalReviewed} reviewed event(s) since genesis, the AI council's cumulative win rate is ${stats.cumulativeWinRatePct}%.`
      : 'No events have been reviewed yet. The leaderboard will populate once the first incidents fire.',
  );
  lines.push(
    stats.totalRelationships > 0
      ? `${stats.totalRelationships} collusion relationship(s) have formed between carriers.`
      : 'No collusion relationships have formed between carriers yet.',
  );
  return lines;
}

export function buildSiteData(snapshot: SimSnapshot, config: SimConfig = DEFAULT_CONFIG): SiteData {
  const totalCarriers = snapshot.carriers.length;
  const activeCarriers = snapshot.carriers.filter((c) => c.status === 'active').length;
  const avgLegitimacy = totalCarriers > 0 ? round1(snapshot.carriers.reduce((sum, c) => sum + c.legitimacyScore, 0) / totalCarriers) : 0;
  const corruptCount = snapshot.carriers.filter((c) => c.legitimacyScore < config.corruptionThreshold).length;
  const lastPoint = snapshot.leaderboard.at(-1);

  const stats: SiteData['stats'] = {
    totalCarriers,
    activeCarriers,
    exitedCarriers: totalCarriers - activeCarriers,
    avgLegitimacy,
    corruptCount,
    corruptionThreshold: config.corruptionThreshold,
    totalLanes: snapshot.lanes.length,
    totalRelationships: snapshot.relationships.length,
    totalReviewed: lastPoint?.totalReviewed ?? 0,
    cumulativeWinRatePct: lastPoint?.winRatePct ?? null,
  };

  const laneCarrierCounts = new Map<string, number>();
  for (const c of snapshot.carriers) {
    for (const laneId of c.laneIds) laneCarrierCounts.set(laneId, (laneCarrierCounts.get(laneId) ?? 0) + 1);
  }


  return {
    day: snapshot.day,
    generatedAt: snapshot.generatedAt,
    seed: snapshot.seed,
    stats,
    legitimacyHistogram: legitimacyHistogram(snapshot.carriers),
    leaderboardTrend: snapshot.leaderboard,
    lanes: [...snapshot.lanes]
      .sort((a, b) => b.riskBaseline - a.riskBaseline)
      .map((l) => ({ ...l, carrierCount: laneCarrierCounts.get(l.id) ?? 0 })),
    incidents: snapshot.todaysIncidents.map((e) => ({ ...e, groundTruthLabel: e.groundTruthFraud ? 'fraud' : 'benign' })),
    verdicts: snapshot.todaysVerdicts.map(({ event, verdict }) => ({
      eventId: verdict.eventId,
      decision: verdict.decision,
      confidence: verdict.confidence,
      reasoning: verdict.reasoning,
      outcome: deriveOutcome(event, verdict),
    })),
    reportText: buildReportText(snapshot, stats, config),
  };
}

async function main() {
  const raw = await Bun.file('data/latest.json').text();
  const snapshot = JSON.parse(raw) as SimSnapshot;
  const site = buildSiteData(snapshot);
  await Bun.write('docs/data.js', `window.SHADOW_DATA = ${JSON.stringify(site, null, 2)};\n`);
  console.log(`docs/data.js written for day ${site.day} (${site.stats.totalCarriers} carriers, ${site.stats.totalReviewed} reviewed).`);
}

if (import.meta.main) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
