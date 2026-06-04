import type { FloorTemplate } from '@shared-types/floor-template';
import type { PopulatedFloor, PopulatedRoom } from '@shared-types/floor-plan';
import type { EnemyState, EntityStats, PlayerState, RunState } from '@shared-types/run-state';
import type { MutationDef } from '@shared-types/mutation';
import type { ItemDef } from '@shared-types/item';
import { Mulberry32, makeRng } from '../rng/mulberry32';
import { buildAdjacency, generateFloor } from '../floor-gen';
import {
  drawMutationCards,
  rerollCard,
  applyMutation,
  resolveStrandEvent,
  gainMutationSig,
  unlockedDominantTraits,
  type DrawnCard,
  type StrandOutcome,
} from '../mutation';
import { buildEncounterState, type EnemyRegistry } from './encounter';
import { newRunPlayer } from './start-player';
import {
  addItem as addToInventory,
  dropItem as dropFromInventory,
  swapItem as swapInInventory,
  hasRoomFor,
  inventoryCounts,
} from './inventory';
import { equipItem, unequipItem } from './item-effects';
import type { ItemCategory } from '@shared-types/item';
import {
  veinForKill,
  FLOOR_VEIN_CONSTANT,
  xpForKill,
  levelForTotalXp,
  levelUpReward,
  ALLOCATABLE_STATS,
  dispenserPriceForFloor,
  rollDispenserStock,
  rollItemDrops,
  rollLootRoomItem,
} from '../economy';

/**
 * Run session — the run-loop state machine that strings generated rooms into a
 * descent. Holds the persistent player (hp/items/abilities carry between rooms),
 * the current floor, and where the player stands on its room graph.
 *
 * The scene drives it: read {@link RunSession.snapshot} + {@link adjacentRooms}
 * to render, call {@link moveTo} on player choice, {@link beginEncounter} to get
 * a combat RunState (null = the room needs no fight and is auto-cleared), run
 * combat through the TurnEngine, then {@link endEncounter} with the terminal
 * state. Clearing the boss room ends the floor; {@link descend} generates the
 * next. Fully deterministic from the master seed.
 */

const FINAL_FLOOR_DEFAULT = 20;
/** A Strand Event fires after clearing the boss of every Nth floor (GDD §5). */
const STRAND_INTERVAL_DEFAULT = 5;
/** Fraction of max HP restored on entering a Safe Room (UFD S026, GDD §6.1). */
export const SAFE_ROOM_HEAL_FRACTION = 0.25;

export type RunStatus =
  | 'exploring'
  | 'in_combat'
  | 'strand_event'
  | 'floor_complete'
  | 'victory'
  | 'defeat';

export interface RunSnapshot {
  readonly status: RunStatus;
  readonly floorNumber: number;
  readonly currentRoomId: string;
  readonly clearedRoomIds: readonly string[];
  readonly player: PlayerState;
  /** Sigma Resonance accrued this run (GDD §4.2; capped at 40). */
  readonly sig: number;
  /** VEIN Crystals currently spendable this run (drained by Dispenser buys). */
  readonly veinCrystals: number;
  /** Total VEIN *earned* this run (income, never spent) — drives Shard conversion. */
  readonly veinEarned: number;
  /** Cumulative XP earned this run (GDD §4.3). */
  readonly xp: number;
  /** Current in-run level, derived from {@link xp} (1–20). */
  readonly level: number;
  /** Unspent level-up stat points awaiting allocation (GDD §4.3). */
  readonly pendingStatPoints: number;
}

/** Schema version for the persisted run-session shape.
 *  v2 added `sig` + `veinCrystals`; v3 added `xp` + `pendingStatPoints`;
 *  v4 added `veinEarned`; v5 added mid-combat persistence (`combat` +
 *  `combatRngState`); v6 added `pendingLoot` (uncollected drops). Older saves
 *  load fine — missing fields default to 0/none. */
export const CURRENT_RUN_SESSION_SAVE_VERSION = 6;

/**
 * Everything needed to resume a run. The floor graph itself is *not* stored — it
 * regenerates deterministically from `seed` + `floorNumber` — so a save is just
 * the seed, where the player is, which rooms are cleared, and the carried player.
 */
