import type { ItemDef } from '@shared-types/item';

/**
 * Pure merchant-room pricing helpers (T-177, GDD §10.3).
 *
 * The VEIN Dispenser uses a rarity-based price band so the player always knows
 * the rough cost before entering a shop. Prices here are intentionally the same
 * amounts RunSession already uses (via `dispenserPriceOf`) — this module just
 * makes them testable and gives the UI a single source of truth for display.
 *
 * Kept Phaser-free so it can be unit-tested without a scene.
 */

/** Canonical VEIN prices by rarity, per GDD §10.3. */
export const DISPENSER_PRICES = {
  common: 20,
  uncommon: 35,
  rare: 55,
  legendary: 80,
} as const;

const FALLBACK_PRICE = 30;

/** VEIN price the Dispenser charges for an item. */
export function dispenserPrice(item: { readonly rarity: ItemDef['rarity'] }): number {
  return (DISPENSER_PRICES as Record<string, number>)[item.rarity] ?? FALLBACK_PRICE;
}

/** Copy for the affordability state of a shop row. */
export function affordLabel(price: number, held: number): string {
  if (held >= price) return `${price} VEIN`;
  return `${price} VEIN  (${price - held} short)`;
}

/** Whether the shop has at least one item the player can currently afford. */
export function anyAffordable(
  stock: readonly { readonly rarity: ItemDef['rarity'] }[],
  held: number,
): boolean {
  return stock.some((item) => held >= dispenserPrice(item));
}
