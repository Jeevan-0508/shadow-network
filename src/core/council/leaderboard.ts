/**
 * "AI vs fraud" is a cumulative recompute over the full outcome history, the same architectural
 * choice as `runSimulation`: no mutable running counter to keep in sync, just a pure fold over
 * `(event, verdict)` pairs in day order. Rebuilding it from scratch is what lets a UI trust the number
 * without ever having to ask "was this updated correctly."
 */
import type { FlaggedEvent } from '../model';
import { deriveOutcome, isWin, type Outcome } from './outcome';
import type { Verdict } from './verdict';

export interface ReviewedEvent {
  event: FlaggedEvent;
  verdict: Verdict;
}

export interface LeaderboardPoint {
  day: number;
  catches: number;
  misses: number;
  falsePositives: number;
  correctClears: number;
  /** Cumulative through this day, inclusive. */
  totalReviewed: number;
  cumulativeWins: number;
  winRatePct: number;
}

function emptyCounts(): Pick<LeaderboardPoint, 'catches' | 'misses' | 'falsePositives' | 'correctClears'> {
  return { catches: 0, misses: 0, falsePositives: 0, correctClears: 0 };
}

function tally(counts: ReturnType<typeof emptyCounts>, outcome: Outcome): void {
  if (outcome === 'catch') counts.catches += 1;
  else if (outcome === 'miss') counts.misses += 1;
  else if (outcome === 'false_positive') counts.falsePositives += 1;
  else counts.correctClears += 1;
}

/**
 * One point per day that had at least one reviewed event, in ascending day order. `reviewed` may span
 * any number of days and arrive in any order, since everything here is a pure fold keyed by `event.day`.
 */
export function buildLeaderboard(reviewed: readonly ReviewedEvent[]): LeaderboardPoint[] {
  const byDay = new Map<number, ReviewedEvent[]>();
  for (const item of reviewed) {
    const bucket = byDay.get(item.event.day) ?? [];
    bucket.push(item);
    byDay.set(item.event.day, bucket);
  }

  const days = [...byDay.keys()].sort((a, b) => a - b);
  const points: LeaderboardPoint[] = [];
  let cumulativeWins = 0;
  let totalReviewed = 0;

  for (const day of days) {
    const dayCounts = emptyCounts();
    for (const { event, verdict } of byDay.get(day) as ReviewedEvent[]) {
      const outcome = deriveOutcome(event, verdict);
      tally(dayCounts, outcome);
      if (isWin(outcome)) cumulativeWins += 1;
      totalReviewed += 1;
    }
    points.push({
      day,
      ...dayCounts,
      totalReviewed,
      cumulativeWins,
      winRatePct: totalReviewed > 0 ? Math.round((cumulativeWins / totalReviewed) * 1000) / 10 : 0,
    });
  }

  return points;
}
