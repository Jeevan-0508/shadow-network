/**
 * Redacts a `FlaggedEvent` down to what a real investigator would actually see, before it ever reaches
 * a reasoner. `kind`, `patternId`, `category`, `groundTruthFraud` and `causalTrace` are the sim's own
 * bookkeeping about what it decided to inject and why: showing any of them to the council would let it
 * read the answer instead of reasoning to it. What is left, legitimacy score and relationship-graph
 * membership, are the synthetic analogues of real observable signals (on-time history, complaint rate,
 * link analysis), so exposing them is the honest amount of information a case brief should carry.
 */
import type { Severity } from '../taxonomy';
import type { FlaggedEvent, SimState } from '../model';

export interface CarrierSignal {
  carrierId: string;
  /** Legitimacy score at the moment of the event, rounded to one decimal so it reads like a real KPI. */
  legitimacyScore: number;
  /** Whether this carrier appears anywhere in the relationship graph, not only linked to its co-flagged carrier. */
  hasKnownRelationship: boolean;
}

export interface CaseBrief {
  eventId: string;
  day: number;
  laneId: string;
  severity: Severity;
  carrierIds: string[];
  carriers: CarrierSignal[];
  /** True when the detection layer flagged more than one carrier together, not proof of collusion by itself. */
  jointlyFlagged: boolean;
}

export function buildCaseBrief(event: FlaggedEvent, state: SimState): CaseBrief {
  const relatedIds = new Set(state.relationships.flatMap((edge) => [edge.carrierAId, edge.carrierBId]));
  const carriers: CarrierSignal[] = event.carrierIds.map((carrierId) => {
    const carrier = state.carriers.find((c) => c.id === carrierId);
    return {
      carrierId,
      legitimacyScore: carrier ? Math.round(carrier.legitimacyScore * 10) / 10 : 0,
      hasKnownRelationship: relatedIds.has(carrierId),
    };
  });

  return {
    eventId: event.id,
    day: event.day,
    laneId: event.laneId,
    severity: event.severity,
    carrierIds: [...event.carrierIds],
    carriers,
    jointlyFlagged: event.carrierIds.length > 1,
  };
}

/** Every id a reasoner is allowed to reference when answering about this brief. */
export function allowedIdsFor(brief: CaseBrief): string[] {
  return [brief.eventId, brief.laneId, ...brief.carrierIds];
}
