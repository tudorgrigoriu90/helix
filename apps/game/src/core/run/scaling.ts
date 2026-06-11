import type { EntityStats } from '@shared-types/run-state';

/**
 * Per-floor difficulty scaling — T-78 (GDD §7.5).
 *
 * Enemy defs author their stats at the **Floor 1 baseline**; deeper floors
 * scale up from there. HP and STR scale (enemies get tankier and hit harder),
 * but RES is left flat — the player's damage output does not scale, so scaling
 * enemy RES too would make deep enemies unkillable (double time-to-kill penalty).
 * AGI (crit) and INT are also flat so crit odds and AI stay predictable.
 *
 *   factor(floor, perFloor) = 1 + max(0, floor - 1) * perFloor
 *   → Floor 1 = ×1.0 (authored), Floor 2 = +one step, …
 */

/*
 * Retuned 2026-06-11 (T-524): at the original 0.15/0.10 the competent-policy
 * harness cleared Floor 15+ at exactly 0% — the five endings behind Floor 20
 * were unreachable. 0.08/0.06 (with a light Zone-4 STR pass on the
 * true-damage hitters) lands the curve at F1 98% / F5 98% / F10 57% /
 * F15 20% / F20 8%: still steeply punishing, but the Convergence is reachable
 * (balance.test.ts enforces the [2%, 30%] Floor-20 band).
 */
export const HP_SCALE_PER_FLOOR = 0.08;
export const STAT_SCALE_PER_FLOOR = 0.06;

function factor(floor: number, perFloor: number): number {
  return 1 + Math.max(0, floor - 1) * perFloor;
}

export function scaledMaxHp(baseMaxHp: number, floor: number): number {
  return Math.round(baseMaxHp * factor(floor, HP_SCALE_PER_FLOOR));
}

export function scaledStats(base: EntityStats, floor: number): EntityStats {
  return {
    str: Math.round(base.str * factor(floor, STAT_SCALE_PER_FLOOR)),
    res: base.res, // flat — see module note
    agi: base.agi,
    int: base.int,
  };
}