export interface RunSessionSave {
  readonly schemaVersion: number;
  readonly seed: number;
  readonly floorNumber: number;
  readonly currentRoomId: string;
  readonly clearedRoomIds: readonly string[];
  readonly status: RunStatus;
  readonly player: PlayerState;
  /** Sigma Resonance (added in save v2; absent in v1 saves → treated as 0). */
  readonly sig?: number;
  /** VEIN Crystals (added in save v2; absent in v1 saves → treated as 0). */
  readonly veinCrystals?: number;
  /** Cumulative run XP (added in save v3; absent in older saves → 0). */
  readonly xp?: number;
  /** Unspent level-up stat points (added in save v3; absent → 0). */
  readonly pendingStatPoints?: number;
  /** Lifetime VEIN earned this run (added in save v4; absent → 0). */
  readonly veinEarned?: number;
  /** Uncollected drops awaiting pickup (added in save v6; absent → none). */
  readonly pendingLoot?: readonly ItemDef[];
  /**
   * The live combat state, present only when `status === 'in_combat'` and the
   * scene has synced it via {@link RunSession.syncCombat} (save v5). Its presence
   * is what lets a run resume *mid-fight* rather than re-entering the room. Absent
   * → the run resumes exploring at `currentRoomId` (the pre-v5 behaviour).
   */
  readonly combat?: RunState;
  /** The combat RNG's state word at save time, so crit/AI rolls stay deterministic
   *  across the resume (NFR P2). Paired with {@link combat}; added in save v5. */
  readonly combatRngState?: number;
}

export interface RunSessionOptions {
  readonly seed: number;
  readonly template: FloorTemplate;
  readonly registry: EnemyRegistry;
  readonly player?: PlayerState;
  /** Boss kill on this floor wins the run (default 20). */
  readonly finalFloor?: number;
  /**
   * The mutation draw pool. When non-empty, clearing a qualifying floor's boss
   * triggers a Strand Event (GDD §5); when empty (the default), Strand Events are
   * disabled and the run loop behaves exactly as before.
   */
  readonly mutations?: readonly MutationDef[];
  /** Strand Event cadence — fires every Nth floor's boss clear (default 5). */
  readonly strandEventEveryNFloors?: number;
  /**
   * The item pool a floor's VEIN Dispensers stock from (GDD §10.3). When empty
   * (the default), merchant rooms offer nothing and {@link RunSession.dispenserStock}
   * returns `[]` — the run loop is otherwise unchanged.
   */
  readonly itemPool?: readonly ItemDef[];
  /**
   * The hardcoded Floor 0 (T-137). When supplied, the run *starts on floor 0*
   * using this fixed floor instead of generating — the tutorial descent (TDD
   * §21 Q4). Floor 1+ still generate procedurally on {@link RunSession.descend}.
   * Omit it (the default) for a normal run that starts on floor 1.
   */
  readonly floorZero?: PopulatedFloor;
}

/** Sums the VEIN dropped by the fallen enemies of a cleared encounter (T-106). */
function veinFromKills(enemies: readonly EnemyState[], registry: EnemyRegistry): number {
  let total = 0;
  for (const e of enemies) {
    if (e.hp > 0) continue; // only the fallen pay out
    const tier = registry.get(e.enemyDefId)?.tier;
    if (tier !== undefined) total += veinForKill(tier);
  }
  return total;
}

/** Sums the XP granted by the fallen enemies of a cleared encounter (T-111). */
function xpFromKills(enemies: readonly EnemyState[], registry: EnemyRegistry): number {
  let total = 0;
  for (const e of enemies) {
    if (e.hp > 0) continue; // only the fallen grant XP
    const tier = registry.get(e.enemyDefId)?.tier;
    if (tier !== undefined) total += xpForKill(tier);
  }
  return total;
}

function hashString(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = (Math.imul(h, 33) ^ s.charCodeAt(i)) >>> 0;
  return h >>> 0;
}

export class RunSession {
  private readonly masterSeed: number;
  private readonly template: FloorTemplate;
  private readonly registry: EnemyRegistry;
  private readonly finalFloor: number;
  private readonly mutationPool: readonly MutationDef[];
  private readonly strandInterval: number;
  private readonly itemPool: readonly ItemDef[];
  // The fixed tutorial floor (T-137), or null for a normal procedural run.
  private readonly floorZero: PopulatedFloor | null;

  // Dispenser stock per merchant room, keyed by room id. Computed once per room
  // (deterministically) and reset each floor — GDD §10.3 "refresh once per floor".
  private dispenserStockByRoom = new Map<string, ItemDef[]>();

  private floorNumber = 1;
  private floorData!: PopulatedFloor;
  private adjacency!: Map<string, string[]>;
  private current!: string;
  private cleared!: Set<string>;
  private status: RunStatus = 'exploring';
  private player: PlayerState;

