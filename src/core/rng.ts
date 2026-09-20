/**
 * Deterministic pseudo-random generation. The whole simulation replays exactly from a string seed,
 * so a "day 47" state is never stored, it is always recomputed: seed + day count is the only fact
 * that has to be reproducible. Two layers make that safe:
 *
 * 1. `xmur3` turns any string into a 32-bit integer, so a seed can be a readable label
 *    ("shadow-network-genesis") instead of a raw number.
 * 2. `mulberry32` is a small, fast, well-known integer PRNG. It is not cryptographic and does not
 *    need to be: nothing here protects a secret, it only has to be the same sequence every time.
 *
 * Each day gets its own generator derived from `(rootSeed, day)` rather than one long-lived generator
 * threaded through the whole run. That means day 200 can be reproduced without replaying the random
 * draws of days 1-199 first, only their effects (which live in state, not in the RNG stream).
 */

export type Rng = () => number;

function xmur3(seed: string): () => number {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return (h ^= h >>> 16) >>> 0;
  };
}

function mulberry32(a: number): Rng {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A fresh, independent generator for one root seed. Same seed in, same infinite sequence out. */
export function createRng(seed: string): Rng {
  const seedFn = xmur3(seed);
  return mulberry32(seedFn());
}

/** The generator for one specific day of one specific run. Independent of every other day's draws. */
export function dayRng(rootSeed: string, day: number): Rng {
  return createRng(`${rootSeed}::day:${day}`);
}

/** Float in [min, max). */
export function rngRange(rng: Rng, min: number, max: number): number {
  return min + rng() * (max - min);
}

/** Integer in [min, max], both inclusive. */
export function rngInt(rng: Rng, min: number, max: number): number {
  return Math.floor(rngRange(rng, min, max + 1));
}

/** True with probability `p` (0-1). */
export function rngChance(rng: Rng, p: number): boolean {
  return rng() < p;
}

/** One element of a non-empty array, uniformly. */
export function rngPick<T>(rng: Rng, items: readonly T[]): T {
  if (items.length === 0) throw new Error('rngPick: cannot pick from an empty array');
  return items[rngInt(rng, 0, items.length - 1)] as T;
}

/**
 * Weighted pick. `weights` must be the same length as `items` and sum to a positive number.
 * Used for things like "which fraud category fires", where categories are not equally likely.
 */
export function rngWeightedPick<T>(rng: Rng, items: readonly T[], weights: readonly number[]): T {
  const total = weights.reduce((sum, w) => sum + w, 0);
  if (total <= 0) throw new Error('rngWeightedPick: weights must sum to a positive number');
  let roll = rng() * total;
  for (let i = 0; i < items.length; i++) {
    roll -= weights[i] as number;
    if (roll <= 0) return items[i] as T;
  }
  return items[items.length - 1] as T;
}
