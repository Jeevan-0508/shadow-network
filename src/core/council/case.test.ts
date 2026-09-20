import { describe, expect, it } from 'bun:test';
import { allowedIdsFor, buildCaseBrief } from './case';
import type { FlaggedEvent, SimState } from '../model';
import { DEFAULT_CONFIG } from '../model';

function stateWith(relationships: SimState['relationships']): SimState {
  return {
    day: 5,
    config: DEFAULT_CONFIG,
    carriers: [
      { id: 'CAR-0001', name: 'Northern Freight GmbH', scac: 'AAAA', status: 'active', legitimacyScore: 22.4, driftRate: -0.5, laneIds: ['LN-001'], createdOnDay: 0 },
      { id: 'CAR-0002', name: 'Silver Logistics Ltd', scac: 'BBBB', status: 'active', legitimacyScore: 18.9, driftRate: -0.6, laneIds: ['LN-001'], createdOnDay: 0 },
    ],
    lanes: [{ id: 'LN-001', origin: 'Rotterdam', destination: 'Duisburg', region: 'EU', riskBaseline: 0.8 }],
    relationships,
  };
}

const fraudEvent: FlaggedEvent = {
  id: 'INC-5-1',
  day: 5,
  kind: 'fraud',
  patternId: 'FFT-001',
  category: 'contractual',
  severity: 'high',
  carrierIds: ['CAR-0001', 'CAR-0002'],
  laneId: 'LN-001',
  groundTruthFraud: true,
  causalTrace: ['this should never reach the council'],
};

describe('buildCaseBrief', () => {
  it('never carries the ground-truth or sim-internal fields into the brief', () => {
    const brief = buildCaseBrief(fraudEvent, stateWith([]));
    const serialized = JSON.stringify(brief);
    expect(serialized).not.toContain('groundTruthFraud');
    expect(serialized).not.toContain('FFT-001');
    expect(serialized).not.toContain('causalTrace');
    expect(serialized).not.toContain('never reach the council');
    expect((brief as unknown as { kind?: string }).kind).toBeUndefined();
  });

  it('carries the observable severity, lane and carrier ids through unchanged', () => {
    const brief = buildCaseBrief(fraudEvent, stateWith([]));
    expect(brief.eventId).toBe('INC-5-1');
    expect(brief.day).toBe(5);
    expect(brief.laneId).toBe('LN-001');
    expect(brief.severity).toBe('high');
    expect(brief.carrierIds).toEqual(['CAR-0001', 'CAR-0002']);
    expect(brief.jointlyFlagged).toBe(true);
  });

  it('reads each carrier legitimacy score from state, rounded to one decimal', () => {
    const brief = buildCaseBrief(fraudEvent, stateWith([]));
    expect(brief.carriers).toEqual([
      { carrierId: 'CAR-0001', legitimacyScore: 22.4, hasKnownRelationship: false },
      { carrierId: 'CAR-0002', legitimacyScore: 18.9, hasKnownRelationship: false },
    ]);
  });

  it('marks hasKnownRelationship true for any carrier that appears anywhere in the relationship graph', () => {
    const relationships: SimState['relationships'] = [
      { id: 'REL-1', carrierAId: 'CAR-0001', carrierBId: 'CAR-0002', kind: 'shared_address', strength: 0.7, formedOnDay: 3 },
    ];
    const brief = buildCaseBrief(fraudEvent, stateWith(relationships));
    expect(brief.carriers.every((c) => c.hasKnownRelationship)).toBe(true);
  });

  it('defaults a carrier missing from state to a zero legitimacy score rather than throwing', () => {
    const brief = buildCaseBrief({ ...fraudEvent, carrierIds: ['CAR-9999'] }, stateWith([]));
    expect(brief.carriers).toEqual([{ carrierId: 'CAR-9999', legitimacyScore: 0, hasKnownRelationship: false }]);
  });
});

describe('allowedIdsFor', () => {
  it('lists exactly the event id, lane id and every carrier id, nothing else', () => {
    const brief = buildCaseBrief(fraudEvent, stateWith([]));
    expect(allowedIdsFor(brief)).toEqual(['INC-5-1', 'LN-001', 'CAR-0001', 'CAR-0002']);
  });
});
