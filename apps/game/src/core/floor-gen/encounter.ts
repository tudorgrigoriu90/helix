import type { Position } from '@shared-types/action';
import type { FloorTemplate } from '@shared-types/floor-template';
import type { EnemySpawn, PopulatedRoom, TypedRoom } from '@shared-types/floor-plan';
import type { GridState, TileType } from '@shared-types/run-state';
import type { Mulberry32 } from '../rng/mulberry32';

/**
 * Encounter builder — T-74 (enemy placement) + T-75 (hazards) + T-77 (boss room).
 *
 * Turns a {@link TypedRoom} into a fully populated {@link PopulatedRoom}: a
 * combat grid, the tile the player enters on, enemy spawns appropriate to the
 * room type, hazard tiles for combat rooms, and the boss-room treatment
 * (10x10 grid + locked door).
 *
 * **Determinism:** identical `(typed, template, rng-state)` → identical room.
 * RNG draws happen in a fixed order (enemy count → enemy tiles → enemy defs →
 * hazard tiles) so the stream is stable.
 *
 * Enemy *stat* scaling per floor (T-78) is deliberately out of scope here — this
 * places who/where, not how strong.
 */

// ── Tunables ─────────────────────────────────────────────────────────────────

/** Standard combat-room grid (GDD §6.1 reference room). Boss rooms override. */
const STANDARD_ROOM_SIZE = 7;
/** Boss arena is larger to give the fight room to breathe (T-77 / GDD §7.4). */
const BOSS_ROOM_SIZE = 10;

/** Inclusive enemy-count range for a standard combat room. */
const COMBAT_ENEMY_MIN = 2;
const COMBAT_ENEMY_MAX = 4;

/** Inclusive hazard-count range for a combat room (GDD §6.1, §7.2 / T-75). */
const HAZARD_MIN = 1;
const HAZARD_MAX = 3;

// ── Grid helpers ─────────────────────────────────────────────────────────────

function openGrid(width: number, height: number): GridState {
  return { width, height, tiles: new Array<TileType>(width * height).fill('open') };
}

const tileKey = (p: Position): string => `${p.x},${p.y}`;

/**
 * Returns a copy of `grid` with 1-3 hazard tiles stamped in (T-75), avoiding the
 * `reserved` tiles (player spawn + enemy spawns). Hazards live in the grid as
 * the `hazard` TileType — there's no separate hazard list to keep in sync.
 */
function withHazards(grid: GridState, reserved: readonly Position[], rng: Mulberry32): GridState {
  const reservedKeys = new Set(reserved.map(tileKey));
  const candidates: Position[] = [];
  for (let y = 0; y < grid.height; y++) {
    for (let x = 0; x < grid.width; x++) {
      const p = { x, y };
      if (grid.tiles[y * grid.width + x] === 'open' && !reservedKeys.has(tileKey(p))) {
        candidates.push(p);
      }
    }
  }

  const count = HAZARD_MIN + rng.nextInt(HAZARD_MAX - HAZARD_MIN + 1);
  const picked = sampleTiles(candidates, count, rng);

  const tiles = grid.tiles.slice();
  for (const p of picked) tiles[p.y * grid.width + p.x] = 'hazard';
  return { ...grid, tiles };
}

/** Player enters at the bottom-centre of the room. */
function playerSpawnFor(grid: GridState): Position {
  return { x: Math.floor(grid.width / 2), y: grid.height - 1 };
}

/**
 * Draws `k` distinct tiles from `candidates` without replacement. Returns fewer
 * than `k` only if the candidate pool is smaller than `k`.
 */
function sampleTiles(candidates: readonly Position[], k: number, rng: Mulberry32): Position[] {
  const pool = candidates.slice();
  const picked: Position[] = [];
  for (let i = 0; i < k && pool.length > 0; i++) {
    const idx = rng.nextInt(pool.length);
    picked.push(pool[idx]!);
    pool.splice(idx, 1);
  }
  return picked;
}

/** All grid tiles strictly above the player's half — keeps enemies off the entrance. */
function enemyCandidateTiles(grid: GridState): Position[] {
  const cutoff = Math.floor(grid.height / 2); // rows [0, cutoff) are the far half
  const tiles: Position[] = [];
  for (let y = 0; y < cutoff; y++) {
    for (let x = 0; x < grid.width; x++) {
      tiles.push({ x, y });
    }
  }
  return tiles;
}

// ── Public entry point ──────────────────────────────────────────────────────

export function buildRoom(
  typed: TypedRoom,
  template: FloorTemplate,
  rng: Mulberry32,
): PopulatedRoom {
  if (typed.type === 'boss') return buildBossRoom(typed, template, rng);

  const base = openGrid(STANDARD_ROOM_SIZE, STANDARD_ROOM_SIZE);
  const playerSpawn = playerSpawnFor(base);
  const enemies = typed.type === 'combat' ? placeCombatEnemies(base, template, rng) : [];

  // Hazards only in combat rooms, kept off the player and enemy spawns.
  const grid =
    typed.type === 'combat'
      ? withHazards(base, [playerSpawn, ...enemies.map((e) => e.pos)], rng)
      : base;

  return {
    id: typed.id,
    pos: typed.pos,
    type: typed.type,
    grid,
    playerSpawn,
    enemies,
    locked: false,
  };
}

/** Boss room: a larger arena, a single boss spawn, locked until cleared (T-77). */
function buildBossRoom(
  typed: TypedRoom,
  template: FloorTemplate,
  _rng: Mulberry32,
): PopulatedRoom {
  const grid = openGrid(BOSS_ROOM_SIZE, BOSS_ROOM_SIZE);
  const playerSpawn = playerSpawnFor(grid);
  const enemies: EnemySpawn[] = [
    { enemyDefId: template.bossId, pos: { x: Math.floor(grid.width / 2), y: 1 } },
  ];
  return {
    id: typed.id,
    pos: typed.pos,
    type: typed.type,
    grid,
    playerSpawn,
    enemies,
    locked: true,
  };
}

function placeCombatEnemies(
  grid: GridState,
  template: FloorTemplate,
  rng: Mulberry32,
): EnemySpawn[] {
  if (template.enemyPool.length === 0) return []; // defensive — validator forbids empty pools

  const count = COMBAT_ENEMY_MIN + rng.nextInt(COMBAT_ENEMY_MAX - COMBAT_ENEMY_MIN + 1);
  const tiles = sampleTiles(enemyCandidateTiles(grid), count, rng);
  return tiles.map((pos) => ({
    enemyDefId: template.enemyPool[rng.nextInt(template.enemyPool.length)]!,
    pos,
  }));
}
