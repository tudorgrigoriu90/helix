import type { EnemyTier } from '@shared-types/enemy';
import type { Mulberry32 } from '../rng/mulberry32';

/**
 * VEIN Crystal drops + per-kill loot rolls — T-106 (GDD §9.4, Economy.xlsx
 * "Drop Rates" + "Currencies").
 *
 * Per-kill VEIN is a flat amount per enemy tier (workbook drivers
 * `vein_*_amount`): grunt 8, elite 25, boss 120. A floor's *income* varies by
 * how many of each tier it holds plus a flat per-floor loot constant
 * (`vein_per_floor_constant = 50`), reproducing the workbook's PER-FLOOR INCOME
 * column (e.g. floor 1: 8·8 + 1.5·25 + 50 = 151.5 expected VEIN).
 *
 * Beyond VEIN, each kill rolls independent bonus drops (SIG / item mod / rare
 * core / epic core) at the per-tier probabilities from the Drop Rates tab. The
 * roll is deterministic given the `loot` sub-generator (TDD §6.1); its empirical
 * distribution is the chi-squared gate in T-109.
 */

/** Flat VEIN granted per kill, by enemy tier (Economy.xlsx drivers). */
export const VEIN_PER_KILL: Readonly<Record<EnemyTier, number>> = {
  grunt: 8,
  elite: 25,
  boss: 120,
};

/** Flat VEIN added to every floor's income (ambient loot; workbook constant). */
export const FLOOR_VEIN_CONSTANT = 50;

/** Per-tier drop probabilities for each bonus drop (Drop Rates tab). */
export interface DropRates {
  /** VEIN currency — always drops (probability 1). */
  readonly vein: number;
  /** A SIG shard. */
  readonly sig: number;
  /** An item modifier. */
  readonly mod: number;
  /** A rare item core. */
  readonly rareCore: number;
  /** An epic item core. */
  readonly epicCore: number;
}

export const DROP_RATES: Readonly<Record<EnemyTier, DropRates>> = {
  grunt: { vein: 1, sig: 0.2, mod: 0.05, rareCore: 0, epicCore: 0 },
  elite: { vein: 1, sig: 0.65, mod: 0.3, rareCore: 0.1, epicCore: 0 },
  boss: { vein: 1, sig: 1, mod: 0, rareCore: 0.6, epicCore: 0.15 },
};

/** VEIN granted for a single kill of `tier`. */
export function veinForKill(tier: EnemyTier): number {
  return VEIN_PER_KILL[tier];
}

/**
 * Expected VEIN income for a floor with `commons` grunt + `elites` elite kills
 * (fractional averages are fine), plus the boss on boss floors and the flat loot
 * constant. Matches the workbook's PER-FLOOR INCOME model.
 */
export function expectedFloorVein(commons: number, elites: number, hasBoss: boolean): number {
  return (
    commons * VEIN_PER_KILL.grunt +
    elites * VEIN_PER_KILL.elite +
    (hasBoss ? VEIN_PER_KILL.boss : 0) +
    FLOOR_VEIN_CONSTANT
  );
}

/** The drops yielded by one kill: guaranteed VEIN plus any rolled bonuses. */
export interface KillDrops {
  readonly vein: number;
  readonly sig: boolean;
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
    sig: rng.next() < rates.sig,
    mod: rng.next() < rates.mod,
    rareCore: rng.next() < rates.rareCore,
    epicCore: rng.next() < rates.epicCore,
  };
}
