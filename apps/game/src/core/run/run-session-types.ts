import type { FloorTemplate } from '@shared-types/floor-template';
import type { PopulatedFloor, PopulatedRoom } from '@shared-types/floor-plan';
import type { PlayerState, RunState } from '@shared-types/run-state';
import type { MutationDef } from '@shared-types/mutation';
import type { ItemDef } from '@shared-types/item';
import type { Mulberry32 } from '../rng/mulberry32';
import type { EnemyRegistry } from './encounter';
import type { DrawnCard, StrandOutcome } from '../mutation';

/**
 * Shared shapes for the run session (T-520 decomposition).
 *
 * `RunSession` (run-session.ts) is the public facade; the heavier subsystems
 * live beside it — economy/inventory/loot in session-economy.ts, the Strand
 * Event in session-strand.ts — all operating on the same {@link SessionConfig}
 * (immutable run setup) + {@link SessionState} (the mutable run) pair that the
 * facade owns. Public API and behaviour are unchanged from the monolith.
 */

/** A Strand Event fires after clearing the boss of every Nth floor (GDD §5). */
export const STRAND_INTERVAL_DEFAULT = 5;
/** The Proto-Strand fires once after this floor's boss room (DR-009b, T-511). */
export const PROTO_STRAND_FLOOR = 2;
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

/**
 * A DR-009 descent checkpoint: the act-end pause point recorded when a Strand
 * Event resolves (floors 5/10/15 — never the Floor 20 Warden, which leads
 * straight to the Convergence). `floor` is the cleared zone-end floor; `act`
 * its 1-based zone. A checkpoint is a *pause* point, never a retry point:
 * death still ends the run from anywhere, and a suspended run never expires.
 */
export interface DescentCheckpoint {
  readonly floor: number;
  readonly act: number;
}

/** Schema version for the persisted run-session shape.
 *  v2 added `sig` + `veinCrystals`; v3 added `xp` + `pendingStatPoints`;
 *  v4 added `veinEarned`; v5 added mid-combat persistence (`combat` +
 *  `combatRngState`); v6 added `pendingLoot` (uncollected drops); v7 added
 *  `checkpoint` (DR-009 act-end rest, T-510); v8 added `bonusMutationTaken`
 *  (DR-009b bonus slot, T-511); v9 added `suspendedAtMs` (T-513 — written by
 *  the *scene* on persist; the deterministic core never reads a wall clock).
 *  Older saves load fine — missing fields default to 0/none/null/false. */
export const CURRENT_RUN_SESSION_SAVE_VERSION = 9;

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
  /** The DR-009 act-end checkpoint the run is paused at (added in save v7;
   *  absent → none). Present only while `status === 'floor_complete'` right
   *  after a Strand Event — the Hub's "Continue Descent" card keys off it. */
  readonly checkpoint?: DescentCheckpoint;
  /** True once the run's single bonus-slot mutation is taken — the Proto-Strand
   *  pick or a LACE event-room adaptation (added in save v8; absent → false). */
  readonly bonusMutationTaken?: boolean;
  /** Wall-clock ms when the save was written (added in save v9, T-513). Set by
   *  the scene layer on persist — never read by the deterministic core — and
   *  used only to derive `descent_resumed.hoursSinceSuspend`. */
  readonly suspendedAtMs?: number;
  /**
   * The live combat state, present only when `status === 'in_combat'` and the
   * scene has synced it via `RunSession.syncCombat` (save v5). Its presence
   * is what lets a run resume *mid-fight* rather than re-entering the room. Absent
   * → the run resumes exploring at `currentRoomId` (the pre-v5 behaviour).
   */
  readonly combat?: RunState;
  /** The combat RNG's state word at save time, so crit/AI rolls stay deterministic
   *  across the resume (NFR P2). Paired with {@link RunSessionSave.combat}; added in save v5. */
  readonly combatRngState?: number;
}

