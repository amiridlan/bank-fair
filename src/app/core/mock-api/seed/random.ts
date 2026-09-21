/**
 * Deterministic pseudo-random generator.
 *
 * The demo must look identical on every load — the same candidates, the same
 * pipeline, the same booth layout — so screenshots stay valid and a walkthrough
 * can be rehearsed. A fixed seed gives that without a faker dependency.
 */

/** mulberry32: small, fast, and good enough for seed data. */
export function mulberry32(seed: number): () => number {
  let state = seed >>> 0;

  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** The one seed the whole demo is generated from. */
export const DEMO_SEED = 20260921;

/** Convenience wrapper over a mulberry32 stream. */
export class SeededRandom {
  private readonly next: () => number;

  constructor(seed: number = DEMO_SEED) {
    this.next = mulberry32(seed);
  }

  /** 0 <= n < 1. */
  float(): number {
    return this.next();
  }

  /** Integer in [min, max], inclusive at both ends. */
  int(min: number, max: number): number {
    return min + Math.floor(this.next() * (max - min + 1));
  }

  /** Rounded to `decimals` places. */
  decimal(min: number, max: number, decimals: number): number {
    const value = min + this.next() * (max - min);
    const factor = 10 ** decimals;
    return Math.round(value * factor) / factor;
  }

  bool(probability = 0.5): boolean {
    return this.next() < probability;
  }

  pick<T>(items: readonly T[]): T {
    if (items.length === 0) {
      throw new Error('SeededRandom.pick called with an empty list');
    }
    return items[this.int(0, items.length - 1)];
  }

  /**
   * Picks by relative weight. Weights need not sum to 1 — they are normalised,
   * so a distribution can be written the way docs/05 states it.
   */
  weighted<T>(entries: readonly (readonly [T, number])[]): T {
    const total = entries.reduce((sum, [, weight]) => sum + weight, 0);
    let roll = this.next() * total;

    for (const [value, weight] of entries) {
      roll -= weight;
      if (roll <= 0) {
        return value;
      }
    }
    return entries[entries.length - 1][0];
  }

  /** `count` distinct items, or all of them when `count` exceeds the list. */
  sample<T>(items: readonly T[], count: number): T[] {
    const pool = [...items];
    const taken: T[] = [];
    const wanted = Math.min(count, pool.length);

    for (let i = 0; i < wanted; i++) {
      taken.push(pool.splice(this.int(0, pool.length - 1), 1)[0]);
    }
    return taken;
  }

  /** Fisher–Yates, returning a new array. */
  shuffle<T>(items: readonly T[]): T[] {
    const result = [...items];
    for (let i = result.length - 1; i > 0; i--) {
      const j = this.int(0, i);
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }
}
