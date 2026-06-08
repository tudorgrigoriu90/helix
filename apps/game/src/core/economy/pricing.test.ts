import { describe, it, expect } from 'vitest';
import type { ItemRarity } from '@shared-types/item';
import {
  dispenserPrice,
  dispenserPriceForFloor,
  zoneForFloor,
  zonePriceMultiplier,
  RARITY_VEIN_MULT,
  BASE_DISPENSER_VEIN,
} from './pricing';

describe('Dispenser pricing — T-108 (GDD §9 / §10.3, Economy.xlsx)', () => {
  it('rarity multipliers match the workbook rarity scale', () => {
    expect(RARITY_VEIN_MULT).toEqual({ common: 1, uncommon: 2.5, rare: 6, legendary: 15 });
    expect(BASE_DISPENSER_VEIN).toBe(40);
  });

  it('prices a Zone-1 item at base × rarity multiplier', () => {
    expect(dispenserPrice('common', 1)).toBe(40);
    expect(dispenserPrice('uncommon', 1)).toBe(100);
    expect(dispenserPrice('rare', 1)).toBe(240);
    expect(dispenserPrice('legendary', 1)).toBe(600);
  });

  it('scales price up with zone depth', () => {
    expect(zonePriceMultiplier(1)).toBe(1);
    expect(zonePriceMultiplier(4)).toBe(2.5); // 1 + 3·0.5 (deepest zone)
    expect(dispenserPrice('common', 4)).toBe(100); // 40 × 2.5
    expect(dispenserPrice('legendary', 4)).toBe(1500);
  });

  it('maps floors to five-floor zones (GDD §6 — 4 Zones × 5)', () => {
    expect(zoneForFloor(1)).toBe(1); // Shallows
    expect(zoneForFloor(5)).toBe(1);
    expect(zoneForFloor(6)).toBe(2); // Mycosphere
    expect(zoneForFloor(10)).toBe(2);
    expect(zoneForFloor(11)).toBe(3); // Lithic Deep
    expect(zoneForFloor(15)).toBe(3);
    expect(zoneForFloor(16)).toBe(4); // Convergence
    expect(zoneForFloor(20)).toBe(4);
  });

  it('dispenserPriceForFloor derives the zone from the floor', () => {
    expect(dispenserPriceForFloor('common', 6)).toBe(dispenserPrice('common', 2)); // 60
    expect(dispenserPriceForFloor('rare', 20)).toBe(dispenserPrice('rare', 4));
  });

  it('price is monotonic in both rarity and zone', () => {
    const order: ItemRarity[] = ['common', 'uncommon', 'rare', 'legendary'];
    for (let i = 1; i < order.length; i++) {
      expect(dispenserPrice(order[i]!, 1)).toBeGreaterThan(dispenserPrice(order[i - 1]!, 1));
    }
    for (let z = 2; z <= 4; z++) {
      expect(dispenserPrice('rare', z)).toBeGreaterThan(dispenserPrice('rare', z - 1));
    }
  });
});
