import { describe, it, expect } from 'vitest';
import type { ItemRarity } from '@shared-types/item';
import { rarityLook, rarityGlows } from './loot-reveal';

const ALL: ItemRarity[] = ['common', 'uncommon', 'rare', 'legendary'];

describe('rarityLook — T-180', () => {
  it('returns a treatment for every rarity', () => {
    for (const r of ALL) {
      const look = rarityLook(r);
      expect(typeof look.hex).toBe('number');
      expect(look.color).toMatch(/^#[0-9a-f]{6}$/);
      expect(look.label).toBe(r.toUpperCase());
    }
  });

  it('ranks rarer items higher', () => {
    const ranks = ALL.map((r) => rarityLook(r).rank);
    expect(ranks).toEqual([...ranks].sort((a, b) => a - b));
    expect(new Set(ranks).size).toBe(ALL.length);
  });

  it('scales glow up with rarity, with none for common', () => {
    expect(rarityLook('common').glow).toBe(0);
    expect(rarityLook('uncommon').glow).toBeGreaterThan(0);
    expect(rarityLook('legendary').glow).toBeGreaterThan(rarityLook('rare').glow);
  });

  it('derives the colour string from the hex', () => {
    expect(rarityLook('legendary').color).toBe('#ffb030');
  });

  it('gives each rarity a distinct accent colour', () => {
    expect(new Set(ALL.map((r) => rarityLook(r).hex)).size).toBe(ALL.length);
  });
});

describe('rarityGlows — T-180', () => {
  it('reserves the glowing reveal for rare and up', () => {
    expect(rarityGlows('common')).toBe(false);
    expect(rarityGlows('uncommon')).toBe(false);
    expect(rarityGlows('rare')).toBe(true);
    expect(rarityGlows('legendary')).toBe(true);
  });
});
