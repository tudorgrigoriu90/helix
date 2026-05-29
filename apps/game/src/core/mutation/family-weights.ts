import type { MutationDef, MutationFamily } from '@shared-types/mutation';
import { FAMILY_RING } from '@shared-types/mutation';
import { adjacentFamilies, otherFamilies } from './family';

/**
 * Family-weighting distribution — T-86 (GDD §5.4 Rule 1).
 *
 * Given what the player already owns, returns the per-family weight the
 * draw's two weighted cards sample from (the wild card ignores this — Rule 2):
 *
 *   - **0 owned:** all five families equal (20 each → 100%).
 *   - **1 in the dominant family:** dominant 40, each adjacent 20, each other 10.
 *   - **2+ in the dominant family:** dominant 50, the other four share 50 (12.5 each).
 *
 * The "dominant" family is whichever the player owns most of; ties break by
 * `FAMILY_RING` order, so the result is fully deterministic. When the player
 * owns one each of several families (max count 1), the 1-owned rule is centred
 * on the ring-first of them — a sensible read of a spec that only enumerates the
 * 0 / 1 / 2+-same cases. Weights always sum to 100 and are always positive.
 */

/** 0 owned — each of five families. */
export const WEIGHT_UNIFORM = 20;
/** 1 owned — the dominant family. */
export const WEIGHT_DOMINANT_SINGLE = 40;
/** 1 owned — each ring-adjacent family. */
export const WEIGHT_ADJACENT_SINGLE = 20;
/** 1 owned — each non-adjacent family. */
export const WEIGHT_OTHER_SINGLE = 10;
/** 2+ in one family — that dominant family. */
export const WEIGHT_DOMINANT_MANY = 50;
/** 2+ in one family — each of the other four families. */
export const WEIGHT_OTHER_MANY = 12.5;

/** Per-family owned counts, every family present (0 when unowned). */
function ownedCounts(owned: readonly MutationDef[]): Map<MutationFamily, number> {
  const counts = new Map<MutationFamily, number>(FAMILY_RING.map((f) => [f, 0]));
  for (const m of owned) counts.set(m.family, (counts.get(m.family) ?? 0) + 1);
  return counts;
}

/** The most-owned family and its count; ties break by `FAMILY_RING` order. */
function dominant(counts: Map<MutationFamily, number>): { family: MutationFamily; count: number } {
  let best: MutationFamily = FAMILY_RING[0]!;
  let bestCount = -1;
  for (const family of FAMILY_RING) {
    const c = counts.get(family) ?? 0;
    if (c > bestCount) {
      best = family;
      bestCount = c;
    }
  }
  return { family: best, count: bestCount };
}

export function familyWeights(owned: readonly MutationDef[]): ReadonlyMap<MutationFamily, number> {
  const { family: dom, count } = dominant(ownedCounts(owned));

  if (count <= 0) {
    return new Map(FAMILY_RING.map((f) => [f, WEIGHT_UNIFORM]));
  }

  const weights = new Map<MutationFamily, number>();
  if (count === 1) {
    const adjacent = new Set(adjacentFamilies(dom));
    const other = new Set(otherFamilies(dom));
    for (const f of FAMILY_RING) {
      if (f === dom) weights.set(f, WEIGHT_DOMINANT_SINGLE);
      else if (adjacent.has(f)) weights.set(f, WEIGHT_ADJACENT_SINGLE);
      else if (other.has(f)) weights.set(f, WEIGHT_OTHER_SINGLE);
    }
    return weights;
  }

  // 2+ in the dominant family.
  for (const f of FAMILY_RING) {
    weights.set(f, f === dom ? WEIGHT_DOMINANT_MANY : WEIGHT_OTHER_MANY);
  }
  return weights;
}
