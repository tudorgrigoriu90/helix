import { describe, it, expect } from 'vitest';
import type { ItemCategory, ItemDef } from '@shared-types/item';
import { SLOT_LIMITS, countInCategory, hasRoomFor, inventoryCounts, addItem, dropItem, swapItem } from './inventory';

let n = 0;
function item(category: ItemCategory, id = `i${n++}`): ItemDef {
  return { id, name: id, rarity: 'common', category, effect: null };
}
function fill(category: ItemCategory): ItemDef[] {
  return Array.from({ length: SLOT_LIMITS[category] }, () => item(category));
}

describe('inventory — T-443 slot model (GDD §9.5)', () => {
  it('uses the GDD capacities: 6 consumable / 3 passive / 2 equipment', () => {
    expect(SLOT_LIMITS).toEqual({ consumable: 6, passive: 3, equipment: 2 });
  });

  it('counts per category independently', () => {
    const items = [item('consumable'), item('consumable'), item('passive')];
    expect(countInCategory(items, 'consumable')).toBe(2);
    expect(countInCategory(items, 'passive')).toBe(1);
    expect(countInCategory(items, 'equipment')).toBe(0);
  });

  it('addItem adds while there is room and reports added:true', () => {
    const res = addItem([item('passive')], item('passive'));
    expect(res.added).toBe(true);
    expect(res.items).toHaveLength(2);
  });

  it('addItem refuses a full category (added:false, list unchanged) — caps are per-category', () => {
    const full = fill('equipment'); // 2 equipment
    const res = addItem(full, item('equipment'));
    expect(res.added).toBe(false);
    expect(res.items).toBe(full); // unchanged reference
    // A different category still has room even when another is full.
    expect(hasRoomFor(full, 'consumable')).toBe(true);
    expect(hasRoomFor(full, 'equipment')).toBe(false);
  });

  it('dropItem removes one instance by id (no-op when absent)', () => {
    const a = item('passive', 'a');
    const b = item('passive', 'b');
    expect(dropItem([a, b], 'a')).toEqual([b]);
    expect(dropItem([a, b], 'missing')).toEqual([a, b]);
  });

  it('swapItem drops one and adds the incoming — making room atomically', () => {
    const full = fill('equipment');
    const incoming = item('equipment', 'new');
    const after = swapItem(full, full[0]!.id, incoming);
    expect(after).toHaveLength(SLOT_LIMITS.equipment); // still at cap, not over
    expect(after.some((i) => i.id === 'new')).toBe(true);
    expect(after.some((i) => i.id === full[0]!.id)).toBe(false);
  });

  it('inventoryCounts reports count + limit per category (for the UI)', () => {
    const counts = inventoryCounts([item('consumable'), item('equipment')]);
    expect(counts.consumable).toEqual({ count: 1, limit: 6 });
    expect(counts.passive).toEqual({ count: 0, limit: 3 });
    expect(counts.equipment).toEqual({ count: 1, limit: 2 });
  });
});
