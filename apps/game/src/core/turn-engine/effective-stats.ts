import type { ActiveStatus, DamageType, EntityStats } from '@shared-types/run-state';
import { mitigate } from './combat';

/**
 * Effective-stats layer — the modifier half of the status system (GDD §6.5,
 * deferred from T-65). The damage/heal-over-time half lives in status-tick.ts;
 * this resolves the statuses that change how stats *read* during resolution:
 *
 *   - Infected  → −5 effective RES (take more damage)
 *   - Fractured → +20% damage taken
 *   - Stagger   → −1 effective max AP (player acts less; enemies act once
 *                 regardless, so it is a no-op on them by design)
 *   - Crushed   → immobilised (move-range 0), same as Rooted
 *
 * Pure + deterministic; consumed by the turn engine and enemy phase so every
 * damage/AP/move check reads through one place.
 */

const INFECTED_RES_PENALTY = 5;
const FRACTURED_DMG_TAKEN_MULT = 1.2;
const STAGGER_AP_PENALTY = 1;

interface Combatant {
  readonly stats: EntityStats;
  readonly statuses: readonly ActiveStatus[];
}

function has(statuses: readonly ActiveStatus[], effect: ActiveStatus['effect']): boolean {
  return statuses.some((s) => s.effect === effect);
}

/** RES after Infected, floored at 0. */
export function effectiveRes(c: Combatant): number {
  return Math.max(0, c.stats.res - (has(c.statuses, 'infected') ? INFECTED_RES_PENALTY : 0));
}

/** Multiplier on incoming damage (Fractured). */
export function damageTakenMultiplier(c: Combatant): number {
  return has(c.statuses, 'fractured') ? FRACTURED_DMG_TAKEN_MULT : 1;
}

/** Max AP after Stagger, floored at 0. */
export function effectiveMaxAp(c: { readonly maxAp: number; readonly statuses: readonly ActiveStatus[] }): number {
  return Math.max(0, c.maxAp - (has(c.statuses, 'stagger') ? STAGGER_AP_PENALTY : 0));
}

/** True while Rooted or Crushed (cannot move). */
export function isImmobilized(c: Combatant): boolean {
  return has(c.statuses, 'rooted') || has(c.statuses, 'crushed');
}

/**
 * Final damage dealt to `defender`: RES mitigation through {@link effectiveRes}
 * (Infected) then the Fractured multiplier. Floored at 0 — RES can fully block
 * an attack, matching the engine's base mitigation rule. `rawDamage` is the
 * pre-mitigation amount (crit already applied by the caller).
 */
export function damageTo(defender: Combatant, rawDamage: number, damageType: DamageType): number {
  const mitigated = mitigate(rawDamage, effectiveRes(defender), damageType);
  return Math.floor(mitigated * damageTakenMultiplier(defender));
}
