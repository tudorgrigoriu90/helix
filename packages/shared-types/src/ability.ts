import type { DamageType, StatusEffect } from './run-state.js';

export type AbilityTargetType = 'enemy' | 'self' | 'tile';

export interface AbilityDef {
  readonly id: string;
  /** AP cost, 1–3 (GDD §6.3). */
  readonly apCost: number;
  /** Cooldown in turns, 0–5 (GDD §6.3). */
  readonly cooldown: number;
  /** Reach in tiles (Chebyshev) from the player. 0 = self. */
  readonly range: number;
  readonly targetType: AbilityTargetType;
  /** Flat base damage before INT scaling. 0 for non-damaging abilities. */
  readonly baseDamage: number;
  readonly damageType: DamageType;
  /** Damage bonus = floor(INT × intScaling) (GDD §6.3 — "Scales with INT"). */
  readonly intScaling: number;
  /** Chebyshev splash radius around the target tile/enemy. 0 = single target. */
  readonly aoeRadius: number;
  readonly appliesStatus: StatusEffect | null;
  readonly statusDuration: number;
}

export interface AbilitySlot {
  readonly def: AbilityDef;
  /** Turns until usable again; 0 = ready. Decremented during turn flow. */
  readonly cooldownRemaining: number;
}
