/**
 * Deterministic pseudo-random generators.
 *
 * A seeded RNG keeps generated demo datasets stable across reloads, which makes
 * performance comparisons meaningful. Swap the seed to get a different — but
 * still reproducible — dataset.
 */

/** Mulberry32 — a tiny, fast, seedable PRNG. */
export function createRng(seed: number) {
  let a = seed >>> 0;
  return function next(): number {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type Rng = ReturnType<typeof createRng>;

export const pick = <T>(rng: Rng, items: readonly T[]): T =>
  items[Math.floor(rng() * items.length)];

export const intBetween = (rng: Rng, min: number, max: number): number =>
  Math.floor(rng() * (max - min + 1)) + min;

export const floatBetween = (rng: Rng, min: number, max: number): number =>
  rng() * (max - min) + min;

export const maybe = (rng: Rng, probability: number): boolean => rng() < probability;
