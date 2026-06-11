import type { BossTier, EnemyTier } from '@shared-types/enemy';
import type { Mulberry32 } from '../rng/mulberry32';

/**
 * VEIN Crystal drops + per-kill loot rolls — T-106 (GDD §9.4, Economy.xlsx
 * "Drop Rates" + "Currencies").
 *
 * Per-kill VEIN is a flat amount per enemy tier (workbook drivers
 * `vein_*_amount`): grunt 8, elite 25, boss tiers per DR-008. A floor's *income* varies by
 * how many of each tier it holds plus a flat per-floor loot constant
 * (`vein_per_floor_constant = 50`), reproducing the workbook's PER-FLOOR INCOME
 * column (e.g. floor 1: 8·8 + 1.5·25 + 50 = 151.5 expected VEIN).
 *
 * Beyond VEIN, each kill rolls independent bonus drops (item mod / rare core /
 * epic core) at the per-tier probabilities from the Drop Rates tab. The roll is
 * deterministic given the `loot` sub-generator (TDD §6.1); its empirical
 * distribution is the chi-squared gate in T-109.
 *
 * The SIG bonus drop that previously rode along here was removed (T-500,
 * DR-007): SIG is run-scoped and granted solely by acquired mutations
 * (`core/mutation/sig.ts` `sigBonus`), never by kills — the drop was a vestige
 * of the abandoned SIG-as-currency model and its result was never consumed.
 */

/** Flat VEIN granted per kill, by enemy tier (Economy.xlsx drivers). Both boss
 *  tiers (DR-008 split, T-501) pay the historical boss amount until the T-502
 *  economy split lands the per-tier values. */
export const VEIN_PER_KILL: Readonly<Record<EnemyTier, number>> = {
  grunt: 8,
  elite: 25,
  floor_boss: 120,
  zone_warden: 120,
};

/** Flat VEIN added to every floor's income (ambient loot; workbook constant). */
export const FLOOR_VEIN_CONSTANT = 50;

/** Per-tier drop probabilities for each bonus drop (Drop Rates tab). */
export interface DropRates {
  /** VEIN currency — always drops (probability 1). */
  readonly vein: number;
  /** An item modifier. */
  readonly mod: number;
  /** A rare item core. */
  readonly rareCore: number;
  /** An epic item core. */
  readonly epicCore: number;
}

export const DROP_RATES: Readonly<Record<EnemyTier, DropRates>> = {
  grunt: { vein: 1, mod: 0.05, rareCore: 0, epicCore: 0 },
  elite: { vein: 1, mod: 0.3, rareCore: 0.1, epicCore: 0 },
  floor_boss: { vein: 1, mod: 0, rareCore: 0.6, epicCore: 0.15 },
  zone_warden: { vein: 1, mod: 0, rareCore: 0.6, epicCore: 0.15 },
};

/** VEIN granted for a single kill of `tier`. */
export function veinForKill(tier: EnemyTier): number {
  return VEIN_PER_KILL[tier];
}

/**
 * Expected VEIN income for a floor with `commons` grunt + `elites` elite kills
 * (fractional averages are fine), plus the floor's boss at its tier (every
 * floor has one under DR-008; `null` models a boss left unkilled) and the flat
 * loot constant. Matches the workbook's PER-FLOOR INCOME model.
 */
export function expectedFloorVein(commons: number, elites: number, boss: BossTier | null): number {
  return (
    commons * VEIN_PER_KILL.grunt +
    elites * VEIN_PER_KILL.elite +
    (boss === null ? 0 : VEIN_PER_KILL[boss]) +
    FLOOR_VEIN_CONSTANT
  );
}

/** The drops yielded by one kill: guaranteed VEIN plus any rolled bonuses. */
export interface KillDrops {
  readonly vein: number;
  readonly mod: boolean;
  readonly rareCore: boolean;
  readonly epicCore: boolean;
}

/**
 * Rolls one kill's drops against the tier's {@link DROP_RATES}. VEIN is always
 * granted at the tier amount; each bonus is an independent Bernoulli draw from
 * the supplied `loot` sub-generator (deterministic).
 */
export function rollKillDrops(tier: EnemyTier, rng: Mulberry32): KillDrops {
  const rates = DROP_RATES[tier];
  return {
    vein: VEIN_PER_KILL[tier],
    mod: rng.next() < rates.mod,
    rareCore: rng.next() < rates.rareCore,
    epicCore: rng.next() < rates.epicCore,
  };
}
