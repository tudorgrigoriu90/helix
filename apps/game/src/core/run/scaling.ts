import type { EntityStats } from '@shared-types/run-state';

/**
 * Per-floor difficulty scaling — T-78 (GDD §7.5).
 *
 * Enemy defs author their stats at their **zone's baseline** (deeper zones are
 * authored stronger); the per-floor multiplier compounds on top. HP and STR
 * scale (enemies get tankier and hit harder), but RES is left flat — the
 * player's damage output does not scale, so scaling enemy RES too would make
 * deep enemies unkillable (double time-to-kill penalty). AGI (crit) and INT
 * are also flat so crit odds and AI stay predictable.
 *
 *   factor(floor, perFloor) = 1 + max(0, floor - 1) * perFloor
 *   → Floor 1 = ×1.0 (authored), Floor 2 = +one step, …
 *
 * Rates re-tuned with T-324 (was 0.15 / 0.10): because the authored zone ramp
 * already compounds with this multiplier, the original rates put the Floor-20
 * clear rate at 0% for the harness's competent policy — the endings, the five
 * finales, and Convergence content were unreachable (review finding F5). At
 * 0.12 / 0.065 the harness curve descends 97 / 95 / 90 / 50 / 5% across
 * F1/F5/F10/F15/F20 — punishing but reachable, inside the T-324 band.
 */

export const HP_SCALE_PER_FLOOR = 0.12;
export const STAT_SCALE_PER_FLOOR = 0.065;

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
