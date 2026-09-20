/**
 * The reasoning seam, adapted from risk-swarm's reasoner contract. Every council reasoner must produce
 * a complete, valid verdict with no model at all (the deterministic reasoner), so the daily review
 * loop needs no API key to run end to end. A model, when a key is configured, may only replace that
 * verdict with its own if its answer validates and cites nothing the case brief did not actually give
 * it. Failure of any kind degrades to the deterministic verdict rather than blocking the day's review.
 */

export interface ReasonRequest<T> {
  /** Stable task name, used for prompt selection and the activity log. */
  task: string;
  /** Fixed instruction. Nothing in `data_blocks` can ever reach this position. */
  instruction: string;
  /** Structured, already-redacted facts the model may use, rendered as fenced data blocks. */
  data_blocks: string[];
  /** Ids the model is allowed to reference. Referencing anything else invalidates the whole output. */
  allowed_ids: string[];
  /** Shape description for the model, and the validator that decides whether it complied. */
  schema_hint: string;
  validate: (raw: unknown) => T;
  /** The deterministic answer. Always computed; used as-is with no key, and on any model failure. */
  fallback: () => T;
}

export interface ReasonResult<T> {
  value: T;
  provider: string;
  /** True when a model was asked but its answer was not usable, so the fallback was returned instead. */
  degraded: boolean;
  degraded_reason: string | null;
  est_tokens: number;
  ms: number;
}

export interface Reasoner {
  readonly id: string;
  readonly uses_network: boolean;
  propose<T>(req: ReasonRequest<T>): Promise<ReasonResult<T>>;
}

/**
 * Collects ids an output referenced, however deeply nested, for the provenance check below. Unlike a
 * whole-string match, this scans inside free text too, since a verdict's `reasoning` is a sentence
 * ("Tied to CAR-9999...") rather than a bare id, and that is exactly where a fabricated reference
 * would actually show up.
 */
export function referencedIds(value: unknown, pattern = /\b[A-Z]{2,4}-[\w-]+\b/g): string[] {
  const out = new Set<string>();
  const walk = (v: unknown) => {
    if (typeof v === 'string') {
      for (const match of v.matchAll(pattern)) out.add(match[0]);
      return;
    }
    if (Array.isArray(v)) {
      v.forEach(walk);
      return;
    }
    if (v && typeof v === 'object') Object.values(v).forEach(walk);
  };
  walk(value);
  return [...out].sort();
}

export class FabricatedReferenceError extends Error {
  constructor(readonly offending: string[]) {
    super(`REJECTED_PROVENANCE: verdict referenced an id the case brief never supplied: ${offending.join(', ')}`);
    this.name = 'FabricatedReferenceError';
  }
}

/** Rejects a verdict that references a carrier, lane or relationship id it was never given. */
export function assertNoFabricatedReferences(value: unknown, allowed: string[]): void {
  const allowedSet = new Set(allowed);
  const offending = referencedIds(value).filter((id) => !allowedSet.has(id));
  if (offending.length > 0) throw new FabricatedReferenceError(offending);
}
