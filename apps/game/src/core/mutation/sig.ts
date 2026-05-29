import type { MutationDef } from '@shared-types/mutation';

/**
 * Sigma Resonance (SIG) accrual — T-94 (GDD §4.2, Patch 11).
 *
 * SIG accumulates across a run as mutations are acquired and amplifies their
 * passive effects. It is **capped at 40** and never resets between floors. How
 * much a mutation grants depends on *where* it came from:
 *
 *   - **Strand Event** mutations grant their own `sigBonus` (the content authors
 *     this — typically +10; 3 Strand picks ≈ +30).
 *   - **LACE event-room** mutations grant a flat **+5** regardless of `sigBonus`
 *     (Patch 11 fix — these are "free" extra mutations, so they're worth less
 *     SIG; max one per run).
 *
 * Pure value helpers — SIG lives at run scope (the run loop threads the running
 * total), not on `PlayerState`.
 */

/** Maximum Sigma Resonance a run can reach (GDD §4.2). */
export const SIG_CAP = 40;

/** SIG granted by a mutation taken from a LACE event room (Patch 11). */
export const LACE_EVENT_SIG_BONUS = 5;

/** Where a mutation was acquired — sets how much SIG it grants. */
export type SigSource = 'strand' | 'lace_event';

/** SIG a mutation grants from `source`: Strand → its `sigBonus`; LACE event → flat +5. */
export function sigBonusFor(mutation: MutationDef, source: SigSource): number {
  return source === 'lace_event' ? LACE_EVENT_SIG_BONUS : mutation.sigBonus;
}

/** Adds `bonus` SIG to the current total, clamped to `[0, SIG_CAP]`. */
export function accumulateSig(currentSig: number, bonus: number): number {
  return Math.max(0, Math.min(SIG_CAP, currentSig + bonus));
}

/** Accrues a mutation's SIG (from `source`) onto the running total, capped at 40. */
export function gainMutationSig(currentSig: number, mutation: MutationDef, source: SigSource): number {
  return accumulateSig(currentSig, sigBonusFor(mutation, source));
}
