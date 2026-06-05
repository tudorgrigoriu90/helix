import { describe, it, expect } from 'vitest';
import { dispenserPrice, affordLabel, anyAffordable, DISPENSER_PRICES } from './merchant';

describe('dispenserPrice — T-177', () => {
  it('returns the correct price per rarity', () => {
    expect(dispenserPrice({ rarity: 'common' })).toBe(DISPENSER_PRICES['common']);
    expect(dispenserPrice({ rarity: 'uncommon' })).toBe(DISPENSER_PRICES['uncommon']);
    expect(dispenserPrice({ rarity: 'rare' })).toBe(DISPENSER_PRICES['rare']);
    expect(dispenserPrice({ rarity: 'legendary' })).toBe(DISPENSER_PRICES['legendary']);
  });

  it('prices escalate with rarity', () => {
    expect(dispenserPrice({ rarity: 'uncommon' })).toBeGreaterThan(dispenserPrice({ rarity: 'common' }));
    expect(dispenserPrice({ rarity: 'rare' })).toBeGreaterThan(dispenserPrice({ rarity: 'uncommon' }));
    expect(dispenserPrice({ rarity: 'legendary' })).toBeGreaterThan(dispenserPrice({ rarity: 'rare' }));
  });
});

describe('affordLabel — T-177', () => {
  it('shows the price when affordable', () => {
    const label = affordLabel(35, 40);
    expect(label).toContain('35 VEIN');
    expect(label).not.toContain('short');
  });

  it('shows the shortfall when not affordable', () => {
    const label = affordLabel(55, 30);
    expect(label).toContain('55 VEIN');
    expect(label).toContain('25 short');
  });

  it('shows the price (not short) when exactly affordable', () => {
    const label = affordLabel(20, 20);
    expect(label).toContain('20 VEIN');
    expect(label).not.toContain('short');
  });
});

describe('anyAffordable — T-177', () => {
  it('is true when the player can afford at least one item', () => {
    expect(anyAffordable([{ rarity: 'legendary' }, { rarity: 'common' }], 25)).toBe(true);
  });

  it('is false when the player cannot afford anything', () => {
    expect(anyAffordable([{ rarity: 'rare' }, { rarity: 'uncommon' }], 10)).toBe(false);
  });

  it('is false for an empty stock', () => {
    expect(anyAffordable([], 999)).toBe(false);
  });
});