  // Run-scoped progression state (carries across floors, never resets mid-run).
  private sig = 0;
  private veinCrystals = 0;
  private xp = 0;
  private pendingStatPoints = 0;
  // Lifetime VEIN income this run (never decremented by purchases) — drives the
  // run-end Shard conversion (T-113), which is based on income, not held balance.
  private veinEarned = 0;
  // Transient per-Strand-Event state (regenerated deterministically on resume).
  private strandRng: Mulberry32 | null = null;
  private strandOutcome: StrandOutcome | null = null;
  private strandCards: readonly DrawnCard[] = [];
  // Live combat state, kept current by the scene via syncCombat so a save can
  // resume mid-fight (T-114). Null whenever the run isn't in an active encounter.
  private combatState: RunState | null = null;
  private combatRngState = 0;
  // Drops rolled on kills / loot rooms awaiting pickup (T-445/T-446). Consumed by
  // the pickup flow (takeLoot); persisted so a reload doesn't lose them.
  private pendingLoot: ItemDef[] = [];

  constructor(options: RunSessionOptions) {
    this.masterSeed = options.seed;
    this.template = options.template;
    this.registry = options.registry;
    this.finalFloor = options.finalFloor ?? FINAL_FLOOR_DEFAULT;
    this.mutationPool = options.mutations ?? [];
    this.strandInterval = options.strandEventEveryNFloors ?? STRAND_INTERVAL_DEFAULT;
    this.itemPool = options.itemPool ?? [];
    this.floorZero = options.floorZero ?? null;
    this.player = options.player ?? newRunPlayer();
    // A tutorial run begins on the hardcoded floor 0; a normal run on floor 1.
    this.loadFloor(this.floorZero !== null ? 0 : 1);
  }

  // ── Read API ────────────────────────────────────────────────────────────

  get snapshot(): RunSnapshot {
    return {
      status: this.status,
      floorNumber: this.floorNumber,
      currentRoomId: this.current,
      clearedRoomIds: [...this.cleared],
      player: this.player,
      sig: this.sig,
      veinCrystals: this.veinCrystals,
      veinEarned: this.veinEarned,
      xp: this.xp,
      level: levelForTotalXp(this.xp),
      pendingStatPoints: this.pendingStatPoints,
    };
  }

  get floor(): PopulatedFloor {
    return this.floorData;
  }

  /**
   * Serialisable snapshot for save/resume. When the scene has synced a live
   * encounter (T-114), an in-combat save carries the full combat state so the
   * run resumes mid-fight; otherwise an in-combat save degrades to resuming at
   * the room (exploring). A Strand Event is preserved — its offer regenerates
   * deterministically on resume.
   */
  toSave(): RunSessionSave {
    const persistCombat = this.status === 'in_combat' && this.combatState !== null;
    return {
      schemaVersion: CURRENT_RUN_SESSION_SAVE_VERSION,
      seed: this.masterSeed,
      floorNumber: this.floorNumber,
      currentRoomId: this.current,
      clearedRoomIds: [...this.cleared],
      status: this.status === 'in_combat' && !persistCombat ? 'exploring' : this.status,
      player: this.player,
      sig: this.sig,
      veinCrystals: this.veinCrystals,
      veinEarned: this.veinEarned,
      xp: this.xp,
      pendingStatPoints: this.pendingStatPoints,
      ...(persistCombat ? { combat: this.combatState!, combatRngState: this.combatRngState } : {}),
      ...(this.pendingLoot.length > 0 ? { pendingLoot: [...this.pendingLoot] } : {}),
    };
  }

  /** Restores a saved run: regenerates the floor deterministically, then
   *  overlays the saved position, cleared set, player, status, currencies, and —
   *  when present — the live combat encounter (T-114). */
  applySave(save: RunSessionSave): void {
    this.loadFloor(save.floorNumber);
    this.current = save.currentRoomId;
    this.cleared = new Set(save.clearedRoomIds);
    this.player = save.player;
    this.sig = save.sig ?? 0; // absent in v1 saves
    this.veinCrystals = save.veinCrystals ?? 0;
    this.xp = save.xp ?? 0; // absent in pre-v3 saves
    this.pendingStatPoints = save.pendingStatPoints ?? 0;
    // Pre-v4 saves lack veinEarned; fall back to the spendable balance as a
    // lower-bound estimate of income so resumed runs still convert some Shards.
    this.veinEarned = save.veinEarned ?? this.veinCrystals;
    this.pendingLoot = save.pendingLoot !== undefined ? [...save.pendingLoot] : [];
    // A mid-combat save (v5+) carries the encounter; restore it so the run
    // resumes mid-fight. Otherwise an in-combat status degrades to exploring.
    if (save.status === 'in_combat' && save.combat !== undefined) {
      this.status = 'in_combat';
      this.combatState = save.combat;
      this.combatRngState = (save.combatRngState ?? 0) >>> 0;
    } else {
      this.status = save.status === 'in_combat' ? 'exploring' : save.status;
      this.combatState = null;
      this.combatRngState = 0;
    }
  }

