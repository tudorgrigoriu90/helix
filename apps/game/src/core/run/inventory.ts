import type { ItemCategory, ItemDef } from '@shared-types/item';

/**
 * Inventory model — slot capacity + add / drop / swap (T-443, GDD §9.5).
 *
 * Slots are *capacity counts per category*, not Heroes-3 body-part slots: the
 * player carries up to {@link SLOT_LIMITS} items of each kind, all active. Over
 * the cap you must drop one to make room (the drop-to-swap flow). Pure functions
 * over a `readonly ItemDef[]` so they're trivially testable; {@link RunSession}
 * wraps them as the run's mutating API, and the inventory UI (T-448) drives the
 * swap modal off {@link hasRoomFor} / {@link swapItem}.
 */

/** Per-category capacity (GDD §9.5): 6 consumables, 3 passives, 2 equipment. */
export const SLOT_LIMITS: Readonly<Record<ItemCategory, number>> = {
  consumable: 6,
  passive: 3,
  equipment: 2,
};

/** Extra capacity per category — the Sigma Echo Origin's +1 slot (T-307).
 *  Omitted / absent categories fall back to the baseline limit. */
export type SlotBonus = Readonly<Partial<Record<ItemCategory, number>>>;

/** The effective capacity of `category` for this run. */
export function slotLimit(category: ItemCategory, bonus?: SlotBonus): number {
  return SLOT_LIMITS[category] + (bonus?.[category] ?? 0);
}

/** How many items of `category` are currently carried. */
export function countInCategory(items: readonly ItemDef[], category: ItemCategory): number {
  return items.reduce((n, i) => (i.category === category ? n + 1 : n), 0);
}

/** True when `category` has a free slot. */
export function hasRoomFor(items: readonly ItemDef[], category: ItemCategory, bonus?: SlotBonus): boolean {
  return countInCategory(items, category) < slotLimit(category, bonus);
}

/** Per-category `{ count, limit }` — what the inventory/swap UI renders. */
export function inventoryCounts(items: readonly ItemDef[], bonus?: SlotBonus): Record<ItemCategory, { count: number; limit: number }> {
  const cats: ItemCategory[] = ['consumable', 'passive', 'equipment'];
  const out = {} as Record<ItemCategory, { count: number; limit: number }>;
  for (const c of cats) out[c] = { count: countInCategory(items, c), limit: slotLimit(c, bonus) };
  return out;
}

/** Adds `item` if its category has room; returns the new list + whether it landed. */
export function addItem(items: readonly ItemDef[], item: ItemDef, bonus?: SlotBonus): { items: readonly ItemDef[]; added: boolean } {
  if (!hasRoomFor(items, item.category, bonus)) return { items, added: false };
  return { items: [...items, item], added: true };
}

/** Removes the first item with `itemId` (no-op if absent). */
export function dropItem(items: readonly ItemDef[], itemId: string): readonly ItemDef[] {
  const idx = items.findIndex((i) => i.id === itemId);
  return idx === -1 ? items : items.filter((_, i) => i !== idx);
}

/** Drops `dropId` then adds `incoming` — the atomic make-room swap (model b). */
export function swapItem(items: readonly ItemDef[], dropId: string, incoming: ItemDef): readonly ItemDef[] {
  return [...dropItem(items, dropId), incoming];
}
