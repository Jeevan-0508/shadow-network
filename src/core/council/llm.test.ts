import { describe, expect, it } from 'bun:test';
import { createLlmReasoner } from './llm';
import type { ReasonRequest } from './types';
import type { Verdict } from './verdict';

const validate = (raw: unknown): Verdict => {
  const r = raw as Partial<Verdict> | null;
  if (!r || (r.decision !== 'fraud' && r.decision !== 'clear')) throw new Error('bad decision');
  if (typeof r.confidence !== 'number') throw new Error('bad confidence');
  if (typeof r.reasoning !== 'string' || !r.reasoning) throw new Error('bad reasoning');
  return { eventId: 'INC-1-1', decision: r.decision, confidence: r.confidence, reasoning: r.reasoning };
};

const req = (over: Partial<ReasonRequest<Verdict>> = {}): ReasonRequest<Verdict> => ({
  task: 'review_flagged_event',
  instruction: 'Decide fraud or clear from the case brief only.',
  data_blocks: ['CASE BRIEF: { "eventId": "INC-1-1", "carrierIds": ["CAR-0001"] }'],
  allowed_ids: ['INC-1-1', 'CAR-0001', 'LN-001'],
  schema_hint: '{ decision, confidence, reasoning }',
  validate,
  fallback: () => ({ eventId: 'INC-1-1', decision: 'clear', confidence: 0.6, reasoning: 'Fallback: CAR-0001 legitimacy signal is unremarkable.' }),
  ...over,
});

const jsonResponse = (payload: unknown, ok = true, status = 200): typeof fetch =>
  (async () => ({ ok, status, json: async () => ({ content: [{ text: typeof payload === 'string' ? payload : JSON.stringify(payload) }] }) })) as unknown as typeof fetch;

describe('llm reasoner', () => {
  const base = { endpoint: 'https://example.invalid/v1/messages', model: 'test-model', getApiKey: () => 'sk-test' };

  it('accepts a well-formed model answer', async () => {
    const r = createLlmReasoner({ ...base, fetchImpl: jsonResponse({ decision: 'fraud', confidence: 0.82, reasoning: 'CAR-0001 shows a coordinated pattern.' }) });
    const out = await r.propose(req());
    expect(out.degraded).toBe(false);
    expect(out.value.decision).toBe('fraud');
    expect(out.est_tokens).toBeGreaterThan(0);
  });

  it('degrades to the fallback with no api key, and never attempts a network call', async () => {
    let called = false;
    const r = createLlmReasoner({ ...base, getApiKey: () => null, fetchImpl: (async () => { called = true; return { ok: true, status: 200, json: async () => ({}) }; }) as unknown as typeof fetch });
    const out = await r.propose(req());
    expect(out.degraded).toBe(true);
    expect(out.degraded_reason).toBe('no api key configured');
    expect(out.value.decision).toBe('clear');
    expect(called).toBe(false);
  });

  it('degrades on a non-JSON response body', async () => {
    const r = createLlmReasoner({ ...base, fetchImpl: jsonResponse('not json at all') });
    const out = await r.propose(req());
    expect(out.degraded).toBe(true);
    expect(out.degraded_reason).toBe('response was not valid JSON');
  });

  it('degrades on a non-ok HTTP status', async () => {
    const r = createLlmReasoner({ ...base, fetchImpl: jsonResponse({}, false, 500) });
    const out = await r.propose(req());
    expect(out.degraded).toBe(true);
    expect(out.degraded_reason).toBe('provider returned HTTP 500');
  });

  it('degrades when the model references a carrier id the case brief never gave it', async () => {
    const r = createLlmReasoner({ ...base, fetchImpl: jsonResponse({ decision: 'fraud', confidence: 0.9, reasoning: 'Tied to CAR-9999, a carrier not in this brief.' }) });
    const out = await r.propose(req());
    expect(out.degraded).toBe(true);
    expect(out.degraded_reason).toContain('CAR-9999');
    expect(out.value.decision).toBe('clear');
  });

  it('degrades on a validator rejection (missing required field)', async () => {
    const r = createLlmReasoner({ ...base, fetchImpl: jsonResponse({ decision: 'fraud' }) });
    const out = await r.propose(req());
    expect(out.degraded).toBe(true);
    expect(out.degraded_reason).toBe('bad confidence');
  });
});
