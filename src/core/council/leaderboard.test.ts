import { describe, expect, it } from 'bun:test';
import { buildLeaderboard, type ReviewedEvent } from './leaderboard';
import type { FlaggedEvent } from '../model';
import type { Verdict } from './verdict';

function reviewedEvent(id: string, day: number, groundTruthFraud: boolean, decision: Verdict['decision']): ReviewedEvent {
  const event: FlaggedEvent = { id, day, kind: groundTruthFraud ? 'fraud' : 'anomaly', severity: 'medium', carrierIds: ['CAR-0001'], laneId: 'LN-001', groundTruthFraud, causalTrace: ['x'] };
  const verdict: Verdict = { eventId: id, decision, confidence: 0.7, reasoning: 'because' };
  return { event, verdict };
}

describe('buildLeaderboard', () => {
  it('returns an empty array for no reviewed events', () => {
    expect(buildLeaderboard([])).toEqual([]);
  });

  it('folds a two-day fixture into the exact expected cumulative win rate', () => {
    const reviewed: ReviewedEvent[] = [
      reviewedEvent('INC-1-1', 1, true, 'fraud'), // catch
      reviewedEvent('INC-1-2', 1, false, 'fraud'), // false_positive
      reviewedEvent('INC-2-1', 2, true, 'fraud'), // catch
      reviewedEvent('INC-2-2', 2, false, 'clear'), // correct_clear
    ];
    const points = buildLeaderboard(reviewed);
    expect(points).toEqual([
      { day: 1, catches: 1, misses: 0, falsePositives: 1, correctClears: 0, totalReviewed: 2, cumulativeWins: 1, winRatePct: 50 },
      { day: 2, catches: 1, misses: 0, falsePositives: 0, correctClears: 1, totalReviewed: 4, cumulativeWins: 3, winRatePct: 75 },
    ]);
  });

  it('sorts by day even when the input arrives out of order', () => {
    const reviewed: ReviewedEvent[] = [reviewedEvent('INC-3-1', 3, true, 'fraud'), reviewedEvent('INC-1-1', 1, true, 'fraud')];
    const points = buildLeaderboard(reviewed);
    expect(points.map((p) => p.day)).toEqual([1, 3]);
  });

  it('rises when the AI catches real fraud and falls when it misses or false-positives', () => {
    const goodRun = buildLeaderboard([reviewedEvent('A', 1, true, 'fraud'), reviewedEvent('B', 2, true, 'fraud'), reviewedEvent('C', 3, true, 'fraud')]);
    const badRun = buildLeaderboard([reviewedEvent('A', 1, true, 'clear'), reviewedEvent('B', 2, false, 'fraud'), reviewedEvent('C', 3, true, 'clear')]);
    expect(goodRun.at(-1)?.winRatePct).toBe(100);
    expect(badRun.at(-1)?.winRatePct).toBe(0);
  });
});
