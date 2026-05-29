import type { MutationDef } from '@shared-types/mutation';
import type { Mulberry32 } from '../rng/mulberry32';
import { drawOneCard, type DrawnCard } from './card-draw';

/**
 * Strand Event reroll — T-89 (GDD §5.4 Rule 5).
 *
 * A Strand Event grants one reroll that replaces **a single player-chosen card**
 * (the others are kept). The replacement keeps the rerolled card's slot and tier
 * and is drawn from the **same `mutationdraw` sub-stream** — `rng` here is the
 * very generator that produced the initial offer, now advanced — so a run that
 * records the RNG state reproduces the reroll exactly (Rule 5's determinism
 * guarantee, TDD §6.1).
 *
 * The replacement avoids everything the player owns *and* every other card still
 * on the table (kept cards stay distinct), and avoids the rerolled card itself,
 * so a reroll changes the offer whenever any alternative exists. When nothing
 * else is available the offer is returned unchanged.
 */

export interface RerollParams {
  /** The three cards currently offered. */
  readonly offer: readonly DrawnCard[];
  /** Index of the card to reroll. */
  readonly index: number;
  /** The full mutation registry. */
  readonly pool: readonly MutationDef[];
  /** Mutations the player owns (excluded; also feeds weighted-slot weighting). */
  readonly owned: readonly MutationDef[];
  /** The live `mutationdraw` sub-generator (same stream as the initial draw). */
  readonly rng: Mulberry32;
}

export function rerollCard(params: RerollParams): readonly DrawnCard[] {
  const { offer, index, pool, owned, rng } = params;

  const target = offer[index];
  if (target === undefined) {
    throw new RangeError(`rerollCard: index ${index} out of range (offer has ${offer.length} cards)`);
  }

  // Exclude owned + every card currently on the table (including the one being
  // rerolled), so the replacement is distinct from both kept cards and itself.
  const excludeIds = new Set<string>(owned.map((m) => m.id));
  for (const c of offer) excludeIds.add(c.mutation.id);

  const replacement = drawOneCard({
    pool,
    owned,
    excludeIds,
    slot: target.slot,
    tier: target.tier,
    rng,
  });
  if (replacement === null) return offer; // nothing left to swap in

  return offer.map((c, i) => (i === index ? replacement : c));
}