  currentRoom(): PopulatedRoom {
    return this.roomById(this.current);
  }

  /** Rooms the player can step to right now (empty unless exploring). */
  adjacentRooms(): string[] {
    if (this.status !== 'exploring') return [];
    return this.adjacency.get(this.current) ?? [];
  }

  /** True when the current room holds a fight the player hasn't cleared yet. */
  needsCombat(): boolean {
    return !this.cleared.has(this.current) && this.currentRoom().enemies.length > 0;
  }

  // ── Transitions ─────────────────────────────────────────────────────────

  moveTo(roomId: string): void {
    if (this.status !== 'exploring') {
      throw new Error(`moveTo: can only move while exploring (status: ${this.status})`);
    }
    if (!(this.adjacency.get(this.current) ?? []).includes(roomId)) {
      throw new Error(`moveTo: "${roomId}" is not adjacent to "${this.current}"`);
    }
    this.current = roomId;
    this.grantLootRoom(this.current); // before auto-clear (which marks it looted)
    this.autoClearIfTrivial(this.current);
    this.restIfSafe(this.current);
  }

  /** On first entry to a loot room, drop 1 guaranteed floor-tier item onto the
   *  pending-pickup pile (GDD §9.4, T-446). The `cleared` guard + auto-clear make
   *  it fire exactly once per room. No-op without an item pool. */
  private grantLootRoom(roomId: string): void {
    if (this.itemPool.length === 0 || this.cleared.has(roomId)) return;
    if (this.roomById(roomId).type !== 'loot') return;
    const rng = makeRng((this.masterSeed ^ Math.imul(this.floorNumber, 0x165667b1) ^ hashString(roomId)) >>> 0, 'loot');
    const item = rollLootRoomItem(this.floorNumber, this.itemPool, rng);
    if (item !== undefined) this.addPendingLoot(item);
  }

  /**
   * Builds the combat RunState for the current room, or returns null if the
   * room needs no fight (already cleared / no enemies). On a real encounter the
   * session enters `in_combat` until {@link endEncounter}.
   */
  beginEncounter(): RunState | null {
    if (this.status !== 'exploring') {
      throw new Error(`beginEncounter: not exploring (status: ${this.status})`);
    }
    if (!this.needsCombat()) return null;
    this.status = 'in_combat';
    const seed =
      (this.masterSeed ^ Math.imul(this.floorNumber, 0x85ebca6b) ^ hashString(this.current)) >>> 0;
    return buildEncounterState({
      room: this.currentRoom(),
      registry: this.registry,
      player: this.player,
      floorNumber: this.floorNumber,
      seed,
    });
  }

  /**
   * The save-on-action hook (T-114, TDD §5.5): the scene calls this after every
   * combat action with the new state and the combat RNG's state word, so a save
   * taken mid-fight captures exact progress (and resumes deterministically).
   */
  syncCombat(state: RunState, rngState: number): void {
    if (this.status !== 'in_combat') {
      throw new Error(`syncCombat: not in combat (status: ${this.status})`);
    }
    this.combatState = state;
    this.combatRngState = rngState >>> 0;
  }

  /** The live encounter to resume after a mid-combat restore, or null if none.
   *  The scene rebuilds its combat RNG from `rngState` and re-enters the fight. */
  activeCombat(): { readonly state: RunState; readonly rngState: number } | null {
    return this.combatState === null ? null : { state: this.combatState, rngState: this.combatRngState };
  }

  /** Applies a terminal combat result: carry the player, clear the room, or end the run. */
  endEncounter(finalState: RunState): void {
    if (this.status !== 'in_combat') {
      throw new Error(`endEncounter: not in combat (status: ${this.status})`);
    }
    // The encounter is over — drop the persisted combat state.
    this.combatState = null;
    this.combatRngState = 0;
    if (finalState.phase === 'defeat') {
      this.player = finalState.player;
      this.status = 'defeat';
      return;
    }
    if (finalState.phase !== 'floor_complete' && finalState.phase !== 'victory') {
      throw new Error(`endEncounter: combat is not terminal (phase: ${finalState.phase})`);
    }

    // Win: persist the player (statuses don't survive leaving the room), clear the room.
    this.player = { ...finalState.player, statuses: [] };
    this.cleared.add(this.current);

    // Kill rewards (Economy.xlsx): every defeated enemy drops VEIN (T-110) and
    // grants XP (T-111) by tier.
    this.bankVein(veinFromKills(finalState.enemies, this.registry));
    this.grantXp(xpFromKills(finalState.enemies, this.registry));
    // Item drops (T-445, GDD §9.4): roll loot per fallen enemy from the floor
    // pool onto the pending-pickup pile (consumed by the pickup flow, T-447).
    this.rollKillLoot(finalState.enemies);

    if (this.current === this.floorData.bossRoomId) {
      // Floor loot: the ambient per-floor VEIN constant (loot rooms, GDD §9) banks
      // once the floor's boss falls.
      this.bankVein(FLOOR_VEIN_CONSTANT);
      if (this.floorNumber >= this.finalFloor) this.status = 'victory';
      else if (this.strandEventDue()) this.status = 'strand_event';
      else this.status = 'floor_complete';
    } else {
      this.status = 'exploring';
    }
  }

