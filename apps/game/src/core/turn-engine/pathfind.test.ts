import { describe, it, expect } from 'vitest';
import type { GridState, TileType } from '@shared-types/run-state';
import { bfsDistanceField, fieldAt, UNREACHABLE } from './pathfind';
import { chebyshev } from './grid';

function openGrid(width = 7, height = 7): GridState {
  return { width, height, tiles: new Array<TileType>(width * height).fill('open') };
}

/** Build a grid from an ASCII map: '.' open, '#' wall, 'H' hazard. */
function gridFromAscii(rows: readonly string[]): GridState {
  const height = rows.length;
  const width = rows[0]!.length;
  const tiles: TileType[] = [];
  for (const row of rows) {
    for (const ch of row) {
      tiles.push(ch === '#' ? 'wall' : ch === 'H' ? 'hazard' : 'open');
    }
  }
  return { width, height, tiles };
}

describe('bfsDistanceField — T-441e', () => {
  it('equals Chebyshev distance on fully open terrain', () => {
    const grid = openGrid();
    const goal = { x: 3, y: 3 };
    const field = bfsDistanceField(grid, goal);
    for (let y = 0; y < grid.height; y++) {
      for (let x = 0; x < grid.width; x++) {
        expect(fieldAt(field, grid, { x, y })).toBe(chebyshev({ x, y }, goal));
      }
    }
  });

  it('marks the goal tile itself as distance 0', () => {
    const grid = openGrid();
    const field = bfsDistanceField(grid, { x: 2, y: 4 });
    expect(fieldAt(field, grid, { x: 2, y: 4 })).toBe(0);
  });

  it('marks wall tiles as unreachable', () => {
    const grid = gridFromAscii([
      '.....',
      '..#..',
      '.....',
    ]);
    const field = bfsDistanceField(grid, { x: 0, y: 0 });
    expect(fieldAt(field, grid, { x: 2, y: 1 })).toBe(UNREACHABLE);
  });

  it('routes around a wall — distance exceeds the crow-flies estimate', () => {
    // A vertical wall column splits the room; reaching the far side must detour
    // around the top, so the true path is longer than Chebyshev would suggest.
    const grid = gridFromAscii([
      '...#...',
      '...#...',
      '...#...',
      '...#...',
      '.......', // gap at the bottom row
    ]);
    const goal = { x: 0, y: 0 };
    const target = { x: 6, y: 0 };
    const field = bfsDistanceField(grid, goal);
    const crow = chebyshev(goal, target); // 6
    expect(fieldAt(field, grid, target)).toBeGreaterThan(crow);
    expect(fieldAt(field, grid, target)).not.toBe(UNREACHABLE);
  });

  it('returns an all-unreachable field when the goal is a wall', () => {
    const grid = gridFromAscii(['.#.', '...']);
    const field = bfsDistanceField(grid, { x: 1, y: 0 });
    expect(fieldAt(field, grid, { x: 0, y: 1 })).toBe(UNREACHABLE);
  });

  it('returns an all-unreachable field when the goal is out of bounds', () => {
    const grid = openGrid(3, 3);
    const field = bfsDistanceField(grid, { x: 9, y: 9 });
    expect(field.every((d) => d === UNREACHABLE)).toBe(true);
  });

  it('treats hazards as traversable (they hurt on entry, not block)', () => {
    const grid = gridFromAscii(['.H.', '...']);
    const field = bfsDistanceField(grid, { x: 0, y: 0 });
    expect(fieldAt(field, grid, { x: 1, y: 0 })).toBe(1); // hazard reachable in one step
  });

  it('walls off a sealed pocket as unreachable', () => {
    // Centre tile fully boxed in by walls — the goal outside can never reach it.
    const grid = gridFromAscii([
      '#####',
      '#...#',
      '#.#.#',
      '#...#',
      '#####',
    ]);
    const goal = { x: 1, y: 1 };
    const field = bfsDistanceField(grid, goal);
    // The wall at (2,2) is unreachable; every border wall too.
    expect(fieldAt(field, grid, { x: 2, y: 2 })).toBe(UNREACHABLE);
    // Open interior tiles remain reachable.
    expect(fieldAt(field, grid, { x: 3, y: 3 })).not.toBe(UNREACHABLE);
  });
});
