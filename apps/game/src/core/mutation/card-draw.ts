import type { MutationDef, MutationFamily, MutationTier } from '@shared-types/mutation';
import { FAMILY_RING } from '@shared-types/mutation';
import type { Mulberry32 } from '../rng/mulberry32';
import { familyWeights } from './family-weights';
import { availableMutations } from './available';
import { STRAND_CARD_COUNT, WILD_CARD_COUNT } from './constants';
import { tiersForFloor } from './tiers';

export { STRAND_CARD_COUNT, WILD_CARD_COUNT };

/**
 * Strand Event card draw — T-85 (GDD §5.4).
 *
 * Produces the three mutation cards a Strand Event offers (GDD §5.4):
 *   - two **weighted** cards whose families are sampled from the ownership-based
 *     {@link familyWeights} table (Rule 1 — 40/20/20/10/10 with one owned,
 *     50/12.5 with 2+ in a family, uniform with none).
 *   - one **wild** card (Rule 2) whose family is always sampled uniformly across
 *     all families, regardless of what the player owns.
 *
 * Each slot also carries a required **tier** that escalates with depth (Rule 3,
 * {@link tiersForFloor}); tier is honoured with graceful fallback so a thin pool
 * never leaves a slot empty.
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
  /** The tier this slot required (GDD §5.4 Rule 3). Usually equals
   *  `mutation.tier`, but can differ when a thin pool forced a tier fallback. */
  readonly tier: MutationTier;
}

export interface DrawMutationsParams {
  /** Every mutation that can be offered (the loaded content registry). */
  readonly pool: readonly MutationDef[];
  /** Mutations the player already owns — excluded from the draw (Rule 4). */
  readonly owned: readonly MutationDef[];
  /** Current floor — sets the per-slot tier mix (Rule 3). Defaults to floor 1
   *  (all Minor) so early callers/tests need not supply it. */
  readonly floor?: number;
  /** The `mutationdraw` sub-generator — `makeRng(seed, 'mutationdraw')`. */
  readonly rng: Mulberry32;
  /** Origin familyAffinity (T-301): extra weight on this family for the
   *  *weighted* slots only — the wild slot stays uniform (Rule 2). */
  readonly affinity?: MutationFamily;
}

/** Weighting bonus an Origin's familyAffinity adds (on the 100-point scale). */
export const AFFINITY_WEIGHT_BONUS = 10;

/** familyWeights plus the Origin affinity bonus, when one applies. */
function weightsWithAffinity(
  owned: readonly MutationDef[],
  affinity: MutationFamily | undefined,
): ReadonlyMap<MutationFamily, number> {
  const base = familyWeights(owned);
  if (affinity === undefined) return base;
  const boosted = new Map(base);
  boosted.set(affinity, (boosted.get(affinity) ?? 0) + AFFINITY_WEIGHT_BONUS);
  return boosted;
}

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

/**
 * Resolves one card from the still-available pool, honouring tier then family
 * with graceful fallback so a slot is never wasted on a thin pool:
 *   1. required tier ∩ sampled family   (the ideal card)
 *   2. required tier, any family         (tier matters more than family)
 *   3. sampled family, any tier          (keep the family flavour)
 *   4. anything still available          (last resort)
 * `available` is guaranteed non-empty by the caller.
 */
function pickForSlot(
  available: readonly MutationDef[],
  tier: MutationTier,
  family: MutationFamily,
  rng: Mulberry32,
): MutationDef {
  const tierMatches = available.filter((m) => m.tier === tier);
  const tierAndFamily = tierMatches.filter((m) => m.family === family);
  if (tierAndFamily.length > 0) return pickMutation(tierAndFamily, rng);
  if (tierMatches.length > 0) return pickMutation(tierMatches, rng);

  const familyMatches = available.filter((m) => m.family === family);
  if (familyMatches.length > 0) return pickMutation(familyMatches, rng);

  return pickMutation(available, rng);
}

/** Inputs to {@link drawOneCard} — one card for a known slot + tier. */
export interface DrawOneParams {
  readonly pool: readonly MutationDef[];
  /** Owned set — only feeds the weighted-slot family distribution (Rule 1). */
  readonly owned: readonly MutationDef[];
  /** Ids the card must avoid (owned + anything already on the table). */
  readonly excludeIds: ReadonlySet<string>;
  readonly slot: DrawSlot;
  readonly tier: MutationTier;
  readonly rng: Mulberry32;
  readonly affinity?: MutationFamily;
}

/**
 * Draws a single card for a fixed slot + tier, or null if nothing is available.
 * Shared by the full {@link drawMutationCards} and by reroll (T-89), so both
 * resolve a card identically and consume the `mutationdraw` stream the same way.
 */
export function drawOneCard(params: DrawOneParams): DrawnCard | null {
  const available = availableMutations(params.pool, params.excludeIds);
  if (available.length === 0) return null;

  const dist =
    params.slot === 'wild' ? uniformFamilyWeights() : weightsWithAffinity(params.owned, params.affinity);
  const family = pickFamily(dist, params.rng);
  const mutation = pickForSlot(available, params.tier, family, params.rng);
  return { mutation, slot: params.slot, tier: params.tier };
}

/** Cards a Proto-Strand offers (DR-009b — a taste, not the full event). */
export const PROTO_STRAND_CARD_COUNT = 2;

/**
 * Proto-Strand draw (DR-009b, T-511): the Floor 2 early hook offers
 * {@link PROTO_STRAND_CARD_COUNT} **Minor-tier** cards with **uniform** family
 * sampling (the wild-slot distribution — at floor 2 there is no build yet to
 * weight toward). No reroll. Same determinism contract as the full draw: the
 * only entropy is the supplied `mutationdraw` sub-generator.
 */
export function drawProtoStrandCards(params: DrawMutationsParams): readonly DrawnCard[] {
  const { pool, owned, rng } = params;
  const excluded = new Set<string>(owned.map((m) => m.id));
  const cards: DrawnCard[] = [];
  for (let i = 0; i < PROTO_STRAND_CARD_COUNT; i++) {
    const card = drawOneCard({ pool, owned, excludeIds: excluded, slot: 'wild', tier: 'minor', rng });
    if (card === null) break; // pool exhausted — return fewer cards
    excluded.add(card.mutation.id);
    cards.push(card);
  }
  return cards;
}

export function drawMutationCards(params: DrawMutationsParams): readonly DrawnCard[] {
  const { pool, owned, rng } = params;
  const tiers = tiersForFloor(params.floor ?? 1); // Rule 3 — per-slot tier mix.

  // One growing exclude set enforces Rule 4 both ways: it starts with everything
  // the player owns and gains each card as it's drawn, so the offer never repeats
  // an owned mutation nor itself (T-87).
  const excluded = new Set<string>(owned.map((m) => m.id));
  const cards: DrawnCard[] = [];
  const weightedSlots = STRAND_CARD_COUNT - WILD_CARD_COUNT;

  for (let i = 0; i < STRAND_CARD_COUNT; i++) {
    const slot: DrawSlot = i < weightedSlots ? 'weighted' : 'wild';
    const tier = tiers[i] ?? 'minor';
    const card = drawOneCard({ pool, owned, excludeIds: excluded, slot, tier, rng, affinity: params.affinity });
    if (card === null) break; // pool exhausted — return fewer cards

    excluded.add(card.mutation.id);
    cards.push(card);
  }

  return cards;
}
