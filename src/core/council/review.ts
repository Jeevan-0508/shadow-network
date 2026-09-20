/**
 * Ties a day's flagged events to the reasoning seam: builds a redacted case brief per event, asks the
 * reasoner (deterministic by default, an LLM if the caller supplies one) for a verdict, and returns
 * the reviewed pairs ready for `buildLeaderboard`. The event's own `eventId` is always the brief's,
 * never trusted from a model's echoed output, so a model cannot misattribute its verdict to a
 * different case even by accident.
 */
import type { FlaggedEvent, SimState } from '../model';
import { buildCaseBrief, allowedIdsFor, type CaseBrief } from './case';
import type { Reasoner } from './types';
import { ruleBasedVerdict, type CouncilDecision, type Verdict } from './verdict';
import { createDeterministicReasoner } from './deterministic';
import type { ReviewedEvent } from './leaderboard';

function validateVerdict(brief: CaseBrief) {
  return (raw: unknown): Verdict => {
    const r = raw as Partial<Verdict> | null;
    if (!r || (r.decision !== 'fraud' && r.decision !== 'clear')) throw new Error('verdict missing a valid decision');
    if (typeof r.confidence !== 'number' || r.confidence < 0 || r.confidence > 1) throw new Error('verdict confidence must be a number in [0, 1]');
    if (typeof r.reasoning !== 'string' || r.reasoning.trim().length === 0) throw new Error('verdict must include non-empty reasoning');
    return { eventId: brief.eventId, decision: r.decision as CouncilDecision, confidence: r.confidence, reasoning: r.reasoning };
  };
}

export interface ReviewDayOptions {
  reasoner?: Reasoner;
}

/**
 * Reviews every event in `events` against `state` (the state as of the day those events fired). With
 * no reasoner supplied, uses the zero-cost deterministic one, so this always works with no API key.
 */
export async function reviewDay(events: readonly FlaggedEvent[], state: SimState, options: ReviewDayOptions = {}): Promise<ReviewedEvent[]> {
  const reasoner = options.reasoner ?? createDeterministicReasoner();
  const reviewed: ReviewedEvent[] = [];

  for (const event of events) {
    const brief = buildCaseBrief(event, state);
    const result = await reasoner.propose({
      task: 'review_flagged_event',
      instruction:
        'Decide whether this flagged carrier activity is fraud or should be cleared. Base the decision only on the case brief. ' +
        'Answer as JSON: { "decision": "fraud" | "clear", "confidence": number between 0 and 1, "reasoning": string }.',
      data_blocks: [`CASE BRIEF: ${JSON.stringify(brief)}`],
      allowed_ids: allowedIdsFor(brief),
      schema_hint: '{ decision: "fraud" | "clear", confidence: number, reasoning: string }',
      validate: validateVerdict(brief),
      fallback: () => ruleBasedVerdict(brief),
    });
    reviewed.push({ event, verdict: result.value });
  }

  return reviewed;
}
