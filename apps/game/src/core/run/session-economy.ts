import type { EnemyState, EntityStats } from '@shared-types/run-state';
import type { ItemDef, ItemCategory } from '@shared-types/item';
import { makeRng } from '../rng/mulberry32';
import {
  veinForKill,
  xpForKill,
  levelForTotalXp,
  levelUpReward,
  ALLOCATABLE_STATS,
  dispenserPriceForFloor,
  rollDispenserStock,
  rollItemDrops,
  rollLootRoomItem,
} from '../economy';
import type { EnemyRegistry } from './encounter';
import {
  addItem as addToInventory,
  dropItem as dropFromInventory,
  swapItem as swapInInventory,
  hasRoomFor,
  inventoryCounts,
} from './inventory';
import { equipItem, unequipItem } from './item-effects';
import { hashString, roomById, type SessionConfig, type SessionState } from './run-session-types';

/**
 * Run-session economy subsystem (T-520): kill rewards (VEIN/XP/levels), the
 * VEIN Dispenser, the inventory wrappers, and the pending-loot pickup flow.
 * Pure delegation target of the {@link import('./run-session').RunSession}
 * facade — same behaviour as the pre-decomposition monolith.
 */

/** Sums the VEIN dropped by the fallen enemies of a cleared encounter (T-106). */
export function veinFromKills(enemies: readonly EnemyState[], registry: EnemyRegistry): number {
  let total = 0;
  for (const e of enemies) {
    if (e.hp > 0) continue; // only the fallen pay out
    const tier = registry.get(e.enemyDefId)?.tier;
    if (tier !== undefined) total += veinForKill(tier);
  }
  return total;
}

/** Sums the XP granted by the fallen enemies of a cleared encounter (T-111). */
export function xpFromKills(enemies: readonly EnemyState[], registry: EnemyRegistry): number {
  let total = 0;
  for (const e of enemies) {
    if (e.hp > 0) continue; // only the fallen grant XP
    const tier = registry.get(e.enemyDefId)?.tier;
    if (tier !== undefined) total += xpForKill(tier);
  }
  return total;
}

/** Banks VEIN income: raises both the spendable balance and the lifetime
 *  earned total (the latter drives the run-end Shard conversion, T-113). */
export function bankVein(st: SessionState, amount: number): void {
  if (amount <= 0) return;
  st.veinCrystals += amount;
  st.veinEarned += amount;
}

/**
 * Adds run XP and applies any resulting level-ups (GDD §4.3): each level grants
 * +10 HP (raising max and current) and banks +1 stat point for the player to
 * allocate via {@link allocateStatPoint}. Level is clamped to the run cap by
 * `levelForTotalXp`, so XP past level 20 accrues without further rewards.
 */
export function grantXp(st: SessionState, amount: number): void {
  if (amount <= 0) return;
  const before = levelForTotalXp(st.xp);
  st.xp += amount;
  const gained = levelForTotalXp(st.xp) - before;
  if (gained <= 0) return;
  const reward = levelUpReward();
  const hpGain = gained * reward.hp;
  st.player = {
    ...st.player,
    maxHp: st.player.maxHp + hpGain,
    hp: st.player.hp + hpGain,
  };
  st.pendingStatPoints += gained * reward.statPoints;
}

/**
 * Spends one pending level-up point on a stat (GDD §4.3 stat-allocation UI).
 * Throws if there are no pending points or the stat isn't allocatable.
 */
export function allocateStatPoint(st: SessionState, stat: keyof EntityStats): void {
  if (st.pendingStatPoints <= 0) {
    throw new Error('allocateStatPoint: no pending stat points');
  }
  if (!ALLOCATABLE_STATS.includes(stat)) {
    throw new Error(`allocateStatPoint: "${String(stat)}" is not an allocatable stat`);
  }
  st.pendingStatPoints -= 1;
  st.player = {
    ...st.player,
    stats: { ...st.player.stats, [stat]: st.player.stats[stat] + 1 },
  };
}