  /**
   * Adds run XP and applies any resulting level-ups (GDD §4.3): each level grants
   * +10 HP (raising max and current) and banks +1 stat point for the player to
   * allocate via {@link allocateStatPoint}. Level is clamped to the run cap by
   * {@link levelForTotalXp}, so XP past level 20 accrues without further rewards.
   */
  private grantXp(amount: number): void {
    if (amount <= 0) return;
    const before = levelForTotalXp(this.xp);
    this.xp += amount;
    const gained = levelForTotalXp(this.xp) - before;
    if (gained <= 0) return;
    const reward = levelUpReward();
    const hpGain = gained * reward.hp;
    this.player = {
      ...this.player,
      maxHp: this.player.maxHp + hpGain,
      hp: this.player.hp + hpGain,
    };
    this.pendingStatPoints += gained * reward.statPoints;
  }

  /**
   * Spends one pending level-up point on a stat (GDD §4.3 stat-allocation UI).
   * Throws if there are no pending points or the stat isn't allocatable.
   */
  allocateStatPoint(stat: keyof EntityStats): void {
    if (this.pendingStatPoints <= 0) {
      throw new Error('allocateStatPoint: no pending stat points');
    }
    if (!ALLOCATABLE_STATS.includes(stat)) {
      throw new Error(`allocateStatPoint: "${String(stat)}" is not an allocatable stat`);
    }
    this.pendingStatPoints -= 1;
    this.player = {
      ...this.player,
      stats: { ...this.player.stats, [stat]: this.player.stats[stat] + 1 },
    };
  }

  // ── VEIN Dispenser (GDD §10.3) ────────────────────────────────────────────

  /** True when the player stands at a VEIN Dispenser (a merchant room). The
   *  scene gates the Dispenser UI on this; the economic rules below don't. */
  isAtDispenser(): boolean {
    return this.currentRoom().type === 'merchant';
  }

  /** VEIN price of `item` at the current floor's Dispenser (T-108 zoned pricing). */
  dispenserPriceOf(item: ItemDef): number {
    return dispenserPriceForFloor(item.rarity, this.floorNumber);
  }

  /**
   * The current merchant room's stock (GDD §10.3: 4–6 items from the floor's
   * item pool, T-115b). Empty unless the player is at a Dispenser and an item
   * pool was supplied. Computed once per room (deterministic from seed + floor +
   * room) and cached, so it's stable across reads and refreshes once per floor.
   */
  dispenserStock(): readonly ItemDef[] {
    if (!this.isAtDispenser() || this.itemPool.length === 0) return [];
    const cached = this.dispenserStockByRoom.get(this.current);
    if (cached !== undefined) return cached;
    const seed =
      (this.masterSeed ^ Math.imul(this.floorNumber, 0xc2b2ae35) ^ hashString(this.current)) >>> 0;
    const stock = rollDispenserStock({ pool: this.itemPool, rng: makeRng(seed, 'loot') });
    this.dispenserStockByRoom.set(this.current, stock);
    return stock;
  }

  /** True when the run's VEIN balance covers `item` at the current Dispenser. */
  canAfford(item: ItemDef): boolean {
    return this.veinCrystals >= this.dispenserPriceOf(item);
  }

  /**
   * Buys `item` from the VEIN Dispenser (GDD §10.3): deducts the floor-zoned
   * price from the run's VEIN and adds it to the player's inventory. Throws if
   * VEIN is insufficient, the inventory category is full (GDD §9.5), or if
   * called mid-combat. The scene gates presentation on {@link isAtDispenser} and
   * should check {@link canCarry} first to offer a drop-to-swap.
   */
  purchaseItem(item: ItemDef): void {
    if (this.status === 'in_combat') {
      throw new Error('purchaseItem: cannot trade during combat');
    }
    const price = this.dispenserPriceOf(item);
    if (this.veinCrystals < price) {
      throw new Error(`purchaseItem: insufficient VEIN (need ${price}, have ${this.veinCrystals})`);
    }
    if (!this.canCarry(item)) {
      throw new Error(`purchaseItem: inventory full for "${item.category}" (GDD §9.5)`);
    }
    this.veinCrystals -= price;
    this.addItem(item);
    // Sold items leave the shelf so they can't be bought twice (GDD §10.3).
    const stock = this.dispenserStockByRoom.get(this.current);
    if (stock !== undefined) {
      const idx = stock.findIndex((s) => s.id === item.id);
      if (idx !== -1) this.dispenserStockByRoom.set(this.current, stock.filter((_, i) => i !== idx));
    }
  }

