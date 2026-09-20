/**
 * Domain types for the synthetic freight-carrier economy. Every entity here is fictional: carrier
 * names, SCAC-style codes and relationship data are generated, not scraped or inferred from any real
 * company. Lane geography reuses real logistics hub city names for plausibility, since a lane is a
 * place, not a claim about a person or a business.
 */
import type { FraudCategory, Severity } from './taxonomy';

export type CarrierStatus = 'active' | 'exited';

export interface CarrierAgent {
  id: string;
  name: string;
  scac: string;
  status: CarrierStatus;
  /** 0 (fully corrupt) to 100 (fully trustworthy). Drifts every tick, see `tick.ts`. */
  legitimacyScore: number;
  /** Baseline change to `legitimacyScore` per day, fixed at genesis. Negative drifts toward corrupt. */
  driftRate: number;
  laneIds: string[];
  createdOnDay: number;
  exitedOnDay?: number;
}

export interface Lane {
  id: string;
  origin: string;
  destination: string;
  region: 'EU' | 'NA';
  /** 0-1 multiplier on how lane-inherent risk (border crossings, unsecured stops) scales incident odds. */
  riskBaseline: number;
}

export type RelationshipKind = 'shared_address' | 'shared_phone' | 'shared_driver' | 'shared_bank_account' | 'ownership_link';

export interface RelationshipEdge {
  id: string;
  carrierAId: string;
  carrierBId: string;
  kind: RelationshipKind;
  /** 0-1, how strong the overlap is. Higher strength makes a ring pattern more likely to fire on it. */
  strength: number;
  formedOnDay: number;
}

export type FlaggedEventKind = 'fraud' | 'anomaly';

export interface FlaggedEvent {
  id: string;
  day: number;
  kind: FlaggedEventKind;
  /** Only set for `kind: 'fraud'`, citing a real pattern id from `freight-fraud-taxonomy`. */
  patternId?: string;
  category?: FraudCategory;
  severity: Severity;
  carrierIds: string[];
  laneId: string;
  /**
   * The sim's own ground truth: was this actually fraud. Never shown to the AI council before it
   * gives a verdict, only used afterward to score the verdict. Kept honest by construction: an
   * `anomaly` event is always `false`, a `fraud` event is always `true`.
   */
  groundTruthFraud: boolean;
  /** Ordered, human-readable trail of what changed and why this event fired. The replay record. */
  causalTrace: string[];
}

export interface SimConfig {
  seed: string;
  carrierCount: number;
  laneCount: number;
  /** Legitimacy score below which a carrier is considered drifted corrupt and eligible to offend. */
  corruptionThreshold: number;
  /** Extra downward drift per day once already below the threshold. Models a corruption spiral. */
  spiralFactor: number;
  /** Half-width of the random daily noise added to drift, uniform in [-driftNoise, driftNoise]. */
  driftNoise: number;
  /** Per-day, per-eligible-carrier probability of a fraud incident firing. */
  incidentBaseRate: number;
  /** Per-day, per-legitimate-carrier probability of a benign anomaly firing (the false-positive fuel). */
  anomalyBaseRate: number;
  /** Per-day, per-eligible-pair probability of a new collusion relationship forming. */
  ringFormationRate: number;
}

export const DEFAULT_CONFIG: SimConfig = {
  seed: 'shadow-network-genesis',
  carrierCount: 120,
  laneCount: 24,
  corruptionThreshold: 35,
  spiralFactor: 0.4,
  driftNoise: 0.6,
  incidentBaseRate: 0.03,
  anomalyBaseRate: 0.004,
  ringFormationRate: 0.015,
};

export interface SimState {
  day: number;
  config: SimConfig;
  carriers: CarrierAgent[];
  lanes: Lane[];
  relationships: RelationshipEdge[];
}
