/**
 * The only place ground truth and a verdict are ever allowed to meet. `deriveOutcome` runs strictly
 * after a verdict exists, purely to score it: nothing upstream of this file may read
 * `event.groundTruthFraud` before producing a verdict, or the "AI vs fraud" number stops meaning
 * anything.
 */
import type { FlaggedEvent } from '../model';
import type { Verdict } from './verdict';

export type Outcome = 'catch' | 'miss' | 'false_positive' | 'correct_clear';

export function deriveOutcome(event: FlaggedEvent, verdict: Verdict): Outcome {
  if (event.groundTruthFraud) {
    return verdict.decision === 'fraud' ? 'catch' : 'miss';
  }
  return verdict.decision === 'fraud' ? 'false_positive' : 'correct_clear';
}

/** An outcome counts as a win for the AI: it called the case correctly, whichever way it went. */
export function isWin(outcome: Outcome): boolean {
  return outcome === 'catch' || outcome === 'correct_clear';
}
