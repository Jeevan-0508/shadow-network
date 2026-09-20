/**
 * Metadata for the fraud patterns the simulation is allowed to inject, drawn from
 * `freight-fraud-taxonomy` (github.com/Jeevan-0508/freight-fraud-taxonomy). Only id, name, category,
 * severity and prevalence are copied here, since that is all the tick engine needs to pick a pattern
 * and cite it. The full write-up of each pattern (indicators, countermeasures) lives in that repo and
 * is linked from case detail views, not duplicated into this one.
 */

export type FraudCategory =
  | 'cargo_loss'
  | 'contractual'
  | 'digital'
  | 'documentary'
  | 'financial'
  | 'identity'
  | 'insider'
  | 'regulatory';

export type Severity = 'low' | 'medium' | 'high' | 'critical';

export interface TaxonomyPattern {
  id: string;
  name: string;
  category: FraudCategory;
  severity: Severity;
  /** How often the real-world pattern shows up, per the source taxonomy. Used only as flavor here. */
  prevalence: 'endemic' | 'common' | 'occasional' | 'rare';
}

export const TAXONOMY_PATTERNS: readonly TaxonomyPattern[] = [
  { id: 'FFT-001', name: 'Double Brokering', category: 'contractual', severity: 'high', prevalence: 'common' },
  { id: 'FFT-002', name: 'Phantom Carrier', category: 'identity', severity: 'critical', prevalence: 'common' },
  { id: 'FFT-003', name: 'Carrier Identity Takeover', category: 'identity', severity: 'critical', prevalence: 'occasional' },
  { id: 'FFT-004', name: 'Fictitious Pickup', category: 'cargo_loss', severity: 'critical', prevalence: 'occasional' },
  { id: 'FFT-005', name: 'Systematic Pilferage', category: 'cargo_loss', severity: 'medium', prevalence: 'endemic' },
  { id: 'FFT-006', name: 'Unsecured Parking Theft', category: 'cargo_loss', severity: 'high', prevalence: 'endemic' },
  { id: 'FFT-007', name: 'Seal Tampering and Reseal Fraud', category: 'documentary', severity: 'medium', prevalence: 'common' },
  { id: 'FFT-008', name: 'GPS Spoofing and Telematics Manipulation', category: 'digital', severity: 'high', prevalence: 'occasional' },
  { id: 'FFT-009', name: 'Insider Collusion', category: 'insider', severity: 'critical', prevalence: 'occasional' },
  { id: 'FFT-010', name: 'Transport Document Fraud', category: 'documentary', severity: 'medium', prevalence: 'common' },
  { id: 'FFT-011', name: 'Insurance Certificate Fraud', category: 'financial', severity: 'high', prevalence: 'common' },
  { id: 'FFT-012', name: 'Undisclosed Subcontracting Chain', category: 'regulatory', severity: 'high', prevalence: 'common' },
];

/**
 * Patterns that structurally require two or more carriers acting together (collusion rings), versus
 * ones a single corrupt carrier can commit alone. Drives whether the tick engine looks for a
 * relationship edge before it can fire a given pattern.
 */
export const RING_PATTERNS: ReadonlySet<string> = new Set(['FFT-001', 'FFT-003', 'FFT-009', 'FFT-012']);

export function findPattern(id: string): TaxonomyPattern {
  const pattern = TAXONOMY_PATTERNS.find((p) => p.id === id);
  if (!pattern) throw new Error(`Unknown taxonomy pattern: ${id}`);
  return pattern;
}
