import { describe, expect, it } from 'bun:test';
import { ruleBasedVerdict } from './verdict';
import type { CaseBrief } from './case';

function brief(overrides: Partial<CaseBrief> = {}): CaseBrief {
  return {
    eventId: 'INC-9-1',
    day: 9,
    laneId: 'LN-002',
    severity: 'medium',
    carrierIds: ['CAR-0001'],
    carriers: [{ carrierId: 'CAR-0001', legitimacyScore: 90, hasKnownRelationship: false }],
    jointlyFlagged: false,
    ...overrides,
  };
}

describe('ruleBasedVerdict', () => {
  it('is a pure function: the same brief always yields the same verdict', () => {
    const a = ruleBasedVerdict(brief());
    const b = ruleBasedVerdict(brief());
    expect(a).toEqual(b);
  });

  it('clears a high-legitimacy, low-severity, unlinked carrier', () => {
    const verdict = ruleBasedVerdict(brief({ severity: 'low', carriers: [{ carrierId: 'CAR-0001', legitimacyScore: 95, hasKnownRelationship: false }] }));
    expect(verdict.decision).toBe('clear');
    expect(verdict.confidence).toBeGreaterThan(0.5);
  });

  it('flags a low-legitimacy, critical-severity carrier with a known relationship link', () => {
    const verdict = ruleBasedVerdict(
      brief({ severity: 'critical', jointlyFlagged: true, carriers: [{ carrierId: 'CAR-0001', legitimacyScore: 10, hasKnownRelationship: true }] }),
    );
    expect(verdict.decision).toBe('fraud');
    expect(verdict.confidence).toBeGreaterThan(0.5);
  });

  it('always returns confidence in [0, 1] and non-empty reasoning that echoes the case brief eventId', () => {
    for (const legitimacyScore of [0, 25, 50, 75, 100]) {
      const verdict = ruleBasedVerdict(brief({ carriers: [{ carrierId: 'CAR-0001', legitimacyScore, hasKnownRelationship: false }] }));
      expect(verdict.confidence).toBeGreaterThanOrEqual(0);
      expect(verdict.confidence).toBeLessThanOrEqual(1);
      expect(verdict.reasoning.length).toBeGreaterThan(0);
      expect(verdict.eventId).toBe('INC-9-1');
    }
  });

  it('only ever mentions carrier ids that were actually in the brief', () => {
    const verdict = ruleBasedVerdict(brief());
    expect(verdict.reasoning).toContain('CAR-0001');
    expect(verdict.reasoning).not.toMatch(/CAR-(?!0001)\d+/);
  });
});
