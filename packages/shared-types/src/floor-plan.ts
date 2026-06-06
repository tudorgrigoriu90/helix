/**
 * Floor plan — the fully populated floor produced by the generation pipeline.
 *
 * The pipeline runs in stages, each its own task:
 *   1. placeRooms (T-71)          → FloorGraph (topology only)
 *   2. validateConnectivity (T-72)→ playability gate
 *   3. fillRoomTypes (T-73)       → RoomNode + RoomType  (TypedRoom)
 *   4. buildRoom (T-74/T-75/T-77) → grid + enemy spawns + hazards + boss flags
 *   5. generateFloor (T-79)       → PopulatedFloor (orchestration + fallback)
 *
 * Schema lives in @shared-types because it's the contract the FloorScene and
 * combat setup consume — same rationale as FloorTemplate / FloorGraph.
 */

import type { Position } from './action.js';
import type { GridState } from './run-state.js';
import type { FloorEdge } from './floor-graph.js';
import type { RoomType, Zone } from './floor-template.js';

/** A room slot with its assigned type but no interior content yet (T-73 output). */
export interface TypedRoom {
  readonly id: string;
  readonly pos: { readonly x: number; readonly y: number };
  readonly type: RoomType;
}

/** A single enemy to instantiate when the player enters the room (T-74). */
export interface EnemySpawn {
  /** Enemy def id, drawn from the floor template's enemyPool (boss room uses bossId). */
  readonly enemyDefId: string;
  /** Spawn tile on the room's combat grid. */
  readonly pos: Position;
}

/** A room with its full interior: combat grid, spawns, and gameplay flags. */
export interface PopulatedRoom {
  readonly id: string;
  /** Minimap position, inherited from the FloorGraph node. */
  readonly pos: { readonly x: number; readonly y: number };
  readonly type: RoomType;
  /** Combat grid for the room. Boss rooms are 10x10 (T-77); others are standard. */
  readonly grid: GridState;
  /** Tile the player occupies on entering the room. */
  readonly playerSpawn: Position;
  /** Enemies to instantiate. Empty for non-combat, non-boss rooms. */
  readonly enemies: readonly EnemySpawn[];
  /** Boss-room door is locked until the floor is cleared (T-77 / TDD §7.4). */
  readonly locked: boolean;
  /**
   * A collectible Codex Fragment waits in this room (GDD §7.2 step 6 — 0–4 per
   * floor, never in the boss room). Absent/false means none. Collecting it adds
   * a codex entry to MetaState. Optional so pre-fragment floors/saves stay valid.
   */
  readonly codexFragment?: boolean;
}

/** A complete, playable floor. */
export interface PopulatedFloor {
  readonly floor: number;
  readonly zone: Zone;
  readonly rooms: readonly PopulatedRoom[];
  readonly edges: readonly FloorEdge[];
  readonly startRoomId: string;
  readonly bossRoomId: string;
  /** True when generation fell back to the fixed template (T-79). */
  readonly fromFallback: boolean;
}
