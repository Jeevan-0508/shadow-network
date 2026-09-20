/**
 * The reviewer's own rule-based heuristic: what a case gets called when no model is configured, and
 * what a model's answer degrades to on any failure. Deliberately independent of the simulation's own
 * `corruptionThreshold`, since a real investigator does not get to read the generator's source code
 * either. It is allowed to be imperfect: some misses and some false positives are what make the "AI vs
 * fraud" leaderboard number mean anything at all.
 */
import type { CaseBrief } from './case';

export type CouncilDecision = 'fraud' | 'clear';

export interface Verdict {
  eventId: string;
  decision: CouncilDecision;
  /** 0-1, the reviewer's own stated confidence in `decision`. */
  confidence: number;
  reasoning: string;
}

const SEVERITY_WEIGHT: Record<CaseBrief['severity'], number> = { low: 0.1, medium: 0.3, high: 0.55, critical: 0.8 };

/** This is the reviewer's own working threshold, not the sim's ground-truth corruption threshold. */
const RISK_DECISION_THRESHOLD = 0.5;

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

export function ruleBasedVerdict(brief: CaseBrief): Verdict {
  const scores = brief.carriers.map((c) => c.legitimacyScore);
  const avgLegitimacy = scores.length > 0 ? scores.reduce((sum, s) => sum + s, 0) / scores.length : 100;
  const anyRelationship = brief.carriers.some((c) => c.hasKnownRelationship);

  const legitimacyRisk = (100 - avgLegitimacy) / 100;
  const linkRisk = brief.jointlyFlagged || anyRelationship ? 1 : 0;
  const riskScore = clamp01(0.5 * SEVERITY_WEIGHT[brief.severity] + 0.35 * legitimacyRisk + 0.15 * linkRisk);

  const decision: CouncilDecision = riskScore >= RISK_DECISION_THRESHOLD ? 'fraud' : 'clear';
  const confidence = decision === 'fraud' ? riskScore : 1 - riskScore;

  const carrierList = brief.carrierIds.join(', ');
  const reasoning =
    decision === 'fraud'
      ? `${carrierList} shows an average legitimacy signal of ${avgLegitimacy.toFixed(1)} on a ${brief.severity} severity flag` +
        `${linkRisk ? ', with a known relationship-graph link raising concern of coordinated activity' : ''}. Recommending fraud.`
      : `${carrierList} shows an average legitimacy signal of ${avgLegitimacy.toFixed(1)} on a ${brief.severity} severity flag` +
        `${linkRisk ? ', despite a relationship-graph link, not enough to outweigh the signal' : ''}. Recommending clear.`;

  return { eventId: brief.eventId, decision, confidence, reasoning };
}
