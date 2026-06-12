import { MAX_FLOOR } from '@shared-types/campaign';
import type { PopulatedFloor, PopulatedRoom } from '@shared-types/floor-plan';
import type { EntityStats, RunState } from '@shared-types/run-state';
import type { MutationDef } from '@shared-types/mutation';
import type { ItemDef, ItemCategory } from '@shared-types/item';
import type { DrawnCard, StrandOutcome } from '../mutation';
import { newRunPlayer } from './start-player';
import { levelForTotalXp } from '../economy';
import {
  STRAND_INTERVAL_DEFAULT,
  autoClearIfTrivial,
  restIfSafe,
  roomById,
  type DescentCheckpoint,
  type RunSessionOptions,
  type RunSessionSave,
  type RunSnapshot,
  type SessionConfig,
  type SessionState,
} from './run-session-types';
import * as combat from './session-combat';
import * as economy from './session-economy';
import * as lifecycle from './session-lifecycle';
import * as strand from './session-strand';

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
 *
 * Decomposed per T-520 (the 881-line monolith exceeded the TDD §18.1 300-line
 * convention): this facade owns the {@link SessionConfig} + {@link SessionState}
 * pair and delegates to the subsystems beside it —
 *   - session-lifecycle.ts — floor loading, save/resume
 *   - session-combat.ts    — encounter begin/sync/end + boss-clear transition
 *   - session-economy.ts   — kill rewards, Dispenser, inventory, loot pickup
 *   - session-strand.ts    — the Strand Event (GDD §5)
 * Shared shapes live in run-session-types.ts. Public API is unchanged.
 */

const FINAL_FLOOR_DEFAULT = MAX_FLOOR; // canonical campaign shape (T-523)

// Re-exported so existing import sites keep working post-decomposition (T-520).
export {
  CURRENT_RUN_SESSION_SAVE_VERSION,
  SAFE_ROOM_HEAL_FRACTION,
  type DescentCheckpoint,
  type RunSessionOptions,
  type RunSessionSave,
  type RunSnapshot,
  type RunStatus,
} from './run-session-types';

export class RunSession {
  private readonly cfg: SessionConfig;
  private readonly st: SessionState;

  constructor(options: RunSessionOptions) {
    this.cfg = {
      masterSeed: options.seed,
      template: options.template,
      floorTemplates: options.floorTemplates ?? new Map(),
      registry: options.registry,
      finalFloor: options.finalFloor ?? FINAL_FLOOR_DEFAULT,
      mutationPool: options.mutations ?? [],
      strandInterval: options.strandEventEveryNFloors ?? STRAND_INTERVAL_DEFAULT,
      itemPool: options.itemPool ?? [],
      floorZero: options.floorZero ?? null,
      origin: options.origin ?? null,
    };
    this.st = {
      floorNumber: 1,
      floorData: undefined as unknown as PopulatedFloor, // set by loadFloor below
      adjacency: new Map(),
      current: '',
      cleared: new Set(),
      status: 'exploring',
      player: options.player ?? newRunPlayer(),
      sig: 0,
      veinCrystals: 0,
      xp: 0,
      pendingStatPoints: 0,
      veinEarned: 0,
      strandRng: null,
      strandOutcome: null,
      strandCards: [],
      combatState: null,
      combatRngState: 0,
      pendingLoot: [],
      checkpoint: null,
      bonusMutationTaken: false,
      dispenserStockByRoom: new Map(),
    };
    // A tutorial run begins on the hardcoded floor 0; a normal run on floor 1.
    lifecycle.loadFloor(this.cfg, this.st, this.cfg.floorZero !== null ? 0 : 1);
  }

  // ── Read API ────────────────────────────────────────────────────────────

  get snapshot(): RunSnapshot {
    return {
      status: this.st.status,
      floorNumber: this.st.floorNumber,
      currentRoomId: this.st.current,
      clearedRoomIds: [...this.st.cleared],
      player: this.st.player,
      sig: this.st.sig,
      veinCrystals: this.st.veinCrystals,
      veinEarned: this.st.veinEarned,
      xp: this.st.xp,
      level: levelForTotalXp(this.st.xp),
      pendingStatPoints: this.st.pendingStatPoints,
    };
  }

