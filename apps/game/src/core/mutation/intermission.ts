/**
 * VEIN Intermission trigger — T-93 (GDD §3.5 / §4.2, UFD S071).
 *
 * A run holds at most **four mutations** (the SIG-cap consequence: 3 Strand +
 * 1 LACE-event = 40 SIG; §4.2). Once the player is at the cap, a Strand Event no
 * longer offers a card — it becomes a **VEIN Intermission**: no draw, a flat
 * **+100 VEIN Crystals**, and LACE's "saturation" line. This module is the gate
 * the Strand-Event flow consults before drawing: capped → intermission, else
 * proceed to the card draw (T-85).
 */

/** Maximum mutations a run can hold (GDD §4.2). */
export const MUTATION_CAP = 4;

/** VEIN Crystals awarded by a VEIN Intermission in place of a mutation. */
export const VEIN_INTERMISSION_REWARD_VC = 100;

export type StrandOutcome =
  | { readonly kind: 'draw' }
  | { readonly kind: 'intermission'; readonly veinCrystals: number };

/** True once the player is at the mutation cap and can hold no more. */
export function isMutationCapped(mutationCount: number): boolean {
  return mutationCount >= MUTATION_CAP;
}

/**
 * Resolves what a Strand Event does for a player holding `mutationCount`
 * mutations: a normal card draw, or — at the cap — a VEIN Intermission paying
 * {@link VEIN_INTERMISSION_REWARD_VC} VEIN Crystals instead.
 */
export function resolveStrandEvent(mutationCount: number): StrandOutcome {
  return isMutationCapped(mutationCount)
    ? { kind: 'intermission', veinCrystals: VEIN_INTERMISSION_REWARD_VC }
    : { kind: 'draw' };
}
