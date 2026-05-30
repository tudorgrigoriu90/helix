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
    expect(zonePriceMultiplier(5)).toBe(3); // 1 + 4·0.5
    expect(dispenserPrice('common', 5)).toBe(120); // 40 × 3
    expect(dispenserPrice('legendary', 5)).toBe(1800);
  });

  it('maps floors to six-floor zones', () => {
    expect(zoneForFloor(1)).toBe(1);
    expect(zoneForFloor(6)).toBe(1);
    expect(zoneForFloor(7)).toBe(2);
    expect(zoneForFloor(12)).toBe(2);
    expect(zoneForFloor(13)).toBe(3);
    expect(zoneForFloor(30)).toBe(5);
  });

  it('dispenserPriceForFloor derives the zone from the floor', () => {
    expect(dispenserPriceForFloor('common', 7)).toBe(dispenserPrice('common', 2)); // 60
    expect(dispenserPriceForFloor('rare', 30)).toBe(dispenserPrice('rare', 5));
  });

  it('price is monotonic in both rarity and zone', () => {
    const order: ItemRarity[] = ['common', 'uncommon', 'rare', 'legendary'];
    for (let i = 1; i < order.length; i++) {
      expect(dispenserPrice(order[i]!, 1)).toBeGreaterThan(dispenserPrice(order[i - 1]!, 1));
    }
    for (let z = 2; z <= 5; z++) {
      expect(dispenserPrice('rare', z)).toBeGreaterThan(dispenserPrice('rare', z - 1));
    }
  });
});