// ── VEIN Dispenser (GDD §10.3) ────────────────────────────────────────────────

/** True when the player stands at a VEIN Dispenser (a merchant room). */
export function isAtDispenser(st: SessionState): boolean {
  return roomById(st, st.current).type === 'merchant';
}

/** VEIN price of `item` at the current floor's Dispenser (T-108 zoned pricing). */
export function dispenserPriceOf(st: SessionState, item: ItemDef): number {
  return dispenserPriceForFloor(item.rarity, st.floorNumber);
}

/**
 * The current merchant room's stock (GDD §10.3: 4–6 items from the floor's
 * item pool, T-115b). Empty unless the player is at a Dispenser and an item
 * pool was supplied. Computed once per room (deterministic from seed + floor +
 * room) and cached, so it's stable across reads and refreshes once per floor.
 */
export function dispenserStock(cfg: SessionConfig, st: SessionState): readonly ItemDef[] {
  if (!isAtDispenser(st) || cfg.itemPool.length === 0) return [];
  const cached = st.dispenserStockByRoom.get(st.current);
  if (cached !== undefined) return cached;
  const seed =
    (cfg.masterSeed ^ Math.imul(st.floorNumber, 0xc2b2ae35) ^ hashString(st.current)) >>> 0;
  const stock = rollDispenserStock({ pool: cfg.itemPool, rng: makeRng(seed, 'loot') });
  st.dispenserStockByRoom.set(st.current, stock);
  return stock;
}

/**
 * Buys `item` from the VEIN Dispenser (GDD §10.3): deducts the floor-zoned
 * price from the run's VEIN and adds it to the player's inventory. Throws if
 * VEIN is insufficient, the inventory category is full (GDD §9.5), or if
 * called mid-combat.
 */
export function purchaseItem(st: SessionState, item: ItemDef): void {
  if (st.status === 'in_combat') {
    throw new Error('purchaseItem: cannot trade during combat');
  }
  const price = dispenserPriceOf(st, item);
  if (st.veinCrystals < price) {
    throw new Error(`purchaseItem: insufficient VEIN (need ${price}, have ${st.veinCrystals})`);
  }
  if (!canCarry(st, item)) {
    throw new Error(`purchaseItem: inventory full for "${item.category}" (GDD §9.5)`);
  }
  st.veinCrystals -= price;
  addItem(st, item);
  // Sold items leave the shelf so they can't be bought twice (GDD §10.3).
  const stock = st.dispenserStockByRoom.get(st.current);
  if (stock !== undefined) {
    const idx = stock.findIndex((s) => s.id === item.id);
    if (idx !== -1) st.dispenserStockByRoom.set(st.current, stock.filter((_, i) => i !== idx));
  }
}

// ── Inventory (GDD §9.5 — capacity slots, drop-to-swap) ──────────────────────

/** Per-category `{ count, limit }` for the inventory / swap UI (T-448). */
export function inventory(st: SessionState): Record<ItemCategory, { count: number; limit: number }> {
  return inventoryCounts(st.player.items);
}

/** True when `item`'s category has a free slot. Callers offer a swap when false. */
export function canCarry(st: SessionState, item: ItemDef): boolean {
  return hasRoomFor(st.player.items, item.category);
}

/** Adds `item` if its category has room, folding in its passive modifiers
 *  (T-444). Returns false when full (→ caller offers a swap). */
export function addItem(st: SessionState, item: ItemDef): boolean {
  const res = addToInventory(st.player.items, item);
  if (res.added) st.player = { ...equipItem(st.player, item), items: res.items };
  return res.added;
}

/** True unless the item is cursed — a cursed item can't be dropped (GDD §9.3). */
export function canDrop(st: SessionState, itemId: string): boolean {
  const item = st.player.items.find((i) => i.id === itemId);
  return item !== undefined && item.cursed !== true;
}

/** Drops the first item with `itemId` (no-op if absent or cursed), reversing
 *  its modifiers. Cursed items stay put until run end / Purge Serum (T-449). */
