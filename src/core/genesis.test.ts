import { describe, expect, it } from 'bun:test';
import { createGenesisState } from './genesis';
import { DEFAULT_CONFIG } from './model';

describe('createGenesisState', () => {
  it('is byte-identical for the same seed and config', () => {
    const a = createGenesisState(DEFAULT_CONFIG);
    const b = createGenesisState(DEFAULT_CONFIG);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('differs for a different seed', () => {
    const a = createGenesisState(DEFAULT_CONFIG);
    const b = createGenesisState({ ...DEFAULT_CONFIG, seed: 'a-different-seed' });
    expect(JSON.stringify(a)).not.toBe(JSON.stringify(b));
  });

  it('creates exactly carrierCount carriers and laneCount lanes', () => {
    const state = createGenesisState(DEFAULT_CONFIG);
    expect(state.carriers.length).toBe(DEFAULT_CONFIG.carrierCount);
    expect(state.lanes.length).toBe(DEFAULT_CONFIG.laneCount);
    expect(state.day).toBe(0);
    expect(state.relationships).toEqual([]);
  });

  it('gives every carrier a unique id, name and scac', () => {
    const state = createGenesisState(DEFAULT_CONFIG);
    expect(new Set(state.carriers.map((c) => c.id)).size).toBe(state.carriers.length);
    expect(new Set(state.carriers.map((c) => c.name)).size).toBe(state.carriers.length);
    expect(new Set(state.carriers.map((c) => c.scac)).size).toBe(state.carriers.length);
  });

  it('only assigns lane ids that actually exist in the generated lane list', () => {
    const state = createGenesisState(DEFAULT_CONFIG);
    const laneIds = new Set(state.lanes.map((l) => l.id));
    for (const carrier of state.carriers) {
      expect(carrier.laneIds.length).toBeGreaterThan(0);
      for (const laneId of carrier.laneIds) expect(laneIds.has(laneId)).toBe(true);
    }
  });

  it('starts every carrier active with a legitimacy score in [0, 100]', () => {
    const state = createGenesisState(DEFAULT_CONFIG);
    for (const carrier of state.carriers) {
      expect(carrier.status).toBe('active');
      expect(carrier.legitimacyScore).toBeGreaterThanOrEqual(0);
      expect(carrier.legitimacyScore).toBeLessThanOrEqual(100);
      expect(carrier.createdOnDay).toBe(0);
    }
  });

  it('gives each lane a plausible, non-empty origin and destination pair, tagged to a region', () => {
    const state = createGenesisState(DEFAULT_CONFIG);
    for (const lane of state.lanes) {
      expect(lane.origin).not.toBe(lane.destination);
      expect(lane.origin.length).toBeGreaterThan(0);
      expect(lane.destination.length).toBeGreaterThan(0);
      expect(['EU', 'NA']).toContain(lane.region);
      expect(lane.riskBaseline).toBeGreaterThanOrEqual(0.2);
      expect(lane.riskBaseline).toBeLessThanOrEqual(1);
    }
  });
});