  get floor(): PopulatedFloor {
    return this.st.floorData;
  }

  currentRoom(): PopulatedRoom {
    return roomById(this.st, this.st.current);
  }

  /** Rooms the player can step to right now (empty unless exploring). */
  adjacentRooms(): string[] {
    if (this.st.status !== 'exploring') return [];
    return this.st.adjacency.get(this.st.current) ?? [];
  }

  needsCombat(): boolean {
    return combat.needsCombat(this.st);
  }

  /** The DR-009 act-end checkpoint the run is paused at (T-510), or null.
   *  Non-null only while `status === 'floor_complete'` right after a Strand
   *  Event — the S072 Descend/Rest choice and the Hub card key off it. */
  checkpoint(): DescentCheckpoint | null {
    return this.st.checkpoint;
  }

  /** True while the open Strand Event is the Floor 2 Proto-Strand (DR-009b):
   *  2 Minor cards, uniform families, no reroll, +5 SIG, no S072 checkpoint. */
  isProtoStrand(): boolean {
    return strand.isProtoStrand(this.cfg, this.st);
  }

  /** True once the run's single bonus mutation slot is filled (Proto-Strand
   *  pick or LACE event-room adaptation) — the event room swaps its mutation
   *  option for a VEIN grant when this is set (DR-009b). */
  bonusMutationTaken(): boolean {
    return this.st.bonusMutationTaken;
  }

  // ── Save / resume (session-lifecycle.ts) ────────────────────────────────

  toSave(): RunSessionSave {
    return lifecycle.toSave(this.cfg, this.st);
  }

  applySave(save: RunSessionSave): void {
    lifecycle.applySave(this.cfg, this.st, save);
  }

  // ── Transitions ─────────────────────────────────────────────────────────

  moveTo(roomId: string): void {
    if (this.st.status !== 'exploring') {
      throw new Error(`moveTo: can only move while exploring (status: ${this.st.status})`);
    }
    if (!(this.st.adjacency.get(this.st.current) ?? []).includes(roomId)) {
      throw new Error(`moveTo: "${roomId}" is not adjacent to "${this.st.current}"`);
    }
    this.st.current = roomId;
    economy.grantLootRoom(this.cfg, this.st, roomId); // before auto-clear (which marks it looted)
    restIfSafe(this.st, roomId); // before auto-clear (once-per-room guard applies)
    autoClearIfTrivial(this.st, roomId);
  }

  beginEncounter(): RunState | null {
    return combat.beginEncounter(this.cfg, this.st);
  }

  syncCombat(state: RunState, rngState: number): void {
    combat.syncCombat(this.st, state, rngState);
  }

  /** The live encounter to resume after a mid-combat restore, or null if none.
   *  The scene rebuilds its combat RNG from `rngState` and re-enters the fight. */
  activeCombat(): { readonly state: RunState; readonly rngState: number } | null {
    return this.st.combatState === null
      ? null
      : { state: this.st.combatState, rngState: this.st.combatRngState };
  }

  endEncounter(finalState: RunState): void {
    combat.endEncounter(this.cfg, this.st, finalState);
  }

  /** Advances to the next floor after a boss clear (and any Strand Event). */
  descend(): void {
    if (this.st.status !== 'floor_complete') {
      throw new Error(`descend: floor not complete (status: ${this.st.status})`);
    }
    lifecycle.loadFloor(this.cfg, this.st, this.st.floorNumber + 1);
  }

  // ── Economy / inventory / loot (session-economy.ts) ─────────────────────

  allocateStatPoint(stat: keyof EntityStats): void {
    economy.allocateStatPoint(this.st, stat);
  }

  isAtDispenser(): boolean {
    return economy.isAtDispenser(this.st);
  }

  dispenserPriceOf(item: ItemDef): number {
    return economy.dispenserPriceOf(this.st, item);
  }

  dispenserStock(): readonly ItemDef[] {
    return economy.dispenserStock(this.cfg, this.st);
  }

