import { describe, it, expect } from 'vitest';
import type { ItemDef, ItemRarity } from '@shared-types/item';
import { Mulberry32 } from '../rng/mulberry32';
import { rollItemDrops, rollLootRoomItem } from './item-drops';

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
      const out = rollItemDrops('zone_warden', POOL, new Mulberry32(seed));
      expect(out).toHaveLength(2);
      expect(['rare', 'legendary']).toContain(out[0]!.rarity);
    }
  });

  it('falls back to the whole pool when no item matches the band', () => {
    const onlyCommon = [item('c', 'common')];
    const out = rollItemDrops('zone_warden', onlyCommon, new Mulberry32(1)); // wants Rare+, none exist
    expect(out).toHaveLength(2);
    expect(out.every((i) => i.id === 'c')).toBe(true);
  });

  it('an empty pool drops nothing; rolls are deterministic per RNG state', () => {
    expect(rollItemDrops('zone_warden', [], new Mulberry32(1))).toEqual([]);
    expect(rollItemDrops('elite', POOL, new Mulberry32(9))).toEqual(rollItemDrops('elite', POOL, new Mulberry32(9)));
  });
});

describe('rollLootRoomItem — T-446 (GDD §9.4 floor-appropriate tier)', () => {
  it('floor 1 only yields Common (deeper tiers not unlocked yet)', () => {
    for (let seed = 0; seed < 80; seed++) {
      const item = rollLootRoomItem(1, POOL, new Mulberry32(seed));
      expect(item).toBeDefined();
      expect(item!.rarity).toBe('common');
    }
  });

  it('a mid floor unlocks rarer tiers while Common is still possible (floor 8)', () => {
    // One advancing RNG over many draws → a proper weighted distribution.
    const rng = new Mulberry32(0xc0ffee);
    const seen = new Set<string>();
    for (let i = 0; i < 300; i++) {
      const item = rollLootRoomItem(8, POOL, rng); // floor 8: common/uncommon/rare eligible (legendary not until 14)
      if (item) seen.add(item.rarity);
    }
    expect(seen.has('common')).toBe(true); // weighting still favours common
    expect([...seen].some((r) => r !== 'common')).toBe(true); // but uncommon/rare are reachable
    expect(seen.has('legendary')).toBe(false); // not in range yet (floors 14+)
  });

  it('a deep floor drops only the high tiers in range — no trash Commons (GDD §9.1 bands)', () => {
    for (let seed = 0; seed < 60; seed++) {
      const item = rollLootRoomItem(16, POOL, new Mulberry32(seed)); // floor 16: only rare/legendary
      expect(['rare', 'legendary']).toContain(item!.rarity);
    }
  });

  it('always returns one item for a non-empty pool; undefined for an empty pool; deterministic', () => {
    expect(rollLootRoomItem(1, [], new Mulberry32(1))).toBeUndefined();
    expect(rollLootRoomItem(5, POOL, new Mulberry32(3))).toEqual(rollLootRoomItem(5, POOL, new Mulberry32(3)));
  });
});
