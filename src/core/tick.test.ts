import { describe, expect, it } from 'bun:test';
import { createGenesisState } from './genesis';
import { DEFAULT_CONFIG, type SimConfig } from './model';
import { runSimulation, tickDay } from './tick';
import { RING_PATTERNS } from './taxonomy';

const CONFIG: SimConfig = { ...DEFAULT_CONFIG, seed: 'tick-test-seed', carrierCount: 60, laneCount: 10 };

describe('tickDay', () => {
  it('is deterministic: ticking the same state twice gives the same result', () => {
    const genesis = createGenesisState(CONFIG);
    const a = tickDay(genesis, CONFIG);
    const b = tickDay(genesis, CONFIG);
    expect(JSON.stringify(a.state)).toBe(JSON.stringify(b.state));
    expect(JSON.stringify(a.incidents)).toBe(JSON.stringify(b.incidents));
  });

  it('advances the day counter by exactly one and does not mutate the input state', () => {
    const genesis = createGenesisState(CONFIG);
    const before = JSON.stringify(genesis);
    const result = tickDay(genesis, CONFIG);
    expect(result.state.day).toBe(genesis.day + 1);
    expect(JSON.stringify(genesis)).toBe(before);
  });

  it('keeps every carrier legitimacy score within [0, 100] after one tick', () => {
    const genesis = createGenesisState(CONFIG);
    const result = tickDay(genesis, CONFIG);
    for (const carrier of result.state.carriers) {
      expect(carrier.legitimacyScore).toBeGreaterThanOrEqual(0);
      expect(carrier.legitimacyScore).toBeLessThanOrEqual(100);
    }
  });

  it('exits a carrier exactly on the day its legitimacy collapses to zero, and never resurrects it', () => {
    const genesis = createGenesisState(CONFIG);
    const run = runSimulation(genesis, 200);
    const exited = run.state.carriers.filter((c) => c.status === 'exited');
    expect(exited.length).toBeGreaterThan(0);
    for (const carrier of exited) {
      expect(carrier.legitimacyScore).toBe(0);
      expect(carrier.exitedOnDay).toBeGreaterThan(0);
      expect(carrier.exitedOnDay).toBeLessThanOrEqual(200);
    }
  });
});

describe('runSimulation over a long horizon', () => {
  const genesis = createGenesisState(CONFIG);
  const run = runSimulation(genesis, 250);

  it('produces at least one fraud incident and one benign anomaly', () => {
    const fraud = run.incidentLog.filter((e) => e.kind === 'fraud');
    const anomaly = run.incidentLog.filter((e) => e.kind === 'anomaly');
    expect(fraud.length).toBeGreaterThan(0);
    expect(anomaly.length).toBeGreaterThan(0);
  });

  it('forms at least one collusion relationship', () => {
    expect(run.state.relationships.length).toBeGreaterThan(0);
  });

  it('keeps groundTruthFraud perfectly aligned with event kind, by construction', () => {
    for (const event of run.incidentLog) {
      expect(event.groundTruthFraud).toBe(event.kind === 'fraud');
    }
  });

  it('never fires a ring-only pattern on a solo carrier with no relationship, across the default-rate run', () => {
    for (const event of run.incidentLog) {
      if (event.kind === 'fraud' && event.patternId && RING_PATTERNS.has(event.patternId)) {
        expect(event.carrierIds.length).toBe(2);
      }
    }
  });

  it('does fire ring patterns, and only on the two carriers that hold the relationship, under rates tuned to make collusion common', () => {
    const ringConfig: SimConfig = {
      ...CONFIG,
      seed: 'ring-fire-probe',
      carrierCount: 24,
      laneCount: 4,
      corruptionThreshold: 80,
      ringFormationRate: 0.6,
      incidentBaseRate: 0.5,
      spiralFactor: 0.8,
      driftNoise: 0.3,
    };
    const ringRun = runSimulation(createGenesisState(ringConfig), 60);
    const ringEvents = ringRun.incidentLog.filter((e) => e.kind === 'fraud' && e.patternId && RING_PATTERNS.has(e.patternId));
    expect(ringEvents.length).toBeGreaterThan(0);

    for (const event of ringEvents) {
      expect(event.carrierIds.length).toBe(2);
      const [a, b] = event.carrierIds;
      const linked = ringRun.state.relationships.some(
        (edge) => (edge.carrierAId === a && edge.carrierBId === b) || (edge.carrierAId === b && edge.carrierBId === a),
      );
      expect(linked).toBe(true);
    }
  });

  it('gives every incident a non-empty causal trace citing what changed', () => {
    for (const event of run.incidentLog) {
      expect(event.causalTrace.length).toBeGreaterThan(0);
      for (const line of event.causalTrace) expect(line.length).toBeGreaterThan(0);
    }
  });

  it('every fraud event cites a real taxonomy pattern id', () => {
    const validIds = new Set(['FFT-001', 'FFT-002', 'FFT-003', 'FFT-004', 'FFT-005', 'FFT-006', 'FFT-007', 'FFT-008', 'FFT-009', 'FFT-010', 'FFT-011', 'FFT-012']);
    for (const event of run.incidentLog) {
      if (event.kind === 'fraud') {
        expect(event.patternId).toBeDefined();
        expect(validIds.has(event.patternId as string)).toBe(true);
      } else {
        expect(event.patternId).toBeUndefined();
      }
    }
  });

  it('matches calling tickDay sequentially by hand, so runSimulation adds no hidden behavior', () => {
    let manual = genesis;
    const manualIncidents = [];
    for (let i = 0; i < 30; i++) {
      const result = tickDay(manual, CONFIG);
      manual = result.state;
      manualIncidents.push(...result.incidents);
    }
    const viaRun = runSimulation(genesis, 30);
    expect(JSON.stringify(manual)).toBe(JSON.stringify(viaRun.state));
    expect(JSON.stringify(manualIncidents)).toBe(JSON.stringify(viaRun.incidentLog));
  });
});