  // ── Inventory (GDD §9.5 — capacity slots, drop-to-swap) ────────────────────

  /** Per-category `{ count, limit }` for the inventory / swap UI (T-448). */
  inventory(): Record<ItemCategory, { count: number; limit: number }> {
    return inventoryCounts(this.player.items);
  }

  /** True when `item`'s category has a free slot. Callers offer a swap when false. */
  canCarry(item: ItemDef): boolean {
    return hasRoomFor(this.player.items, item.category);
  }

  /** Adds `item` if its category has room, folding in its passive modifiers
   *  (T-444). Returns false when full (→ caller offers a swap). */
  addItem(item: ItemDef): boolean {
    const res = addToInventory(this.player.items, item);
    if (res.added) this.player = { ...equipItem(this.player, item), items: res.items };
    return res.added;
  }

  /** True unless the item is cursed — a cursed item can't be dropped (GDD §9.3). */
  canDrop(itemId: string): boolean {
    const item = this.player.items.find((i) => i.id === itemId);
    return item !== undefined && item.cursed !== true;
  }

  /** Drops the first item with `itemId` (no-op if absent or cursed), reversing
   *  its modifiers. Cursed items stay put until run end / Purge Serum (T-449). */
  dropItem(itemId: string): void {
    const dropped = this.player.items.find((i) => i.id === itemId);
    if (dropped === undefined || dropped.cursed === true) return;
    const player = unequipItem(this.player, dropped);
    this.player = { ...player, items: dropFromInventory(player.items, itemId) };
  }

  /** Drops `dropId` and adds `incoming` in one step — the make-room swap (model b),
   *  reversing the dropped item's modifiers and folding in the incoming one's. A
   *  no-op if `dropId` is cursed (it can't be swapped out). */
  swapItem(dropId: string, incoming: ItemDef): void {
    const dropped = this.player.items.find((i) => i.id === dropId);
    if (dropped !== undefined && dropped.cursed === true) return;
    let player = dropped !== undefined ? unequipItem(this.player, dropped) : this.player;
    player = equipItem(player, incoming);
    this.player = { ...player, items: swapInInventory(player.items, dropId, incoming) };
  }

  /** Removes all cursed items (the Purge Serum effect, GDD §9.3), reversing their
   *  modifiers. The only way to shed a curse mid-run. */
  purgeCursed(): void {
    let player = this.player;
    for (const item of player.items.filter((i) => i.cursed === true)) {
      player = { ...unequipItem(player, item), items: dropFromInventory(player.items, item.id) };
    }
    this.player = player;
  }

  // ── Loot pickup (T-445/T-446) ──────────────────────────────────────────────

  /** Rolls item drops for the fallen enemies onto the pending-pickup pile. */
  private rollKillLoot(enemies: readonly EnemyState[]): void {
    if (this.itemPool.length === 0) return; // no item content → no drops
    const rng = makeRng((this.masterSeed ^ Math.imul(this.floorNumber, 0x27d4eb2f) ^ hashString(this.current)) >>> 0, 'loot');
    for (const e of enemies) {
      if (e.hp > 0) continue; // only the fallen drop
      const tier = this.registry.get(e.enemyDefId)?.tier;
      if (tier !== undefined) this.pendingLoot.push(...rollItemDrops(tier, this.itemPool, rng));
    }
  }

  /** Adds an item to the pending-pickup pile directly (loot rooms, T-446). */
  addPendingLoot(item: ItemDef): void {
    this.pendingLoot.push(item);
  }

  /** Drops awaiting pickup (enemy kills, loot rooms). The pickup UI reads this. */
  lootPending(): readonly ItemDef[] {
    return [...this.pendingLoot];
  }

