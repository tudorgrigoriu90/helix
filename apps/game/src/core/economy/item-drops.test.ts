import { describe, it, expect } from 'vitest';
import type { ItemDef, ItemRarity } from '@shared-types/item';
import { Mulberry32 } from '../rng/mulberry32';
import { rollItemDrops } from './item-drops';

const item = (id: string, rarity: ItemRarity): ItemDef => ({ id, name: id, rarity, category: 'consumable', effect: null });
const POOL: readonly ItemDef[] = [
  item('c1', 'common'), item('c2', 'common'),
  item('u1', 'uncommon'), item('r1', 'rare'), item('l1', 'legendary'),
];

describe('rollItemDrops — T-445 (GDD §9.4)', () => {
  it('a grunt drops 0 or 1 Common item (≈50% over many rolls)', () => {
    let drops = 0;
    for (let seed = 0; seed < 400; seed++) {
      const out = rollItemDrops('grunt', POOL, new Mulberry32(seed));
      expect(out.length).toBeLessThanOrEqual(1);
      for (const i of out) expect(i.rarity).toBe('common');
      drops += out.length;
    }
    expect(drops / 400).toBeGreaterThan(0.4);
    expect(drops / 400).toBeLessThan(0.6);
  });

  it('an elite always drops 1 Uncommon/Rare item', () => {
    for (let seed = 0; seed < 50; seed++) {
      const out = rollItemDrops('elite', POOL, new Mulberry32(seed));
      expect(out).toHaveLength(1);
      expect(['uncommon', 'rare']).toContain(out[0]!.rarity);
    }
  });

  it('a boss always drops 2 items, the first guaranteed Rare+', () => {
    for (let seed = 0; seed < 50; seed++) {
      const out = rollItemDrops('boss', POOL, new Mulberry32(seed));
      expect(out).toHaveLength(2);
      expect(['rare', 'legendary']).toContain(out[0]!.rarity);
    }
  });

  it('falls back to the whole pool when no item matches the band', () => {
    const onlyCommon = [item('c', 'common')];
    const out = rollItemDrops('boss', onlyCommon, new Mulberry32(1)); // wants Rare+, none exist
    expect(out).toHaveLength(2);
    expect(out.every((i) => i.id === 'c')).toBe(true);
  });

  it('an empty pool drops nothing; rolls are deterministic per RNG state', () => {
    expect(rollItemDrops('boss', [], new Mulberry32(1))).toEqual([]);
    expect(rollItemDrops('elite', POOL, new Mulberry32(9))).toEqual(rollItemDrops('elite', POOL, new Mulberry32(9)));
  });
});
