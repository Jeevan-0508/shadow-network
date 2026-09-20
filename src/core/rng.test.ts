import { describe, expect, it } from 'bun:test';
import { createRng, dayRng, rngChance, rngInt, rngPick, rngRange, rngWeightedPick } from './rng';

describe('createRng', () => {
  it('produces the exact same sequence for the same seed', () => {
    const a = createRng('shadow-network-genesis');
    const b = createRng('shadow-network-genesis');
    const seqA = Array.from({ length: 20 }, () => a());
    const seqB = Array.from({ length: 20 }, () => b());
    expect(seqA).toEqual(seqB);
  });

  it('produces a different sequence for a different seed', () => {
    const a = createRng('seed-one');
    const b = createRng('seed-two');
    const seqA = Array.from({ length: 10 }, () => a());
    const seqB = Array.from({ length: 10 }, () => b());
    expect(seqA).not.toEqual(seqB);
  });

  it('stays within [0, 1)', () => {
    const rng = createRng('bounds-check');
    for (let i = 0; i < 500; i++) {
      const value = rng();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });
});

describe('dayRng', () => {
  it('gives each day of the same root seed an independent stream', () => {
    const day1 = dayRng('root', 1);
    const day2 = dayRng('root', 2);
    expect(day1()).not.toEqual(day2());
  });

  it('is reproducible for the same (rootSeed, day) pair regardless of call order elsewhere', () => {
    const first = dayRng('root', 47)();
    const second = dayRng('root', 47)();
    expect(first).toBe(second);
  });
});

describe('rngInt', () => {
  it('never exceeds the requested inclusive bounds', () => {
    const rng = createRng('int-bounds');
    for (let i = 0; i < 200; i++) {
      const value = rngInt(rng, 3, 7);
      expect(value).toBeGreaterThanOrEqual(3);
      expect(value).toBeLessThanOrEqual(7);
      expect(Number.isInteger(value)).toBe(true);
    }
  });
});

describe('rngRange', () => {
  it('stays within [min, max)', () => {
    const rng = createRng('range-bounds');
    for (let i = 0; i < 200; i++) {
      const value = rngRange(rng, -2, 5);
      expect(value).toBeGreaterThanOrEqual(-2);
      expect(value).toBeLessThan(5);
    }
  });
});

describe('rngChance', () => {
  it('always returns true for probability 1 and false for probability 0', () => {
    const rng = createRng('chance-edges');
    expect(rngChance(rng, 1)).toBe(true);
    expect(rngChance(rng, 0)).toBe(false);
  });
});

describe('rngPick', () => {
  it('only ever returns an element that was in the array', () => {
    const rng = createRng('pick-check');
    const items = ['a', 'b', 'c'];
    for (let i = 0; i < 50; i++) expect(items).toContain(rngPick(rng, items));
  });

  it('throws on an empty array instead of returning undefined', () => {
    const rng = createRng('pick-empty');
    expect(() => rngPick(rng, [])).toThrow();
  });
});

describe('rngWeightedPick', () => {
  it('never picks an item with zero relative weight, over many draws', () => {
    const rng = createRng('weighted-check');
    const items = ['common', 'never'] as const;
    const weights = [1, 0];
    for (let i = 0; i < 200; i++) expect(rngWeightedPick(rng, items, weights)).toBe('common');
  });

  it('throws if all weights sum to zero or less', () => {
    const rng = createRng('weighted-zero');
    expect(() => rngWeightedPick(rng, ['a', 'b'], [0, 0])).toThrow();
  });
});
