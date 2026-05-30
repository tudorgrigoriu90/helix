import type { ItemRarity } from '@shared-types/item';

/**
 * VEIN Dispenser pricing — T-108 (GDD §9 / §10.3, Economy.xlsx).
 *
 * The Dispenser sells items for VEIN Crystals; prices rise with item **rarity**
 * and with **zone** depth. The rarity multipliers reuse the workbook's
 * "Mutation Costs" rarity scale (common 1 / uncommon 2.5 / rare 6 / epic→
 * legendary 15) so item and upgrade economies stay coherent. The flat base price
 * and the per-zone growth aren't enumerated in the sheet (no item-price tab), so
 * they're authored here at sensible defaults relative to floor income
 * (~150 VEIN/floor): a common in Zone 1 costs ~¼ of a floor's take.
 *
 * Zones are six floors each (`floors_per_zone = 6` from the Drop Rates tab), so
 * Zone 1 = floors 1–6, Zone 2 = 7–12, … (5 zones over 30 floors).
 */

/** VEIN multiplier per item rarity (workbook "Mutation Costs" rarity scale). */
export const RARITY_VEIN_MULT: Readonly<Record<ItemRarity, number>> = {
  common: 1,
  uncommon: 2.5,
  rare: 6,
  legendary: 15,
};

/** Authored: VEIN price of a Common item in Zone 1 (~¼ of a floor's income). */
export const BASE_DISPENSER_VEIN = 40;
/** Floors per zone (Economy.xlsx "Drop Rates" driver). */
export const FLOORS_PER_ZONE = 6;
/** Authored: each zone deeper adds this fraction of the base price. */
export const ZONE_PRICE_GROWTH = 0.5;

/** The 1-based zone a floor belongs to (Zone 1 = floors 1–6, …). */
export function zoneForFloor(floor: number): number {
  return Math.max(1, Math.ceil(floor / FLOORS_PER_ZONE));
}

/** Price multiplier for `zone`: `1 + (zone−1)·0.5` (Zone 1 = ×1, Zone 5 = ×3). */
export function zonePriceMultiplier(zone: number): number {
  return 1 + (Math.max(1, zone) - 1) * ZONE_PRICE_GROWTH;
}

/** Dispenser price (VEIN) for `rarity` in `zone`. */
export function dispenserPrice(rarity: ItemRarity, zone: number): number {
  return Math.round(BASE_DISPENSER_VEIN * RARITY_VEIN_MULT[rarity] * zonePriceMultiplier(zone));
}

/** Dispenser price (VEIN) for `rarity` on a given `floor` (zone derived from it). */
export function dispenserPriceForFloor(rarity: ItemRarity, floor: number): number {
  return dispenserPrice(rarity, zoneForFloor(floor));
}
