import type { FloorTemplate } from '@shared-types/floor-template';
import type { PopulatedFloor, PopulatedRoom } from '@shared-types/floor-plan';
import type { EnemyState, EntityStats, PlayerState, RunState } from '@shared-types/run-state';
import type { MutationDef } from '@shared-types/mutation';
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
  veinForKill,
  FLOOR_VEIN_CONSTANT,
  xpForKill,
  levelForTotalXp,
  levelUpReward,
  ALLOCATABLE_STATS,
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
  /** VEIN Crystals banked this run (e.g. from VEIN Intermissions). */
  readonly veinCrystals: number;
  /** Cumulative XP earned this run (GDD §4.3). */
  readonly xp: number;
  /** Current in-run level, derived from {@link xp} (1–20). */
  readonly level: number;
  /** Unspent level-up stat points awaiting allocation (GDD §4.3). */
  readonly pendingStatPoints: number;
}

/** Schema version for the persisted run-session shape.
 *  v2 added `sig` + `veinCrystals`; v3 added `xp` + `pendingStatPoints`.
 *  Older saves load fine — missing fields default to 0. */
export const CURRENT_RUN_SESSION_SAVE_VERSION = 3;

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
  // Transient per-Strand-Event state (regenerated deterministically on resume).
  private strandRng: Mulberry32 | null = null;
  private strandOutcome: StrandOutcome | null = null;
  private strandCards: readonly DrawnCard[] = [];

  constructor(options: RunSessionOptions) {
    this.masterSeed = options.seed;
    this.template = options.template;
    this.registry = options.registry;
    this.finalFloor = options.finalFloor ?? FINAL_FLOOR_DEFAULT;
    this.mutationPool = options.mutations ?? [];
    this.strandInterval = options.strandEventEveryNFloors ?? STRAND_INTERVAL_DEFAULT;
    this.player = options.player ?? newRunPlayer();
    this.loadFloor(1);
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
      xp: this.xp,
      level: levelForTotalXp(this.xp),
      pendingStatPoints: this.pendingStatPoints,
    };
  }

  get floor(): PopulatedFloor {
    return this.floorData;
  }

  /** Serialisable snapshot for save/resume. Combat is not persisted — an
   *  in-combat save resumes at the room (exploring) it was entered from. */
  toSave(): RunSessionSave {
    return {
      schemaVersion: CURRENT_RUN_SESSION_SAVE_VERSION,
      seed: this.masterSeed,
      floorNumber: this.floorNumber,
      currentRoomId: this.current,
      clearedRoomIds: [...this.cleared],
      // In-combat saves resume at the room (exploring); a Strand Event is
      // preserved and its offer regenerates deterministically on resume.
      status: this.status === 'in_combat' ? 'exploring' : this.status,
      player: this.player,
      sig: this.sig,
      veinCrystals: this.veinCrystals,
      xp: this.xp,
      pendingStatPoints: this.pendingStatPoints,
    };
  }

  /** Restores a saved run: regenerates the floor deterministically, then
   *  overlays the saved position, cleared set, player, status, and run currencies. */
  applySave(save: RunSessionSave): void {
    this.loadFloor(save.floorNumber);
    this.current = save.currentRoomId;
    this.cleared = new Set(save.clearedRoomIds);
    this.player = save.player;
    this.status = save.status === 'in_combat' ? 'exploring' : save.status;
    this.sig = save.sig ?? 0; // absent in v1 saves
    this.veinCrystals = save.veinCrystals ?? 0;
    this.xp = save.xp ?? 0; // absent in pre-v3 saves
    this.pendingStatPoints = save.pendingStatPoints ?? 0;
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
    this.autoClearIfTrivial(this.current);
    this.restIfSafe(this.current);
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

  /** Applies a terminal combat result: carry the player, clear the room, or end the run. */
  endEncounter(finalState: RunState): void {
    if (this.status !== 'in_combat') {
      throw new Error(`endEncounter: not in combat (status: ${this.status})`);
    }
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
    this.veinCrystals += veinFromKills(finalState.enemies, this.registry);
    this.grantXp(xpFromKills(finalState.enemies, this.registry));

    if (this.current === this.floorData.bossRoomId) {
      // Floor loot: the ambient per-floor VEIN constant (loot rooms, GDD §9) banks
      // once the floor's boss falls.
      this.veinCrystals += FLOOR_VEIN_CONSTANT;
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

  /** Advances to the next floor after a boss clear (and any Strand Event). */
  descend(): void {
    if (this.status !== 'floor_complete') {
      throw new Error(`descend: floor not complete (status: ${this.status})`);
    }
    this.loadFloor(this.floorNumber + 1);
  }

  // ── Strand Event (GDD §5) ─────────────────────────────────────────────────

  /** True when this floor's boss clear should open a Strand Event. */
  private strandEventDue(): boolean {
    return this.mutationPool.length > 0 && this.floorNumber % this.strandInterval === 0;
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

  /** Acknowledges a VEIN Intermission: banks its VEIN Crystals, ends the event. */
  acceptIntermission(): void {
    if (this.status !== 'strand_event') {
      throw new Error(`acceptIntermission: not at a Strand Event (status: ${this.status})`);
    }
    const outcome = this.beginStrandEvent();
    if (outcome.kind === 'intermission') this.veinCrystals += outcome.veinCrystals;
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
    this.floorData = generateFloor({ ...this.template, floor: n }, this.floorRng(n));
    this.adjacency = buildAdjacency(this.floorData.rooms, this.floorData.edges);
    this.current = this.floorData.startRoomId;
    this.cleared = new Set<string>();
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

  /** Safe rooms are rest points — entering one restores the player to full HP. */
  private restIfSafe(id: string): void {
    if (this.roomById(id).type === 'safe' && this.player.hp < this.player.maxHp) {
      this.player = { ...this.player, hp: this.player.maxHp };
    }
  }
}
