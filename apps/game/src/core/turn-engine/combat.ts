import type { DamageType } from '@shared-types/run-state';
import type { Mulberry32 } from '../rng/mulberry32';

// ── Crit (GDD §6.6) ──────────────────────────────────────────────────────────
export const BASE_CRIT_CHANCE = 0.05;
export const CRIT_MULTIPLIER = 1.5;
export const BASE_AGI = 10;
/** Crit chance gained per point of AGI above base. Tunable pending Economy.xlsx balance pass. */
export const CRIT_PER_AGI_OVER_BASE = 0.005;

export function critChanceFor(agi: number): number {
  return BASE_CRIT_CHANCE + Math.max(0, agi - BASE_AGI) * CRIT_PER_AGI_OVER_BASE;
}

/** Consumes one rng draw. */
export function rollCrit(rng: Mulberry32, agi: number): boolean {
  return rng.next() < critChanceFor(agi);
}

export function applyCrit(damage: number, isCrit: boolean): number {
  return isCrit ? Math.floor(damage * CRIT_MULTIPLIER) : damage;
}

/** Flat RES mitigation (GDD §6.4). True damage ignores resistance. */
export function mitigate(raw: number, res: number, damageType: DamageType): number {
  const reduction = damageType === 'true' ? 0 : res;
  return Math.max(0, raw - reduction);
}

/**
 * Damage taken on entering a hazard tile (GDD §6.1 "Hazard — damage on entry").
 * Unmitigated `true` damage — it's the environment, not an attacker, so RES
 * doesn't help. Flat amount is authored tuning (the GDD names the rule, not the
 * number). Applies to any entity that steps onto a hazard, player or enemy.
 */
export const HAZARD_DAMAGE = 5;
