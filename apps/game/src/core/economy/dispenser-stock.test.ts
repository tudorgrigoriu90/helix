import { describe, it, expect } from 'vitest';
import type { ItemDef } from '@shared-types/item';
import { makeRng } from '../rng/mulberry32';
import {
  rollDispenserStock,
  DISPENSER_MIN_STOCK,
  DISPENSER_MAX_STOCK,
} from './dispenser-stock';

function item(id: string): ItemDef {
  return { id, name: id, rarity: 'common', category: 'consumable', effect: null };
}

/** A pool large enough that 4–6 selection never exhausts it. */
const POOL: readonly ItemDef[] = Array.from({ length: 12 }, (_, i) => item(`item_${i}`));

describe('Dispenser stock selection — T-115b (GDD §10.3)', () => {
  it('stocks between 4 and 6 items from a large pool', () => {
    for (let seed = 0; seed < 200; seed++) {
      const stock = rollDispenserStock({ pool: POOL, rng: makeRng(seed, 'loot') });
      expect(stock.length).toBeGreaterThanOrEqual(DISPENSER_MIN_STOCK);
      expect(stock.length).toBeLessThanOrEqual(DISPENSER_MAX_STOCK);
    }
  });

  it('never repeats an item within a single stock', () => {
    for (let seed = 0; seed < 200; seed++) {
      const stock = rollDispenserStock({ pool: POOL, rng: makeRng(seed, 'loot') });
      expect(new Set(stock.map((s) => s.id)).size).toBe(stock.length);
    }
  });

  it('only stocks items that exist in the pool', () => {
    const ids = new Set(POOL.map((i) => i.id));
    const stock = rollDispenserStock({ pool: POOL, rng: makeRng(7, 'loot') });
    for (const s of stock) expect(ids.has(s.id)).toBe(true);
  });

  it('is deterministic for a given seed', () => {
    const a = rollDispenserStock({ pool: POOL, rng: makeRng(42, 'loot') });
    const b = rollDispenserStock({ pool: POOL, rng: makeRng(42, 'loot') });
    expect(a.map((i) => i.id)).toEqual(b.map((i) => i.id));
  });

  it('honours an explicit count', () => {
    const stock = rollDispenserStock({ pool: POOL, rng: makeRng(1, 'loot'), count: 3 });
    expect(stock).toHaveLength(3);
  });

  it('returns the whole pool (shuffled, distinct) when it is smaller than the target', () => {
    const small = [item('a'), item('b'), item('c')]; // 3 < min 4
    const stock = rollDispenserStock({ pool: small, rng: makeRng(5, 'loot') });
    expect(stock).toHaveLength(3);
    expect(new Set(stock.map((s) => s.id))).toEqual(new Set(['a', 'b', 'c']));
  });

  it('handles an empty pool without throwing', () => {
    expect(rollDispenserStock({ pool: [], rng: makeRng(0, 'loot') })).toEqual([]);
  });

  it('does not mutate the input pool', () => {
    const pool = [...POOL];
    const before = pool.map((i) => i.id);
    rollDispenserStock({ pool, rng: makeRng(9, 'loot') });
    expect(pool.map((i) => i.id)).toEqual(before);
  });

  it('eventually surfaces different items across seeds (selection varies)', () => {
    const first = new Set<string>();
    for (let seed = 0; seed < 30; seed++) {
      rollDispenserStock({ pool: POOL, rng: makeRng(seed, 'loot') }).forEach((i) => first.add(i.id));
    }
    // Across many seeds, more than one shelf's worth of distinct items appears.
    expect(first.size).toBeGreaterThan(DISPENSER_MAX_STOCK);
  });
});
