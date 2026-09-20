import { describe, expect, it } from 'bun:test';
import { reviewDay } from './review';
import { createGenesisState } from '../genesis';
import { tickDay } from '../tick';
import { DEFAULT_CONFIG, type SimState } from '../model';
import { buildLeaderboard, type ReviewedEvent } from './leaderboard';
import type { Reasoner } from './types';

const CONFIG = { ...DEFAULT_CONFIG, seed: 'review-test-seed', carrierCount: 40, laneCount: 8 };

/**
 * The real operational shape: tick one day, review that day's events against that same day's
 * resulting state immediately, exactly what a daily GitHub Action would do. Reviewing a stale day's
 * events against a much later state would silently feed the reviewer the wrong legitimacy signal.
 */
async function tickAndReviewDays(days: number, reasoner?: Reasoner): Promise<{ finalState: SimState; reviewed: ReviewedEvent[] }> {
  let state = createGenesisState(CONFIG);
  const reviewed: ReviewedEvent[] = [];
  for (let i = 0; i < days; i++) {
    const result = tickDay(state, CONFIG);
    state = result.state;
    if (result.incidents.length > 0) reviewed.push(...(await reviewDay(result.incidents, state, { reasoner })));
  }
  return { finalState: state, reviewed };
}

describe('reviewDay with the default deterministic reasoner', () => {
  it('needs no api key or network and produces exactly one verdict per event', async () => {
    const { reviewed } = await tickAndReviewDays(200);
    expect(reviewed.length).toBeGreaterThan(0);
    for (const { event, verdict } of reviewed) expect(verdict.eventId).toBe(event.id);
  });

  it('never exposes groundTruthFraud, kind, patternId or causalTrace to the reasoner', async () => {
    const seen: string[] = [];
    const spy: Reasoner = {
      id: 'spy',
      uses_network: false,
      async propose(req) {
        seen.push(...req.data_blocks);
        return { value: req.validate(req.fallback()), provider: 'spy', degraded: false, degraded_reason: null, est_tokens: 0, ms: 0 };
      },
    };
    const { reviewed } = await tickAndReviewDays(200, spy);
    expect(reviewed.length).toBeGreaterThan(0);
    const blob = seen.join('\n');
    expect(blob).not.toContain('groundTruthFraud');
    expect(blob).not.toContain('causalTrace');
    expect(blob).not.toContain('"kind"');
    expect(blob).not.toContain('patternId');
  });

  it('feeds a real day-by-day simulated run end to end into a sensible, in-range leaderboard number', async () => {
    const { reviewed } = await tickAndReviewDays(200);
    const points = buildLeaderboard(reviewed);
    expect(points.length).toBeGreaterThan(0);
    const last = points.at(-1) as ReturnType<typeof buildLeaderboard>[number];
    expect(last.totalReviewed).toBe(reviewed.length);
    expect(last.winRatePct).toBeGreaterThanOrEqual(0);
    expect(last.winRatePct).toBeLessThanOrEqual(100);
  });
});