  /**
   * Picks up a pending item: adds it (consuming the pending entry), or — when its
   * category is full — swaps it for `swapDropId`. Returns `needsSwap` when full
   * and no `swapDropId` was given, so the UI can open the drop-to-swap modal.
   */
  takeLoot(itemId: string, swapDropId?: string): { readonly taken: boolean; readonly needsSwap: boolean } {
    const idx = this.pendingLoot.findIndex((i) => i.id === itemId);
    if (idx === -1) return { taken: false, needsSwap: false };
    const item = this.pendingLoot[idx]!;
    if (this.canCarry(item)) {
      this.addItem(item);
    } else if (swapDropId !== undefined) {
      this.swapItem(swapDropId, item);
    } else {
      return { taken: false, needsSwap: true }; // full → caller opens the swap modal
    }
    this.pendingLoot.splice(idx, 1);
    return { taken: true, needsSwap: false };
  }

  /** Leaves a pending item behind (the "discard" option), removing it unclaimed. */
  discardLoot(itemId: string): void {
    const idx = this.pendingLoot.findIndex((i) => i.id === itemId);
    if (idx !== -1) this.pendingLoot.splice(idx, 1);
  }

  /** Banks VEIN income: raises both the spendable balance and the lifetime
   *  earned total (the latter drives the run-end Shard conversion, T-113). */
  private bankVein(amount: number): void {
    if (amount <= 0) return;
    this.veinCrystals += amount;
    this.veinEarned += amount;
  }

  /** Advances to the next floor after a boss clear (and any Strand Event). */
  descend(): void {
    if (this.status !== 'floor_complete') {
      throw new Error(`descend: floor not complete (status: ${this.status})`);
    }
    this.loadFloor(this.floorNumber + 1);
  }

  // ── Strand Event (GDD §5) ─────────────────────────────────────────────────

  /** True when this floor's boss clear should open a Strand Event. Floor 0 is
   *  excluded — its Strand is the scripted tutorial room, not the boss cadence. */
  private strandEventDue(): boolean {
    return this.mutationPool.length > 0 && this.floorNumber >= 1 && this.floorNumber % this.strandInterval === 0;
  }

  /** The owned mutations resolved to their defs (for weighting + application). */
  private ownedMutationDefs(): MutationDef[] {
    const byId = new Map(this.mutationPool.map((m) => [m.id, m]));
    return this.player.mutations.flatMap((id) => {
      const def = byId.get(id);
      return def === undefined ? [] : [def];
    });
  }

  /**
   * Opens the current floor's Strand Event, returning whether it's a card draw
   * or a VEIN Intermission (at the mutation cap). Idempotent for the floor — the
   * offer is computed once (deterministically from the seed) and cached, so the
   * scene can call it freely and it survives a resume.
   */
  beginStrandEvent(): StrandOutcome {
    if (this.status !== 'strand_event') {
      throw new Error(`beginStrandEvent: not at a Strand Event (status: ${this.status})`);
    }
    if (this.strandOutcome !== null) return this.strandOutcome;

    const owned = this.ownedMutationDefs();
    const outcome = resolveStrandEvent(owned.length);
    if (outcome.kind === 'draw') {
      this.strandRng = makeRng((this.masterSeed ^ Math.imul(this.floorNumber, 0x9e3779b1)) >>> 0, 'mutationdraw');
      this.strandCards = drawMutationCards({
        pool: this.mutationPool,
        owned,
        floor: this.floorNumber,
        rng: this.strandRng,
      });
    }
    this.strandOutcome = outcome;
    return outcome;
  }

  /** The three cards on offer (empty unless an active draw). */
  get strandOffer(): readonly DrawnCard[] {
    return this.strandCards;
  }

  /** Rerolls one offered card on the same RNG sub-stream (GDD §5.4 Rule 5). */
  rerollStrandCard(index: number): void {
    if (this.status !== 'strand_event' || this.strandRng === null) {
      throw new Error('rerollStrandCard: no active Strand Event draw');
    }
    this.strandCards = rerollCard({
      offer: this.strandCards,
      index,
      pool: this.mutationPool,
      owned: this.ownedMutationDefs(),
      rng: this.strandRng,
    });
  }

  /** Takes a card: applies its mutation, accrues SIG, then ends the event. */
  chooseStrandMutation(mutationId: string): void {
    if (this.status !== 'strand_event') {
      throw new Error(`chooseStrandMutation: not at a Strand Event (status: ${this.status})`);
    }
    const card = this.strandCards.find((c) => c.mutation.id === mutationId);
    if (card === undefined) {
      throw new Error(`chooseStrandMutation: "${mutationId}" is not in the current offer`);
    }
    this.player = applyMutation(this.player, card.mutation);
    this.sig = gainMutationSig(this.sig, card.mutation, 'strand');
    this.refreshDominantTraits();
    this.endStrandEvent();
  }

