import type { ItemRarity } from '@shared-types/item';
import { FLOORS_PER_ZONE, zoneIndexForFloor } from '../campaign';

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
 * Zones are five floors each (`floors_per_zone = 5`, GDD §6 / Economy.xlsx
 * "Assumptions"), so Zone 1 = floors 1–5 (Shallows), Zone 2 = 6–10 (Mycosphere),
 * Zone 3 = 11–15 (Lithic Deep), Zone 4 = 16–20 (Convergence) — 4 zones over
 * 20 floors, matching the shipped floor content and the autoplay balance harness.
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
/** Floors per zone — canonical value lives in core/campaign (T-323). */
export { FLOORS_PER_ZONE };
/** Authored: each zone deeper adds this fraction of the base price. */
export const ZONE_PRICE_GROWTH = 0.5;

/** The 1-based zone a floor belongs to (Zone 1 = floors 1–5, …, Zone 4 = 16–20). */
export function zoneForFloor(floor: number): number {
  return zoneIndexForFloor(floor);
}

/** Price multiplier for `zone`: `1 + (zone−1)·0.5` (Zone 1 = ×1, Zone 4 = ×2.5). */
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