  /** T-177: bust the cached stock for the current Dispenser so the next call to
   *  {@link dispenserStock} generates a fresh draw (the ad-refresh flow). */
  refreshDispenserStock(): void {
    this.st.dispenserStockByRoom.delete(this.st.current);
  }

  /** True when the run's VEIN balance covers `item` at the current Dispenser. */
  canAfford(item: ItemDef): boolean {
    return this.st.veinCrystals >= this.dispenserPriceOf(item);
  }

  purchaseItem(item: ItemDef): void {
    economy.purchaseItem(this.st, item);
  }

  inventory(): Record<ItemCategory, { count: number; limit: number }> {
    return economy.inventory(this.st);
  }

  canCarry(item: ItemDef): boolean {
    return economy.canCarry(this.st, item);
  }

  addItem(item: ItemDef): boolean {
    return economy.addItem(this.st, item);
  }

  canDrop(itemId: string): boolean {
    return economy.canDrop(this.st, itemId);
  }

  dropItem(itemId: string): void {
    economy.dropItem(this.st, itemId);
  }

  swapItem(dropId: string, incoming: ItemDef): void {
    economy.swapItem(this.st, dropId, incoming);
  }

  purgeCursed(): void {
    economy.purgeCursed(this.st);
  }

  /** Adds an item to the pending-pickup pile directly (loot rooms, T-446). */
  addPendingLoot(item: ItemDef): void {
    this.st.pendingLoot.push(item);
  }

  /** Drops awaiting pickup (enemy kills, loot rooms). The pickup UI reads this. */
  lootPending(): readonly ItemDef[] {
    return [...this.st.pendingLoot];
  }

  takeLoot(itemId: string, swapDropId?: string): { readonly taken: boolean; readonly needsSwap: boolean } {
    return economy.takeLoot(this.st, itemId, swapDropId);
  }

  /** Leaves a pending item behind (the "discard" option), removing it unclaimed. */
  discardLoot(itemId: string): void {
    const idx = this.st.pendingLoot.findIndex((i) => i.id === itemId);
    if (idx !== -1) this.st.pendingLoot.splice(idx, 1);
  }

  /** T-176: grant VEIN Crystals as an event-room reward.
   *  Updates both the spendable balance and the lifetime-earned total. */
  grantVein(amount: number): void {
    economy.bankVein(this.cfg, this.st, amount);
  }

  /** T-176 / T-178: restore HP by `amount`, capped at maxHp.
   *  Used by event-room choices and safe-room UI confirms. */
  healPlayer(amount: number): void {
    const hp = Math.min(this.st.player.hp + amount, this.st.player.maxHp);
    this.st.player = { ...this.st.player, hp };
  }

  /** T-198: apply the one-per-run revive — set player HP to 50 % maxHp and
   *  reset all enemies in the active combat state to their maxHp so the
   *  room fight restarts cleanly. */
  revive(): void {
    this.st.player = { ...this.st.player, hp: Math.ceil(this.st.player.maxHp * 0.5) };
    if (this.st.combatState !== null) {
      this.st.combatState = {
        ...this.st.combatState,
        enemies: this.st.combatState.enemies.map((e) => ({ ...e, hp: e.maxHp })),
      };
    }
  }

  // ── Strand Event (session-strand.ts) ────────────────────────────────────

  beginStrandEvent(): StrandOutcome {
    return strand.beginStrandEvent(this.cfg, this.st);
  }

  /** The three cards on offer (empty unless an active draw). */
  get strandOffer(): readonly DrawnCard[] {
    return this.st.strandCards;
  }

  rerollStrandCard(index: number): void {
    strand.rerollStrandCard(this.cfg, this.st, index);
  }

  chooseStrandMutation(mutationId: string): void {
    strand.chooseStrandMutation(this.cfg, this.st, mutationId);
  }

  applyMutationChoice(mutation: MutationDef): void {
    strand.applyMutationChoice(this.cfg, this.st, mutation);
  }

  acceptIntermission(): void {
    strand.acceptIntermission(this.cfg, this.st);
  }
}