  /**
   * Applies a mutation chosen *outside* the post-boss Strand flow — the scripted
   * Floor 0 tutorial Strand (T-140) and LACE event rooms (GDD §18.6). Carries the
   * mutation onto the run player, accrues SIG at the room rate, and refreshes
   * Dominant Traits — the same effects as a Strand pick, without the cadence gate.
   */
  applyMutationChoice(mutation: MutationDef): void {
    this.player = applyMutation(this.player, mutation);
    this.sig = gainMutationSig(this.sig, mutation, 'lace_event');
    this.refreshDominantTraits();
  }

  /** Acknowledges a VEIN Intermission: banks its VEIN Crystals, ends the event. */
  acceptIntermission(): void {
    if (this.status !== 'strand_event') {
      throw new Error(`acceptIntermission: not at a Strand Event (status: ${this.status})`);
    }
    const outcome = this.beginStrandEvent();
    if (outcome.kind === 'intermission') this.bankVein(outcome.veinCrystals);
    this.endStrandEvent();
  }

  private endStrandEvent(): void {
    this.strandRng = null;
    this.strandOutcome = null;
    this.strandCards = [];
    this.status = 'floor_complete';
  }

  /** Recomputes the active Dominant Trait families onto the player (GDD §5.5) so
   *  the turn engine can read trait effects without a content registry. */
  private refreshDominantTraits(): void {
    const families = unlockedDominantTraits(this.ownedMutationDefs()).map((t) => t.family);
    this.player = { ...this.player, dominantTraits: families };
  }

  // ── Internals ───────────────────────────────────────────────────────────

  private loadFloor(n: number): void {
    this.floorNumber = n;
    // Floor 0 is the fixed tutorial floor (T-137); every other floor generates.
    this.floorData =
      n === 0 && this.floorZero !== null
        ? this.floorZero
        : generateFloor({ ...this.template, floor: n }, this.floorRng(n));
    this.adjacency = buildAdjacency(this.floorData.rooms, this.floorData.edges);
    this.current = this.floorData.startRoomId;
    this.cleared = new Set<string>();
    this.dispenserStockByRoom = new Map(); // fresh shelves each floor (GDD §10.3)
    this.combatState = null; // a new floor is never mid-combat
    this.combatRngState = 0;
    this.pendingLoot = []; // uncollected loot doesn't follow you down a floor
    this.autoClearIfTrivial(this.current);
    this.restIfSafe(this.current);
    this.status = 'exploring';
  }

  /** Per-floor RNG derived from the master seed — independent and deterministic. */
  private floorRng(n: number): Mulberry32 {
    return new Mulberry32((this.masterSeed ^ Math.imul(n, 0x9e3779b1)) >>> 0);
  }

  private roomById(id: string): PopulatedRoom {
    const room = this.floorData.rooms.find((r) => r.id === id);
    if (room === undefined) throw new Error(`run-session: no room "${id}" on floor ${this.floorNumber}`);
    return room;
  }

  /** Rooms with no enemies (safe/loot/merchant/…) clear the moment you enter. */
  private autoClearIfTrivial(id: string): void {
    if (this.roomById(id).enemies.length === 0) this.cleared.add(id);
  }

  /** Safe rooms are rest points — entering one restores 25% of max HP (UFD S026).
   *  Returns the amount of HP actually recovered (0 if not a safe room or already
   *  at full), so the Safe Room screen can surface the gain (T-178). */
  private restIfSafe(id: string): number {
    if (this.roomById(id).type !== 'safe') return 0;
    const before = this.player.hp;
    const heal = Math.floor(this.player.maxHp * SAFE_ROOM_HEAL_FRACTION);
    const hp = Math.min(this.player.hp + heal, this.player.maxHp);
    this.player = { ...this.player, hp };
    return hp - before;
  }

  /** T-176: grant VEIN Crystals as an event-room reward.
   *  Updates both the spendable balance and the lifetime-earned total. */
  grantVein(amount: number): void { this.bankVein(amount); }

  /** T-176 / T-178: restore HP by `amount`, capped at maxHp.
   *  Used by event-room choices and safe-room UI confirms. */
  healPlayer(amount: number): void {
    const hp = Math.min(this.player.hp + amount, this.player.maxHp);
    this.player = { ...this.player, hp };
  }

  /** T-198: apply the one-per-run revive — set player HP to 50 % maxHp and
   *  reset all enemies in the active combat state to their maxHp so the
   *  room fight restarts cleanly. */
  revive(): void {
    this.player = { ...this.player, hp: Math.ceil(this.player.maxHp * 0.5) };
    if (this.combatState !== null) {
      this.combatState = {
        ...this.combatState,
        enemies: this.combatState.enemies.map((e) => ({ ...e, hp: e.maxHp })),
      };
    }
  }
}
