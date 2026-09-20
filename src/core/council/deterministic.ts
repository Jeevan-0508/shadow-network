import { assertNoFabricatedReferences, type ReasonRequest, type ReasonResult, type Reasoner } from './types';

/**
 * The default reasoner: no network, no key, no variance. It returns the caller's own rule-based
 * verdict (see `verdict.ts`), but still runs it through validation and the provenance fence, so demo
 * mode exercises exactly the same checks the model path does. This is what makes the whole sim-tick to
 * leaderboard loop work with zero API keys configured.
 */
export function createDeterministicReasoner(): Reasoner {
  return {
    id: 'deterministic',
    uses_network: false,
    async propose<T>(req: ReasonRequest<T>): Promise<ReasonResult<T>> {
      const started = Date.now();
      const value = req.validate(req.fallback());
      assertNoFabricatedReferences(value, req.allowed_ids);
      return { value, provider: 'deterministic', degraded: false, degraded_reason: null, est_tokens: 0, ms: Date.now() - started };
    },
  };
}