export interface RunSessionOptions {
  readonly seed: number;
  readonly template: FloorTemplate;
  readonly registry: EnemyRegistry;
  /**
   * Per-floor templates keyed by floor number (T-291/T-298/T-305). When a floor
   * has an entry here it drives that floor's zone, enemy pool, boss, and room mix;
   * floors without one fall back to {@link RunSessionOptions.template}. Omit it
   * (the default) and every floor uses the base template — the single-zone
   * behaviour the demo and balance harness rely on.
   */
  readonly floorTemplates?: ReadonlyMap<number, FloorTemplate>;
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
   * (the default), merchant rooms offer nothing and `RunSession.dispenserStock`
   * returns `[]` — the run loop is otherwise unchanged.
   */
  readonly itemPool?: readonly ItemDef[];
  /**
   * The hardcoded Floor 0 (T-137). When supplied, the run *starts on floor 0*
   * using this fixed floor instead of generating — the tutorial descent (TDD
   * §21 Q4). Floor 1+ still generate procedurally on `RunSession.descend`.
   * Omit it (the default) for a normal run that starts on floor 1.
   */
  readonly floorZero?: PopulatedFloor;
}

/** Immutable run setup shared by the session facade and its subsystems. */
export interface SessionConfig {
  readonly masterSeed: number;
  readonly template: FloorTemplate;
  readonly floorTemplates: ReadonlyMap<number, FloorTemplate>;
  readonly registry: EnemyRegistry;
  readonly finalFloor: number;
  readonly mutationPool: readonly MutationDef[];
  readonly strandInterval: number;
  readonly itemPool: readonly ItemDef[];
  /** The fixed tutorial floor (T-137), or null for a normal procedural run. */
  readonly floorZero: PopulatedFloor | null;
}

/** The mutable run — owned by the facade, operated on by the subsystems. */
export interface SessionState {
  floorNumber: number;
  floorData: PopulatedFloor;
  adjacency: Map<string, string[]>;
  current: string;
  cleared: Set<string>;
  status: RunStatus;
  player: PlayerState;
  // Run-scoped progression (carries across floors, never resets mid-run).
  sig: number;
  veinCrystals: number;
  xp: number;
  pendingStatPoints: number;
  /** Lifetime VEIN income this run (never decremented by purchases) — drives
   *  the run-end Shard conversion (T-113), which is income-based. */
  veinEarned: number;
  // Transient per-Strand-Event state (regenerated deterministically on resume).
  strandRng: Mulberry32 | null;
  strandOutcome: StrandOutcome | null;
  strandCards: readonly DrawnCard[];
  /** Live combat state, kept current by the scene via syncCombat so a save can
   *  resume mid-fight (T-114). Null outside an active encounter. */
  combatState: RunState | null;
  combatRngState: number;
  /** Drops rolled on kills / loot rooms awaiting pickup (T-445/T-446). */
  pendingLoot: ItemDef[];
  /** The DR-009 act-end checkpoint (T-510): set when a Strand Event resolves,
   *  cleared on descend. Null whenever the run isn't paused at an act end. */
  checkpoint: DescentCheckpoint | null;
  /** DR-009b (T-511): the run's one bonus mutation slot — filled by the Floor 2
   *  Proto-Strand pick or a LACE event-room adaptation, whichever comes first.
   *  Run-scoped (never resets on descend). */
  bonusMutationTaken: boolean;
  /** Dispenser stock per merchant room — computed once per room and reset each
   *  floor (GDD §10.3 "refresh once per floor"). */
  dispenserStockByRoom: Map<string, ItemDef[]>;
}

export function hashString(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = (Math.imul(h, 33) ^ s.charCodeAt(i)) >>> 0;
  return h >>> 0;
}

export function roomById(st: SessionState, id: string): PopulatedRoom {
  const room = st.floorData.rooms.find((r) => r.id === id);
  if (room === undefined) throw new Error(`run-session: no room "${id}" on floor ${st.floorNumber}`);
  return room;
}

/** Rooms with no enemies (safe/loot/merchant/…) clear the moment you enter. */
export function autoClearIfTrivial(st: SessionState, id: string): void {
  if (roomById(st, id).enemies.length === 0) st.cleared.add(id);
}

/** Safe rooms are rest points — entering one restores 25% of max HP (UFD S026).
 *  Fires only on first entry (cleared guard); subsequent visits return 0 so the
 *  Safe Room screen shows "INTEGRITY ALREADY FULL". */
export function restIfSafe(st: SessionState, id: string): number {
  if (roomById(st, id).type !== 'safe' || st.cleared.has(id)) return 0;
  const before = st.player.hp;
  const heal = Math.floor(st.player.maxHp * SAFE_ROOM_HEAL_FRACTION);
  const hp = Math.min(st.player.hp + heal, st.player.maxHp);
  st.player = { ...st.player, hp };
  return hp - before;
}
