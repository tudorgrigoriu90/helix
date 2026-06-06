import { describe, it, expect } from 'vitest';
import type { GridState, TileType } from '@shared-types/run-state';
import { hasLineOfSight, canDetect, ENEMY_VISION_RANGE } from './visibility';

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

function openGrid(width = 20, height = 20): GridState {
  return { width, height, tiles: new Array<TileType>(width * height).fill('open') };
}

describe('hasLineOfSight — T-441c', () => {
  it('sees a target on open terrain', () => {
    const grid = openGrid();
    expect(hasLineOfSight(grid, { x: 0, y: 0 }, { x: 5, y: 3 })).toBe(true);
  });

  it('sees an adjacent target', () => {
    const grid = openGrid();
    expect(hasLineOfSight(grid, { x: 2, y: 2 }, { x: 3, y: 2 })).toBe(true);
  });

  it('is blocked by a wall directly between the two points', () => {
    const grid = gridFromAscii(['.....', '..#..', '.....']);
    // Straight horizontal line at y=1 from (0,1) to (4,1) crosses the wall (2,1).
    expect(hasLineOfSight(grid, { x: 0, y: 1 }, { x: 4, y: 1 })).toBe(false);
  });

  it('is not blocked when the wall is off the sight line', () => {
    const grid = gridFromAscii(['.....', '..#..', '.....']);
    // Line along y=0 never touches the wall on the row below.
    expect(hasLineOfSight(grid, { x: 0, y: 0 }, { x: 4, y: 0 })).toBe(true);
  });

  it('does not count the endpoints themselves as occluders', () => {
    // Target standing on a wall tile is still "seen" — its own tile never blocks.
    const grid = gridFromAscii(['....', '...#']);
    expect(hasLineOfSight(grid, { x: 0, y: 1 }, { x: 3, y: 1 })).toBe(true);
  });

  it('hazard tiles do not block sight (only walls do)', () => {
    const grid = gridFromAscii(['.....', '..H..', '.....']);
    expect(hasLineOfSight(grid, { x: 0, y: 1 }, { x: 4, y: 1 })).toBe(true);
  });

  it('blocks a diagonal sight line crossing a wall', () => {
    const grid = gridFromAscii(['....', '.#..', '....', '....']);
    // Diagonal from (0,0) to (3,3) passes through (1,1), a wall.
    expect(hasLineOfSight(grid, { x: 0, y: 0 }, { x: 3, y: 3 })).toBe(false);
  });
});

describe('canDetect — T-441c', () => {
  it('detects a target within range and line of sight', () => {
    const grid = openGrid();
    expect(canDetect(grid, { x: 0, y: 0 }, { x: ENEMY_VISION_RANGE, y: 0 })).toBe(true);
  });

  it('does not detect a target just beyond vision range', () => {
    const grid = openGrid();
    expect(canDetect(grid, { x: 0, y: 0 }, { x: ENEMY_VISION_RANGE + 1, y: 0 })).toBe(false);
  });

  it('does not detect an in-range target hidden behind a wall', () => {
    const grid = gridFromAscii(['.....', '..#..', '.....']);
    expect(canDetect(grid, { x: 0, y: 1 }, { x: 4, y: 1 })).toBe(false);
  });
});
