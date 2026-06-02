import type { DamageType, EntityStats, StatusEffect } from './run-state.js';

export type ItemCategory = 'consumable' | 'passive' | 'equipment';

/**
 * Always-on stat effect of a passive/equipment item (GDD §9.2 — e.g. Depth Gauge
 * +10 HP, Fault Liner +5 RES). Same shape as a mutation modifier: applied when
 * the item is equipped (carried) and reversed when it's dropped. `delta` may be
 * negative (cursed items, T-449). Consumables use `effect`, not `modifiers`.
 */
export type ItemModifier =
  | { readonly kind: 'stat'; readonly stat: keyof EntityStats; readonly delta: number }
  | { readonly kind: 'maxHp'; readonly delta: number }
  | { readonly kind: 'maxAp'; readonly delta: number };

/** Drop-rarity band (GDD §9.2). Drives drop tables + Dispenser pricing. */
export type ItemRarity = 'common' | 'uncommon' | 'rare' | 'legendary';

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

/**
 * An item as it lives in inventory (`PlayerState.items`) — and therefore in the
 * save file. The on-disk content file carries an extra `schemaVersion` for
 * migrations, which the loader (T-284) validates and strips; it is intentionally
 * absent here to keep RunState lean (NFR P8 "save every turn"). `name`/`rarity`
 * are kept because the UI shows them straight from inventory.
 */
export interface ItemDef {
  readonly id: string;
  readonly name: string;
  readonly rarity: ItemRarity;
  readonly category: ItemCategory;
  /** Use-effect for consumables; null for passive/equipment. */
  readonly effect: ItemEffect | null;
  /**
   * Always-on stat modifiers, applied while the item is carried (passives +
   * equipment, T-444). Absent/empty for plain consumables. Reversed on drop.
   */
  readonly modifiers?: readonly ItemModifier[];
}

/** Current item-content schema version. Increment when the on-disk shape changes. */
export const CURRENT_ITEM_SCHEMA_VERSION = 1;
