import { describe, it, expect } from 'vitest';
import type { EnemyState, GridState, RunState, TileType } from '@shared-types/run-state';
import { threatenedTiles, enemyInReach, posKey, ENEMY_REACH } from './combat-threat';

function openGrid(width = 7, height = 7): GridState {
  return { width, height, tiles: new Array<TileType>(width * height).fill('open') };
}

function gridWithWall(x: number, y: number, width = 7, height = 7): GridState {
  const tiles = new Array<TileType>(width * height).fill('open');
  tiles[y * width + x] = 'wall';
  return { width, height, tiles };
}

function enemy(id: string, pos: { x: number; y: number }, over: Partial<EnemyState> = {}): EnemyState {
  return {
    id,
    enemyDefId: 'test-enemy',
    pos,
    hp: 30,
    maxHp: 30,
    stats: { str: 12, res: 3, agi: 8, int: 5 },
    statuses: [],
    telegraph: null,
    ...over,
  };
}

function state(over: Partial<RunState> = {}): RunState {
  return {
    schemaVersion: 1,
    seed: 1,
    floorNumber: 1,
    phase: 'player',
    turn: 1,
    grid: openGrid(),
    player: {
      id: 'player', pos: { x: 3, y: 3 }, hp: 100, maxHp: 100, ap: 3, maxAp: 3,
      stats: { str: 10, res: 10, agi: 10, int: 10 }, statuses: [], abilities: [], items: [], mutations: [],
    },
    enemies: [],
    ...over,
  };
}

describe('threatenedTiles — T-159', () => {
  it('marks the 8 neighbours of a single enemy', () => {
    const s = state({ enemies: [enemy('e1', { x: 3, y: 3 })] });
    const threatened = threatenedTiles(s);
    expect(threatened.size).toBe(8);
    const neighbours: ReadonlyArray<readonly [number, number]> = [
      [-1, -1], [0, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [0, 1], [1, 1],
    ];
    for (const [dx, dy] of neighbours) {
      expect(threatened.has(posKey({ x: 3 + dx, y: 3 + dy }))).toBe(true);
    }
    // The enemy's own tile is not a step-into threat tile.
    expect(threatened.has(posKey({ x: 3, y: 3 }))).toBe(false);
  });

  it('excludes out-of-bounds tiles for a corner enemy', () => {
    const s = state({ enemies: [enemy('e1', { x: 0, y: 0 })] });
    const threatened = threatenedTiles(s);
    // Only (1,0), (0,1), (1,1) are in bounds.
    expect(threatened.size).toBe(3);
    expect(threatened.has(posKey({ x: 1, y: 0 }))).toBe(true);
    expect(threatened.has(posKey({ x: 0, y: 1 }))).toBe(true);
    expect(threatened.has(posKey({ x: 1, y: 1 }))).toBe(true);
  });

  it('excludes wall tiles', () => {
    const s = state({ grid: gridWithWall(4, 3), enemies: [enemy('e1', { x: 3, y: 3 })] });
    expect(threatenedTiles(s).has(posKey({ x: 4, y: 3 }))).toBe(false);
  });

  it('does not mark a tile occupied by another living enemy', () => {
    const s = state({ enemies: [enemy('e1', { x: 3, y: 3 }), enemy('e2', { x: 4, y: 3 })] });
    const threatened = threatenedTiles(s);
    // (4,3) holds e2, so it is not a step-into threat tile even though e1 reaches it.
    expect(threatened.has(posKey({ x: 4, y: 3 }))).toBe(false);
    // But (5,3) — reached only by e2 — is threatened.
    expect(threatened.has(posKey({ x: 5, y: 3 }))).toBe(true);
  });

  it('unions overlapping reach from two enemies without double-counting', () => {
    const s = state({ enemies: [enemy('e1', { x: 2, y: 3 }), enemy('e2', { x: 4, y: 3 })] });
    const threatened = threatenedTiles(s);
    // (3,3) sits between both and is reached by each — counted once.
    expect(threatened.has(posKey({ x: 3, y: 3 }))).toBe(true);
  });

  it('ignores dead enemies', () => {
    const s = state({ enemies: [enemy('e1', { x: 3, y: 3 }, { hp: 0 })] });
    expect(threatenedTiles(s).size).toBe(0);
  });

  it('returns an empty set with no enemies', () => {
    expect(threatenedTiles(state()).size).toBe(0);
  });
});

describe('enemyInReach — T-159', () => {
  it('is true for an adjacent living enemy', () => {
    expect(enemyInReach(enemy('e1', { x: 4, y: 3 }), { x: 3, y: 3 })).toBe(true);
    expect(enemyInReach(enemy('e1', { x: 4, y: 4 }), { x: 3, y: 3 })).toBe(true); // diagonal
  });

  it('is false for an enemy two tiles away', () => {
    expect(enemyInReach(enemy('e1', { x: 5, y: 3 }), { x: 3, y: 3 })).toBe(false);
  });

  it('is false for a dead adjacent enemy', () => {
    expect(enemyInReach(enemy('e1', { x: 4, y: 3 }, { hp: 0 }), { x: 3, y: 3 })).toBe(false);
  });

  it('honours a custom reach', () => {
    expect(enemyInReach(enemy('e1', { x: 5, y: 3 }), { x: 3, y: 3 }, 2)).toBe(true);
  });

  it('exposes the baseline reach constant', () => {
    expect(ENEMY_REACH).toBe(1);
  });
});
