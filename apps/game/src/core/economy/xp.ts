import type { EntityStats } from '@shared-types/run-state';

/**
 * In-run XP & levelling curve — T-105 (GDD §4.3, Economy.xlsx "XP & Level Curve").
 *
 * The player gains XP from kills and levels up mid-run. The curve is geometric,
 * straight from the Economy workbook's drivers: `xp_base = 100`,
 * `xp_growth_per_level = 0.15`, so the XP needed to clear level L is
 * `round(100 · 1.15^(L−1))` — 100, 115, 132, 152, 175, …
 *
 * Per GDD §4.3 each level grants +10 HP and +1 stat point (AP does not scale),
 * and the in-run cap is **20** (one level per floor; the workbook's account-level
 * track runs to 60, but that's meta-progression, not the run). XP resets on
 * death and never carries between runs — the caller owns that lifecycle.
 */

/** Economy.xlsx driver: base XP to clear level 1. */
export const XP_BASE = 100;
/** Economy.xlsx driver: geometric growth per level. */
export const XP_GROWTH = 0.15;
/** In-run level cap (GDD §4.3 — one level per floor over 20 floors). */
export const RUN_LEVEL_CAP = 20;

/** Per-level reward (GDD §4.3). */
export interface LevelUpReward {
  readonly hp: number;
  readonly statPoints: number;
}

const LEVEL_UP_REWARD: LevelUpReward = { hp: 10, statPoints: 1 };

/** XP required to advance *from* `level` to the next (`round(100·1.15^(L−1))`). */
export function xpToNext(level: number): number {
  if (level < 1) throw new RangeError(`xpToNext: level must be ≥ 1 (got ${level})`);
  return Math.round(XP_BASE * (1 + XP_GROWTH) ** (level - 1));
}

/** Total XP needed to *reach* `level` from level 1 (cumulative; level 1 = 0). */
export function cumulativeXpForLevel(level: number): number {
  if (level < 1) throw new RangeError(`cumulativeXpForLevel: level must be ≥ 1 (got ${level})`);
  let total = 0;
  for (let l = 1; l < level; l++) total += xpToNext(l);
  return total;
}

/**
 * The level reached with `totalXp` accumulated this run, clamped to `cap`
 * (default {@link RUN_LEVEL_CAP}). Level 1 at 0 XP.
 */
export function levelForTotalXp(totalXp: number, cap: number = RUN_LEVEL_CAP): number {
  if (totalXp < 0) return 1;
  let level = 1;
  while (level < cap && totalXp >= cumulativeXpForLevel(level + 1)) level++;
  return level;
}

/** The reward granted on each level-up (GDD §4.3): +10 HP, +1 stat point. */
export function levelUpReward(): LevelUpReward {
  return LEVEL_UP_REWARD;
}

/** Convenience: which stat keys a level-up point may be spent on. */
export const ALLOCATABLE_STATS: readonly (keyof EntityStats)[] = ['str', 'res', 'agi', 'int'];
