import type { ActiveStatus, DamageResist, DamageType, EntityStats } from '@shared-types/run-state';
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
  /** Typed percent resists from the run's Origin (T-301; player only). */
  readonly resists?: readonly DamageResist[];
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
 * Chip-damage floor: any *connecting* damaging hit deals at least this much,
 * regardless of RES. Flat mitigation (GDD §6.4) is `raw − RES`, which means a
 * defender whose RES meets or beats the attacker's STR takes nothing at all —
 * e.g. a Floor-1 grunt (STR 6) against the default loadout (RES 6) was dealing a
 * literal zero every turn, so low-tier enemies could never threaten the player.
 * A 1-point floor keeps every landed hit meaningful while RES still does the
 * heavy lifting. Non-damaging effects (rawDamage ≤ 0, e.g. pure-status
 * abilities) are exempt — the floor only applies to hits that intend to hurt.
 */
export const MIN_CONNECT_DAMAGE = 1;

/**
 * Final damage dealt to `defender`: RES mitigation through {@link effectiveRes}
 * (Infected) then the Fractured multiplier, with a {@link MIN_CONNECT_DAMAGE}
 * chip floor so a connecting hit is never fully nullified. `rawDamage` is the
 * pre-mitigation amount (crit already applied by the caller); a non-positive
 * `rawDamage` is a no-op and returns 0 (no phantom chip from a 0-damage call).
 */
export function damageTo(defender: Combatant, rawDamage: number, damageType: DamageType): number {
  if (rawDamage <= 0) return 0;
  const mitigated = mitigate(rawDamage, effectiveRes(defender), damageType);
  // Typed resists (Origin T-301, Sigma Strains T-306): percent off the matching
  // damage type, after flat RES, before Fractured. Same-type sources stack
  // additively, capped at 100. 'true' damage stays beyond resists by definition.
  const resist = damageType === 'true'
    ? 0
    : Math.min(
        100,
        (defender.resists ?? []).reduce(
          (sum, r) => (r.damageType === damageType ? sum + r.percent : sum),
          0,
        ),
      );
  // A summed 100 is full immunity (T-307, Volcanologist) — the only case the
  // chip floor yields: an immune hit connects for nothing at all.
  if (resist >= 100) return 0;
  const resisted = resist > 0 ? Math.floor(mitigated * (1 - resist / 100)) : mitigated;
  const final = Math.floor(resisted * damageTakenMultiplier(defender));
  return Math.max(MIN_CONNECT_DAMAGE, final);
}
