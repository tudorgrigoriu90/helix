import type { Position } from '@shared-types/action';
import type { FloorEdge } from '@shared-types/floor-graph';
import type { PopulatedFloor, PopulatedRoom } from '@shared-types/floor-plan';
import type { GridState } from '@shared-types/run-state';
import type { Zone } from '@shared-types/floor-template';
import { BOSS_ROOM_SIZE, STANDARD_ROOM_SIZE, openGrid, playerSpawnFor } from './encounter';

/**
 * Floor 0 — the hardcoded tutorial floor (T-137, TDD §21 Q4 / GDD §18.6).
 *
 * Scripted, *not* procedural: a fixed 4-room line, each room teaching one
 * mechanic in a safe context, so the player's first five minutes are authored
 * rather than rolled. It bypasses `generateFloor` entirely and is built by pure
 * code — identical every time, with no RNG.
 *
 *   1. entry  (safe)       — movement only            (S012)
 *   2. combat (combat)     — a single gentle grunt    (S013)
 *   3. strand (lace_event) — micro Strand Event       (S014; the 2-card pick is T-140)
 *   4. boss   (boss)       — tutorial boss, teaches item use (S015); clearing it
 *                            grants the First Convergence achievement (T-142)
 *
 * Enemy ids are injected (not baked in) so the tutorial supplies whichever
 * content it ships — keeping this module free of content coupling.
 */

/** Floor 0 sits below Floor 1 (GDD §18.6 — the pre-run tutorial descent). */
export const FLOOR_ZERO_NUMBER = 0;

/** Stable room ids for the four scripted rooms (the scene keys tutorial steps off these). */
export const FLOOR_ZERO_ROOM_IDS = {
  entry: 'fz_entry',
  combat: 'fz_combat',
  strand: 'fz_strand',
  boss: 'fz_boss',
} as const;

export interface FloorZeroOptions {
  /** Enemy def id for the Room-2 first-combat grunt (a single, gentle fight). */
  readonly combatEnemyId: string;
  /** Enemy def id for the Room-4 tutorial boss. */
  readonly bossId: string;
  /** Cosmetic zone tint (defaults to the opening `shallows`). */
  readonly zone?: Zone;
}

/** Top-centre of a room — where a single enemy / the boss spawns, facing the entrance. */
function topCentre(grid: GridState): Position {
  return { x: Math.floor(grid.width / 2), y: 1 };
}

/**
 * Builds the deterministic Floor 0. Pure: identical `options` → identical floor.
 * The rooms form a single line (entry → combat → strand → boss) so the player
 * can't wander past a lesson before learning it.
 */
export function buildFloorZero(options: FloorZeroOptions): PopulatedFloor {
  const { combatEnemyId, bossId, zone = 'shallows' } = options;
  const ids = FLOOR_ZERO_ROOM_IDS;

  const entryGrid = openGrid(STANDARD_ROOM_SIZE, STANDARD_ROOM_SIZE);
  const combatGrid = openGrid(STANDARD_ROOM_SIZE, STANDARD_ROOM_SIZE);
  const strandGrid = openGrid(STANDARD_ROOM_SIZE, STANDARD_ROOM_SIZE);
  const bossGrid = openGrid(BOSS_ROOM_SIZE, BOSS_ROOM_SIZE);

  const rooms: PopulatedRoom[] = [
    {
      id: ids.entry, pos: { x: 0, y: 0 }, type: 'safe',
      grid: entryGrid, playerSpawn: playerSpawnFor(entryGrid), enemies: [], locked: false,
    },
    {
      id: ids.combat, pos: { x: 1, y: 0 }, type: 'combat',
      grid: combatGrid, playerSpawn: playerSpawnFor(combatGrid),
      enemies: [{ enemyDefId: combatEnemyId, pos: topCentre(combatGrid) }], locked: false,
    },
    {
      id: ids.strand, pos: { x: 2, y: 0 }, type: 'lace_event',
      grid: strandGrid, playerSpawn: playerSpawnFor(strandGrid), enemies: [], locked: false,
    },
    {
      id: ids.boss, pos: { x: 3, y: 0 }, type: 'boss',
      grid: bossGrid, playerSpawn: playerSpawnFor(bossGrid),
      enemies: [{ enemyDefId: bossId, pos: topCentre(bossGrid) }], locked: true,
    },
  ];

  const edges: FloorEdge[] = [
    { from: ids.entry, to: ids.combat },
    { from: ids.combat, to: ids.strand },
    { from: ids.strand, to: ids.boss },
  ];

  return {
    floor: FLOOR_ZERO_NUMBER,
    zone,
    rooms,
    edges,
    startRoomId: ids.entry,
    bossRoomId: ids.boss,
    fromFallback: false, // authored, not a generation fallback
  };
}
