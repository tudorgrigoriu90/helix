import type { FloorTemplate } from '@shared-types/floor-template';
import type { PopulatedFloor, PopulatedRoom } from '@shared-types/floor-plan';
import type { PlayerState, RunState } from '@shared-types/run-state';
import { Mulberry32 } from '../rng/mulberry32';
import { buildAdjacency, generateFloor } from '../floor-gen';
import { buildEncounterState, type EnemyRegistry } from './encounter';
import { newRunPlayer } from './start-player';

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

export type RunStatus = 'exploring' | 'in_combat' | 'floor_complete' | 'victory' | 'defeat';

export interface RunSnapshot {
  readonly status: RunStatus;
  readonly floorNumber: number;
  readonly currentRoomId: string;
  readonly clearedRoomIds: readonly string[];
  readonly player: PlayerState;
}

/** Schema version for the persisted run-session shape. */
export const CURRENT_RUN_SESSION_SAVE_VERSION = 1;

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
}

export interface RunSessionOptions {
  readonly seed: number;
  readonly template: FloorTemplate;
  readonly registry: EnemyRegistry;
  readonly player?: PlayerState;
  /** Boss kill on this floor wins the run (default 20). */
  readonly finalFloor?: number;
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

  private floorNumber = 1;
  private floorData!: PopulatedFloor;
  private adjacency!: Map<string, string[]>;
  private current!: string;
  private cleared!: Set<string>;
  private status: RunStatus = 'exploring';
  private player: PlayerState;

  constructor(options: RunSessionOptions) {
    this.masterSeed = options.seed;
    this.template = options.template;
    this.registry = options.registry;
    this.finalFloor = options.finalFloor ?? FINAL_FLOOR_DEFAULT;
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
      status: this.status === 'in_combat' ? 'exploring' : this.status,
      player: this.player,
    };
  }

  /** Restores a saved run: regenerates the floor deterministically, then
   *  overlays the saved position, cleared set, player, and status. */
  applySave(save: RunSessionSave): void {
    this.loadFloor(save.floorNumber);
    this.current = save.currentRoomId;
    this.cleared = new Set(save.clearedRoomIds);
    this.player = save.player;
    this.status = save.status === 'in_combat' ? 'exploring' : save.status;
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

    if (this.current === this.floorData.bossRoomId) {
      this.status = this.floorNumber >= this.finalFloor ? 'victory' : 'floor_complete';
    } else {
      this.status = 'exploring';
    }
  }

  /** Advances to the next floor after a boss clear. */
  descend(): void {
    if (this.status !== 'floor_complete') {
      throw new Error(`descend: floor not complete (status: ${this.status})`);
    }
    this.loadFloor(this.floorNumber + 1);
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