export function dropItem(st: SessionState, itemId: string): void {
  const dropped = st.player.items.find((i) => i.id === itemId);
  if (dropped === undefined || dropped.cursed === true) return;
  const player = unequipItem(st.player, dropped);
  st.player = { ...player, items: dropFromInventory(player.items, itemId) };
}

/** Drops `dropId` and adds `incoming` in one step — the make-room swap (model b),
 *  reversing the dropped item's modifiers and folding in the incoming one's. A
 *  no-op if `dropId` is cursed (it can't be swapped out). */
export function swapItem(st: SessionState, dropId: string, incoming: ItemDef): void {
  const dropped = st.player.items.find((i) => i.id === dropId);
  if (dropped !== undefined && dropped.cursed === true) return;
  let player = dropped !== undefined ? unequipItem(st.player, dropped) : st.player;
  player = equipItem(player, incoming);
  st.player = { ...player, items: swapInInventory(player.items, dropId, incoming) };
}

/** Removes all cursed items (the Purge Serum effect, GDD §9.3), reversing their
 *  modifiers. The only way to shed a curse mid-run. */
export function purgeCursed(st: SessionState): void {
  let player = st.player;
  for (const item of player.items.filter((i) => i.cursed === true)) {
    player = { ...unequipItem(player, item), items: dropFromInventory(player.items, item.id) };
  }
  st.player = player;
}

// ── Loot pickup (T-445/T-446) ─────────────────────────────────────────────────

/** On first entry to a loot room, drop 1 guaranteed floor-tier item onto the
 *  pending-pickup pile (GDD §9.4, T-446). The `cleared` guard + auto-clear make
 *  it fire exactly once per room. No-op without an item pool. */
export function grantLootRoom(cfg: SessionConfig, st: SessionState, roomId: string): void {
  if (cfg.itemPool.length === 0 || st.cleared.has(roomId)) return;
  if (roomById(st, roomId).type !== 'loot') return;
  const rng = makeRng((cfg.masterSeed ^ Math.imul(st.floorNumber, 0x165667b1) ^ hashString(roomId)) >>> 0, 'loot');
  const item = rollLootRoomItem(st.floorNumber, cfg.itemPool, rng);
  if (item !== undefined) st.pendingLoot.push(item);
}

/** Rolls item drops for the fallen enemies onto the pending-pickup pile. */
export function rollKillLoot(cfg: SessionConfig, st: SessionState, enemies: readonly EnemyState[]): void {
  if (cfg.itemPool.length === 0) return; // no item content → no drops
  const rng = makeRng((cfg.masterSeed ^ Math.imul(st.floorNumber, 0x27d4eb2f) ^ hashString(st.current)) >>> 0, 'loot');
  for (const e of enemies) {
    if (e.hp > 0) continue; // only the fallen drop
    const tier = cfg.registry.get(e.enemyDefId)?.tier;
    if (tier !== undefined) st.pendingLoot.push(...rollItemDrops(tier, cfg.itemPool, rng));
  }
}

/**
 * Picks up a pending item: adds it (consuming the pending entry), or — when its
 * category is full — swaps it for `swapDropId`. Returns `needsSwap` when full
 * and no `swapDropId` was given, so the UI can open the drop-to-swap modal.
 */
export function takeLoot(
  st: SessionState,
  itemId: string,
  swapDropId?: string,
): { readonly taken: boolean; readonly needsSwap: boolean } {
  const idx = st.pendingLoot.findIndex((i) => i.id === itemId);
  if (idx === -1) return { taken: false, needsSwap: false };
  const item = st.pendingLoot[idx]!;
  if (canCarry(st, item)) {
    addItem(st, item);
  } else if (swapDropId !== undefined) {
    swapItem(st, swapDropId, item);
  } else {
    return { taken: false, needsSwap: true }; // full → caller opens the swap modal
  }
  st.pendingLoot.splice(idx, 1);
  return { taken: true, needsSwap: false };
}
