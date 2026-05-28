import type { LaceContext, LaceLine, LaceMood } from '@shared-types/lace-line';
import type { Mulberry32 } from '../rng/mulberry32';

/**
 * LACE selection — T-98 + T-102 (TDD §9.3).
 *
 * Picks a line for a run event:
 *   1. filter to the event's `context`, excluding lines already spoken this run
 *   2. prefer lines matching the current `mood`; if none, use the whole context pool
 *   3. if the context pool is empty, fall back to the `generic` pool (T-102)
 *   4. weight-sample the resulting pool
 *
 * Returns null only when even the generic pool is exhausted. Pure: the only
 * entropy is the supplied RNG (the `events` sub-generator, TDD §6.1).
 */

export interface SelectParams {
  readonly context: LaceContext;
  readonly mood: LaceMood;
  readonly spoken: ReadonlySet<string>;
  readonly rng: Mulberry32;
}

function weightedPick(pool: readonly LaceLine[], rng: Mulberry32): LaceLine {
  const total = pool.reduce((sum, l) => sum + l.weight, 0);
  let r = rng.next() * total;
  for (const line of pool) {
    r -= line.weight;
    if (r < 0) return line;
  }
  return pool[pool.length - 1]!; // float guard
}

export function selectLine(lines: readonly LaceLine[], params: SelectParams): LaceLine | null {
  const { context, mood, spoken, rng } = params;

  const inContext = lines.filter((l) => l.context === context && !spoken.has(l.id));
  let pool = inContext;

  if (pool.length === 0) {
    // Fallback to the generic catch-all pool (T-102).
    pool = lines.filter((l) => l.context === 'generic' && !spoken.has(l.id));
  } else {
    const moodMatched = pool.filter((l) => l.mood === mood);
    if (moodMatched.length > 0) pool = moodMatched;
  }

  if (pool.length === 0) return null;
  return weightedPick(pool, rng);
}
