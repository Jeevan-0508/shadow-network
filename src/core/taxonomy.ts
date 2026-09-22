/**
 * Metadata for the fraud patterns the simulation is allowed to inject, drawn from
 * `freight-fraud-taxonomy` (github.com/Jeevan-0508/freight-fraud-taxonomy). id, name, category,
 * severity and prevalence are what the tick engine needs to pick a pattern and cite it. `signals`
 * is a small, deliberately partial sample (the three highest-weighted indicators per pattern) copied
 * verbatim from that repo, used only to give a fired incident's causal trace one concrete detection
 * signal instead of just a pattern name. The full write-up of each pattern (every indicator, weights,
 * phases, countermeasures) lives in that repo and is linked from case detail views, not duplicated
 * into this one.
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
  /** The three highest-weighted detection signals for this pattern, verbatim from the source taxonomy. */
  signals: readonly string[];
}

export const TAXONOMY_PATTERNS: readonly TaxonomyPattern[] = [
  { id: 'FFT-001', name: 'Double Brokering', category: 'contractual', severity: 'high', prevalence: 'common', signals: ["Tractor unit, trailer plate or driver name at pickup does not match the dispatch confirmation", "An unknown third carrier contacts the shipper directly chasing payment for the same load", "Registered fleet size or reported power units cannot plausibly cover the volume the entity is bidding on"] },
  { id: 'FFT-002', name: 'Phantom Carrier', category: 'identity', severity: 'critical', prevalence: 'common', signals: ["Vehicle presenting at pickup carries no operator livery and plates are not registered to the contracting entity", "All contact stops immediately after loading and the vehicle stops reporting position", "Registered address, on inspection, has no transport operation at it"] },
  { id: 'FFT-003', name: 'Carrier Identity Takeover', category: 'identity', severity: 'critical', prevalence: 'occasional', signals: ["Contact domain is a close variant of the operator's genuine domain, differing by a character, a suffix or a top-level domain", "Bank details supplied do not match the account name of the licensed operator, or are held in a different country from the operator", "Equipment presenting at pickup is not registered to the licence holder"] },
  { id: 'FFT-004', name: 'Fictitious Pickup', category: 'cargo_loss', severity: 'critical', prevalence: 'occasional', signals: ["Driver identity document does not match the name on the dispatch confirmation", "Tractor or trailer plate does not match the dispatch record", "Two vehicles present for the same load reference"] },
  { id: 'FFT-005', name: 'Systematic Pilferage', category: 'cargo_loss', severity: 'medium', prevalence: 'endemic', signals: ["Shortage quantities sit consistently just below the threshold that would trigger a formal investigation", "Shortage rate for a specific route, driver, transfer point or consignee is persistently above the network baseline", "Shortages cluster on high value-density, easily resold items within otherwise mixed consignments"] },
  { id: 'FFT-006', name: 'Unsecured Parking Theft', category: 'cargo_loss', severity: 'high', prevalence: 'endemic', signals: ["Trailer door or curtain sensor triggers during a rest period", "Planned route and schedule force a rest period in a corridor segment with no certified secure parking within range", "High value-density commodity is planned to move in a soft-sided trailer"] },
  { id: 'FFT-007', name: 'Seal Tampering and Reseal Fraud', category: 'documentary', severity: 'medium', prevalence: 'common', signals: ["Seal number recorded at destination does not match the number recorded at origin", "Trailer or container shows evidence of forced physical entry, such as a broken locking mechanism, a pried door or a cut curtain, rather than a defeated or substituted seal", "Seal is intact but the consignment is short"] },
  { id: 'FFT-008', name: 'GPS Spoofing and Telematics Manipulation', category: 'digital', severity: 'high', prevalence: 'occasional', signals: ["Position jumps a distance that could not be covered in the elapsed time", "Reported position is static or repeats identically while engine, odometer or fuel data indicate motion", "Telematics unit found disconnected, powered down, or physically shielded on inspection"] },
  { id: 'FFT-009', name: 'Insider Collusion', category: 'insider', severity: 'critical', prevalence: 'occasional', signals: ["Losses concentrate on consignments whose value was known internally but not externally visible from packaging or documentation", "Losses stop abruptly during an unannounced audit or a staffing change and resume afterwards", "Events cluster on a specific shift, gate, workstation or supervisory approval rather than distributing across the operation"] },
  { id: 'FFT-010', name: 'Transport Document Fraud', category: 'documentary', severity: 'medium', prevalence: 'common', signals: ["Proof of delivery signature cannot be attributed to any person authorised by the consignee to receive goods", "The same document image or reference appears against more than one movement", "Document metadata, sequence number or timestamp is inconsistent with the movement it purports to evidence"] },
  { id: 'FFT-011', name: 'Insurance Certificate Fraud', category: 'financial', severity: 'high', prevalence: 'common', signals: ["Insurer, broker or policy reference cannot be verified, or the insurer is not authorised in the relevant market", "Cover excludes the commodity class, territory, equipment type or theft peril actually being carried", "Insurer declines on the basis of cancellation, non-disclosure or non-payment predating the loss"] },
  { id: 'FFT-012', name: 'Undisclosed Subcontracting Chain', category: 'regulatory', severity: 'high', prevalence: 'common', signals: ["Vehicle or driver at pickup belongs to an entity that does not appear anywhere in the shipper's records", "Claims, penalties or enforcement notices name an entity absent from the shipper's carrier master data", "Sanctions or adverse-media screening produces a hit on a party discovered only after an incident"] },
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
