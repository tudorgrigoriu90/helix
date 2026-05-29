import type { EntityStats } from '@shared-types/run-state';

/**
 * Per-floor difficulty scaling — T-78 (GDD §7.5).
 *
 * Enemy defs author their stats at the **Floor 1 baseline**; deeper floors
 * scale up from there. HP grows faster than offense/defense so fights get
 * spongier and more dangerous without spiking burst damage. AGI (crit) and INT
 * are left flat so crit odds and AI behaviour stay predictable as you descend.
 *
 *   factor(floor, perFloor) = 1 + max(0, floor - 1) * perFloor
 *   → Floor 1 = ×1.0 (authored), Floor 2 = +one step, …
 */

export const HP_SCALE_PER_FLOOR = 0.15;
export const STAT_SCALE_PER_FLOOR = 0.1;

function factor(floor: number, perFloor: number): number {
  return 1 + Math.max(0, floor - 1) * perFloor;
}

export function scaledMaxHp(baseMaxHp: number, floor: number): number {
  return Math.round(baseMaxHp * factor(floor, HP_SCALE_PER_FLOOR));
}

export function scaledStats(base: EntityStats, floor: number): EntityStats {
  const f = factor(floor, STAT_SCALE_PER_FLOOR);
  return {
    str: Math.round(base.str * f),
    res: Math.round(base.res * f),
    agi: base.agi,
    int: base.int,
  };
}
