import type { ActiveStatus, DamageType, EntityStats } from '@shared-types/run-state';
import type { MutationFamily } from '@shared-types/mutation';
import { mitigate } from './combat';

/**
 * Effective-stats layer — the modifier half of the status system (GDD §6.5,
 * deferred from T-65) plus the stat-shaped Dominant Trait effects (GDD §5.5).
 * The damage/heal-over-time half lives in status-tick.ts; this resolves what
 * changes how stats *read* during resolution:
 *
 *   - Infected  → −5 effective RES (take more damage)
 *   - Fractured → +20% damage taken
 *   - Stagger   → −1 effective max AP (player acts less; enemies act once
 *                 regardless, so it is a no-op on them by design)
 *   - Crushed   → immobilised (move-range 0), same as Rooted
 *   - Fortress Form (Lithic dominant)   → +10 effective RES
 *   - Combustion Engine (Thermal dom.)  → +2 effective max AP
 *
 * Pure + deterministic; consumed by the turn engine and enemy phase so every
 * damage/AP/move check reads through one place. Trait bonuses key off the
 * player's precomputed `dominantTraits` (enemies never carry it).
 */

const INFECTED_RES_PENALTY = 5;
const FRACTURED_DMG_TAKEN_MULT = 1.2;
const STAGGER_AP_PENALTY = 1;
/** Fortress Form (Lithic dominant): +10 RES (GDD §5.5). */
const FORTRESS_RES_BONUS = 10;
/** Combustion Engine (Thermal dominant): +2 AP per turn (GDD §5.5). */
const COMBUSTION_AP_BONUS = 2;

interface Combatant {
  readonly stats: EntityStats;
  readonly statuses: readonly ActiveStatus[];
  /** Active Dominant Trait families (player only; enemies omit it). */
  readonly dominantTraits?: readonly MutationFamily[];
}

function has(statuses: readonly ActiveStatus[], effect: ActiveStatus['effect']): boolean {
  return statuses.some((s) => s.effect === effect);
}

/** True when this combatant has the given family's Dominant Trait active. */
export function hasDominantTrait(
  c: { readonly dominantTraits?: readonly MutationFamily[] },
  family: MutationFamily,
): boolean {
  return c.dominantTraits?.includes(family) ?? false;
}

/** RES after Infected (−) and Fortress Form (+), floored at 0. */
export function effectiveRes(c: Combatant): number {
  const infected = has(c.statuses, 'infected') ? INFECTED_RES_PENALTY : 0;
  const fortress = hasDominantTrait(c, 'lithic') ? FORTRESS_RES_BONUS : 0;
  return Math.max(0, c.stats.res - infected + fortress);
}

/** Multiplier on incoming damage (Fractured). */
export function damageTakenMultiplier(c: Combatant): number {
  return has(c.statuses, 'fractured') ? FRACTURED_DMG_TAKEN_MULT : 1;
}

/** Max AP after Stagger (−) and Combustion Engine (+), floored at 0. */
export function effectiveMaxAp(c: {
  readonly maxAp: number;
  readonly statuses: readonly ActiveStatus[];
  readonly dominantTraits?: readonly MutationFamily[];
}): number {
  const stagger = has(c.statuses, 'stagger') ? STAGGER_AP_PENALTY : 0;
  const combustion = hasDominantTrait(c, 'thermal') ? COMBUSTION_AP_BONUS : 0;
  return Math.max(0, c.maxAp - stagger + combustion);
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
