import type { DamageType, StatusEffect } from './run-state.js';

export type ItemCategory = 'consumable' | 'passive' | 'equipment';

/**
 * Effect produced when a consumable is used (GDD §9.2). Passives/equipment
 * have no use-effect (they are equipped, handled elsewhere).
 *
 * AoE consumables (grenades) target a tile; `aoeRadius` is Chebyshev distance
 * (0 = single tile). Exact shapes like "2×2" / "line" are approximated by
 * radius for now — shape tuning is a content concern.
 */
export type ItemEffect =
  | { readonly kind: 'heal'; readonly amount: number }
  | { readonly kind: 'damage'; readonly amount: number; readonly damageType: DamageType; readonly aoeRadius: number }
  | { readonly kind: 'applyStatus'; readonly status: StatusEffect; readonly duration: number; readonly aoeRadius: number };

export interface ItemDef {
  readonly id: string;
  readonly category: ItemCategory;
  /** Use-effect for consumables; null for passive/equipment. */
  readonly effect: ItemEffect | null;
}
