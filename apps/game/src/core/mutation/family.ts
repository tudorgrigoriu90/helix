import type { MutationFamily } from '@shared-types/mutation';
import { FAMILY_RING } from '@shared-types/mutation';

/**
 * Family adjacency for the Strand Event card-draw weighting (GDD §5.4 Rule 1).
 *
 * The five families form a ring (`FAMILY_RING`). A family's two ring-neighbours
 * are "adjacent"; the other two are "other". With 5 families this is always a
 * clean 2/2 split, which is what makes the 40% / 2×20% / 2×10% weighting sum to
 * 100%.
 */

const RING_LENGTH = FAMILY_RING.length;

/** Index of a family in the ring. Total — every `MutationFamily` is in the ring. */
function ringIndex(family: MutationFamily): number {
  return FAMILY_RING.indexOf(family);
}

/**
 * The two families adjacent to `family` on the ring (its clockwise and
 * counter-clockwise neighbours). Order is deterministic: counter-clockwise
 * neighbour first, then clockwise.
 */
export function adjacentFamilies(family: MutationFamily): readonly MutationFamily[] {
  const i = ringIndex(family);
  const prev = FAMILY_RING[(i - 1 + RING_LENGTH) % RING_LENGTH]!;
  const next = FAMILY_RING[(i + 1) % RING_LENGTH]!;
  return [prev, next];
}

/**
 * The families that are neither `family` itself nor adjacent to it — the
 * "other" bucket in the weighting rule. Deterministic ring order.
 */
export function otherFamilies(family: MutationFamily): readonly MutationFamily[] {
  const adjacent = new Set<MutationFamily>([family, ...adjacentFamilies(family)]);
  return FAMILY_RING.filter((f) => !adjacent.has(f));
}

/** True iff `a` and `b` are ring-neighbours. Symmetric; a family is not adjacent to itself. */
export function isAdjacent(a: MutationFamily, b: MutationFamily): boolean {
  return adjacentFamilies(a).includes(b);
}
