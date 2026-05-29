import type { MutationDef, MutationFamily } from '@shared-types/mutation';
import { FAMILY_RING } from '@shared-types/mutation';
import type { Mulberry32 } from '../rng/mulberry32';

/**
 * Strand Event card draw — T-85 (GDD §5.4).
 *
 * Produces the three mutation cards a Strand Event offers (GDD §5.4):
 *   - two **weighted** cards whose families are sampled from a per-family weight
 *     table (Rule 1). This base layer weights all five families equally — which
 *     is exactly Rule 1's "0 mutations owned" case; T-86 layers in the
 *     ownership-based 40/20/20/10/10 (and 2+-same-family 50/50) weighting.
 *   - one **wild** card (Rule 2) whose family is always sampled uniformly across
 *     all families, regardless of what the player owns.
 *
 * All three cards are distinct mutations the player does not already own
 * (Rule 4 — hardened in T-87). Deterministic: the only entropy is the supplied
 * `mutationdraw` sub-generator (TDD §6.1), so the same seed + owned set always
 * yields the same three cards — which is what makes Strand Events replayable.
 *
 * If the available pool is smaller than three, the draw returns as many distinct
 * cards as it can (degrades gracefully rather than throwing or repeating).
 */

/** Which rule generated a card's family — `weighted` (Rule 1) or `wild` (Rule 2). */
export type DrawSlot = 'weighted' | 'wild';

export interface DrawnCard {
  readonly mutation: MutationDef;
  readonly slot: DrawSlot;
}

export interface DrawMutationsParams {
  /** Every mutation that can be offered (the loaded content registry). */
  readonly pool: readonly MutationDef[];
  /** Mutations the player already owns — excluded from the draw (Rule 4). */
  readonly owned: readonly MutationDef[];
  /** The `mutationdraw` sub-generator — `makeRng(seed, 'mutationdraw')`. */
  readonly rng: Mulberry32;
}

/** Number of cards a Strand Event offers (GDD §5.4). */
export const STRAND_CARD_COUNT = 3;
/** Of those, how many are wild (full-random family); the rest are weighted. */
export const WILD_CARD_COUNT = 1;

/** Equal weight for every family — Rule 1's "0 mutations owned" distribution. */
function uniformFamilyWeights(): ReadonlyMap<MutationFamily, number> {
  return new Map(FAMILY_RING.map((f) => [f, 1] as const));
}

/** Weight-samples a family from a {family → weight} table. */
function pickFamily(weights: ReadonlyMap<MutationFamily, number>, rng: Mulberry32): MutationFamily {
  const entries = [...weights];
  const total = entries.reduce((sum, [, w]) => sum + w, 0);
  let r = rng.next() * total;
  for (const [family, w] of entries) {
    r -= w;
    if (r < 0) return family;
  }
  return entries[entries.length - 1]![0]; // float guard
}

/** Uniformly picks one mutation from a non-empty candidate list. */
function pickMutation(candidates: readonly MutationDef[], rng: Mulberry32): MutationDef {
  return candidates[rng.nextInt(candidates.length)]!;
}

export function drawMutationCards(params: DrawMutationsParams): readonly DrawnCard[] {
  const { pool, owned, rng } = params;
  const ownedIds = new Set(owned.map((m) => m.id));
  const remaining = pool.filter((m) => !ownedIds.has(m.id));

  // T-85 base layer: weighted slots use the uniform distribution. T-86 swaps
  // this for the ownership-aware `familyWeights(owned)`.
  const weightedDist = uniformFamilyWeights();

  const cards: DrawnCard[] = [];
  const drawn = new Set<string>();
  const weightedSlots = STRAND_CARD_COUNT - WILD_CARD_COUNT;

  for (let i = 0; i < STRAND_CARD_COUNT; i++) {
    const available = remaining.filter((m) => !drawn.has(m.id));
    if (available.length === 0) break; // pool exhausted — return fewer cards

    const slot: DrawSlot = i < weightedSlots ? 'weighted' : 'wild';
    const dist = slot === 'wild' ? uniformFamilyWeights() : weightedDist;
    const family = pickFamily(dist, rng);

    // Prefer the sampled family; if it has nothing left, broaden to anything
    // still available so a thin family never wastes a card (T-87 hardens this).
    const inFamily = available.filter((m) => m.family === family);
    const mutation = pickMutation(inFamily.length > 0 ? inFamily : available, rng);

    drawn.add(mutation.id);
    cards.push({ mutation, slot });
  }

  return cards;
}
