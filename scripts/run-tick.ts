/**
 * The script the scheduled GitHub Action runs once a day. Recomputes the whole simulation from
 * `DEFAULT_CONFIG.seed` up to today's day count (see `daysSinceGenesis`) rather than loading and
 * mutating any persisted state, so there is nothing here that can drift out of sync with the engine:
 * losing `data/latest.json` entirely costs nothing but having to rerun this script once.
 *
 * Cost at this scale (low hundreds of carriers, one run of the whole history per day) is milliseconds,
 * so recomputing from day zero every single day is the deliberately simple choice over maintaining an
 * incremental snapshot format.
 */
import { daysSinceGenesis } from '../src/core/calendar';
import { createGenesisState } from '../src/core/genesis';
import { tickDay } from '../src/core/tick';
import { reviewDay } from '../src/core/council/review';
import { buildLeaderboard, type ReviewedEvent } from '../src/core/council/leaderboard';
import { DEFAULT_CONFIG, type FlaggedEvent, type SimState } from '../src/core/model';

/** The day the sim went live. Fixed forever: changing it would silently replay a different history. */
export const GENESIS_DATE = '2026-09-21';

export interface TickRunResult {
  state: SimState;
  todaysIncidents: FlaggedEvent[];
  todaysVerdicts: ReviewedEvent[];
  leaderboard: ReturnType<typeof buildLeaderboard>;
}

/** Runs the full recompute for `days` days and reviews every day's incidents as they are produced. */
export async function runTick(days: number): Promise<TickRunResult> {
  let state = createGenesisState(DEFAULT_CONFIG);
  const allReviewed: ReviewedEvent[] = [];
  let todaysIncidents: FlaggedEvent[] = [];
  let todaysVerdicts: ReviewedEvent[] = [];

  for (let i = 0; i < days; i++) {
    const result = tickDay(state, DEFAULT_CONFIG);
    state = result.state;
    let dayReviewed: ReviewedEvent[] = [];
    if (result.incidents.length > 0) {
      dayReviewed = await reviewDay(result.incidents, state);
      allReviewed.push(...dayReviewed);
    }
    if (i === days - 1) {
      todaysIncidents = result.incidents;
      todaysVerdicts = dayReviewed;
    }
  }

  return { state, todaysIncidents, todaysVerdicts, leaderboard: buildLeaderboard(allReviewed) };
}

/**
 * Rounds every number in the snapshot to a display precision that keeps day-to-day git diffs small
 * and readable, without touching the full-precision values the engine itself computes with internally.
 */
function roundForDisplay<T>(value: T): T {
  if (typeof value === 'number') return (Math.round(value * 100) / 100) as unknown as T;
  if (Array.isArray(value)) return value.map(roundForDisplay) as unknown as T;
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, roundForDisplay(v)])) as unknown as T;
  }
  return value;
}

async function main() {
  const days = daysSinceGenesis(GENESIS_DATE, new Date());
  const result = await runTick(days);

  const snapshot = roundForDisplay({
    day: result.state.day,
    generatedAt: new Date().toISOString(),
    seed: DEFAULT_CONFIG.seed,
    carriers: result.state.carriers,
    lanes: result.state.lanes,
    relationships: result.state.relationships,
    todaysIncidents: result.todaysIncidents,
    todaysVerdicts: result.todaysVerdicts,
    leaderboard: result.leaderboard,
  });

  await Bun.write('data/latest.json', `${JSON.stringify(snapshot, null, 2)}\n`);

  const latestPoint = result.leaderboard.at(-1);
  console.log(
    `Day ${result.state.day}: ${result.todaysIncidents.length} new flagged event(s), ` +
      `cumulative win rate ${latestPoint ? `${latestPoint.winRatePct}%` : 'n/a (no reviewed events yet)'}.`,
  );
}

if (import.meta.main) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
