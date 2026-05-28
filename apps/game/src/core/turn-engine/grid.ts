import type { Position } from '@shared-types/action';
import type { GridState, TileType } from '@shared-types/run-state';

export function inBounds(grid: GridState, pos: Position): boolean {
  return pos.x >= 0 && pos.x < grid.width && pos.y >= 0 && pos.y < grid.height;
}

/** Caller must ensure `inBounds(grid, pos)` first. */
export function tileAt(grid: GridState, pos: Position): TileType {
  return grid.tiles[pos.y * grid.width + pos.x]!;
}

/** Chebyshev (king-move) distance — diagonals count as one step. */
export function chebyshev(a: Position, b: Position): number {
  return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
}
