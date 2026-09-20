/**
 * The daily tick: the one function a scheduled GitHub Action calls to advance the world by one day.
 * Pure and deterministic: `tickDay(state, config)` reads only `state` and a day-scoped RNG derived
 * from `config.seed` and `state.day + 1`, so replaying any day of any run reproduces it exactly.
 *
 * A tick, in order:
 *   1. drifts every active carrier's legitimacy score (with a corruption spiral once below threshold)
 *   2. lets carriers below the threshold form new collusion relationships with lane-mates
 *   3. fires fraud incidents on corrupt carriers, citing a real taxonomy pattern with a causal trace
 *   4. fires occasional benign anomalies on legitimate carriers (the false-positive fuel for slice 4)
 *   5. retires any carrier whose legitimacy has collapsed to zero
 */
import { dayRng, rngChance, rngPick, rngRange, rngWeightedPick, type Rng } from './rng';
import { RING_PATTERNS, TAXONOMY_PATTERNS, type TaxonomyPattern } from './taxonomy';
import type { CarrierAgent, FlaggedEvent, Lane, RelationshipEdge, SimConfig, SimState } from './model';

export interface TickResult {
  state: SimState;
  incidents: FlaggedEvent[];
  changeLog: string[];
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

const PREVALENCE_WEIGHT: Record<TaxonomyPattern['prevalence'], number> = {
  endemic: 4,
  common: 3,
  occasional: 2,
  rare: 1,
};

function driftCarrier(carrier: CarrierAgent, day: number, config: SimConfig, rng: Rng): CarrierAgent {
  if (carrier.status === 'exited') return carrier;

  const spiral = carrier.legitimacyScore < config.corruptionThreshold ? -config.spiralFactor : 0;
  const noise = rngRange(rng, -config.driftNoise, config.driftNoise);
  const nextScore = clamp(carrier.legitimacyScore + carrier.driftRate + spiral + noise, 0, 100);

  if (nextScore <= 0) {
    return { ...carrier, legitimacyScore: 0, status: 'exited', exitedOnDay: day };
  }
  return { ...carrier, legitimacyScore: nextScore };
}

function hasEdge(relationships: readonly RelationshipEdge[], aId: string, bId: string): boolean {
  return relationships.some(
    (edge) => (edge.carrierAId === aId && edge.carrierBId === bId) || (edge.carrierAId === bId && edge.carrierBId === aId),
  );
}

const RELATIONSHIP_KINDS = ['shared_address', 'shared_phone', 'shared_driver', 'shared_bank_account', 'ownership_link'] as const;

function formRelationships(
  carriers: readonly CarrierAgent[],
  lanes: readonly Lane[],
  existing: readonly RelationshipEdge[],
  day: number,
  config: SimConfig,
  rng: Rng,
): { newEdges: RelationshipEdge[]; log: string[] } {
  const newEdges: RelationshipEdge[] = [];
  const log: string[] = [];
  const corrupt = carriers.filter((c) => c.status === 'active' && c.legitimacyScore < config.corruptionThreshold);

  for (const lane of lanes) {
    const candidates = corrupt.filter((c) => c.laneIds.includes(lane.id));
    for (let i = 0; i < candidates.length; i++) {
      for (let j = i + 1; j < candidates.length; j++) {
        const a = candidates[i] as CarrierAgent;
        const b = candidates[j] as CarrierAgent;
        if (hasEdge(existing, a.id, b.id) || newEdges.some((e) => hasEdge([e], a.id, b.id))) continue;
        if (!rngChance(rng, config.ringFormationRate)) continue;

        const kind = rngPick(rng, RELATIONSHIP_KINDS);
        const edge: RelationshipEdge = {
          id: `REL-${day}-${newEdges.length + 1}`,
          carrierAId: a.id,
          carrierBId: b.id,
          kind,
          strength: rngRange(rng, 0.4, 0.95),
          formedOnDay: day,
        };
        newEdges.push(edge);
        log.push(`Day ${day}: collusion edge formed on ${lane.id} (${kind}) between ${a.id} and ${b.id}.`);
      }
    }
  }

  return { newEdges, log };
}

function ringPartner(carrier: CarrierAgent, relationships: readonly RelationshipEdge[]): string | undefined {
  const edge = relationships.find((e) => e.carrierAId === carrier.id || e.carrierBId === carrier.id);
  if (!edge) return undefined;
  return edge.carrierAId === carrier.id ? edge.carrierBId : edge.carrierAId;
}

function pickPattern(rng: Rng, allowRing: boolean): TaxonomyPattern {
  const pool = TAXONOMY_PATTERNS.filter((p) => allowRing || !RING_PATTERNS.has(p.id));
  const weights = pool.map((p) => PREVALENCE_WEIGHT[p.prevalence]);
  return rngWeightedPick(rng, pool, weights);
}

function fireIncidents(
  carriers: readonly CarrierAgent[],
  lanes: readonly Lane[],
  relationships: readonly RelationshipEdge[],
  day: number,
  config: SimConfig,
  rng: Rng,
): { incidents: FlaggedEvent[]; log: string[] } {
  const incidents: FlaggedEvent[] = [];
  const log: string[] = [];
  const laneById = new Map(lanes.map((lane) => [lane.id, lane]));

  for (const carrier of carriers) {
    if (carrier.status !== 'active') continue;
    const corrupt = carrier.legitimacyScore < config.corruptionThreshold;
    const laneId = carrier.laneIds[0];
    if (!laneId) continue;
    const lane = laneById.get(laneId);
    const riskMultiplier = lane ? lane.riskBaseline : 1;

    if (corrupt) {
      if (!rngChance(rng, config.incidentBaseRate * riskMultiplier)) continue;
      const partnerId = ringPartner(carrier, relationships);
      const pattern = pickPattern(rng, partnerId !== undefined);
      const carrierIds = pattern && RING_PATTERNS.has(pattern.id) && partnerId ? [carrier.id, partnerId] : [carrier.id];

      const causalTrace = [
        `Carrier ${carrier.id} legitimacy ${carrier.legitimacyScore.toFixed(1)} is below the corruption threshold ${config.corruptionThreshold}.`,
        `Lane ${laneId} risk baseline ${riskMultiplier.toFixed(2)} scaled the incident odds this tick.`,
      ];
      if (partnerId && carrierIds.length > 1) {
        causalTrace.push(`Existing collusion relationship with ${partnerId} made pattern ${pattern.id} (${pattern.name}) eligible.`);
      }
      causalTrace.push(`Pattern ${pattern.id} (${pattern.name}, category ${pattern.category}) selected and fired.`);

      incidents.push({
        id: `INC-${day}-${incidents.length + 1}`,
        day,
        kind: 'fraud',
        patternId: pattern.id,
        category: pattern.category,
        severity: pattern.severity,
        carrierIds,
        laneId,
        groundTruthFraud: true,
        causalTrace,
      });
      log.push(`Day ${day}: fraud incident ${pattern.id} (${pattern.name}) flagged on ${carrier.id}.`);
    } else {
      if (!rngChance(rng, config.anomalyBaseRate)) continue;
      incidents.push({
        id: `INC-${day}-${incidents.length + 1}`,
        day,
        kind: 'anomaly',
        severity: 'low',
        carrierIds: [carrier.id],
        laneId,
        groundTruthFraud: false,
        causalTrace: [
          `Carrier ${carrier.id} legitimacy ${carrier.legitimacyScore.toFixed(1)} is well above the corruption threshold.`,
          `A one-off operational anomaly on lane ${laneId} tripped a detection rule with no corroborating signal.`,
        ],
      });
      log.push(`Day ${day}: benign anomaly flagged on ${carrier.id} (no underlying fraud).`);
    }
  }

  return { incidents, log };
}

export function tickDay(state: SimState, config: SimConfig): TickResult {
  const day = state.day + 1;
  const rng = dayRng(config.seed, day);

  const driftedCarriers = state.carriers.map((carrier) => driftCarrier(carrier, day, config, rng));
  const { newEdges, log: relationshipLog } = formRelationships(driftedCarriers, state.lanes, state.relationships, day, config, rng);
  const relationships = [...state.relationships, ...newEdges];
  const { incidents, log: incidentLog } = fireIncidents(driftedCarriers, state.lanes, relationships, day, config, rng);

  const exitedThisTick = driftedCarriers.filter((c) => c.exitedOnDay === day);
  const exitLog = exitedThisTick.map((c) => `Day ${day}: carrier ${c.id} collapsed (legitimacy reached zero) and exited the market.`);

  return {
    state: { day, config, carriers: driftedCarriers, lanes: state.lanes, relationships },
    incidents,
    changeLog: [...relationshipLog, ...incidentLog, ...exitLog],
  };
}

export interface SimulationRun {
  state: SimState;
  incidentLog: FlaggedEvent[];
  changeLog: string[];
}

/** Replays a full run from genesis for `days` ticks. The only way any day's state should be produced. */
export function runSimulation(genesis: SimState, days: number): SimulationRun {
  let current = genesis;
  const incidentLog: FlaggedEvent[] = [];
  const changeLog: string[] = [];

  for (let i = 0; i < days; i++) {
    const result = tickDay(current, current.config);
    current = result.state;
    incidentLog.push(...result.incidents);
    changeLog.push(...result.changeLog);
  }

  return { state: current, incidentLog, changeLog };
}
