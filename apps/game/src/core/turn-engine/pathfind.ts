import type { Position } from '@shared-types/action';
import type { GridState } from '@shared-types/run-state';
import { inBounds, tileAt } from './grid';

/**
 * Grid pathfinding — T-441e (TDD §5).
 *
 * Baseline enemy AI used to chase by greedily minimising Chebyshev distance to
 * the target. That metric is "as the crow flies": it has no idea a wall is in
 * the way, so an enemy would stall against an obstacle that a player could
 * trivially walk around. This module replaces the crow-flies estimate with a
 * true, wall-aware shortest-path distance.
 *
 * The grid is 8-connected with uniform step cost (diagonals count as one step,
 * matching {@link chebyshev} and the enemy movement rules), so a breadth-first
 * sweep yields exact shortest-path *step counts* — there's no need for A*'s
 * priority queue or a heuristic on a unit-cost graph. The key property: **on
 * open terrain an 8-connected BFS distance is identical to the Chebyshev
 * distance**, so swapping the old metric for this one is a strict generalisation
 * — unchanged in the open, correct around obstacles.
 *
 * Performance: one sweep is O(width · height). On the production 7×7 combat grid
 * that's ~49 cells; even a 100×100 room is 10k cells, microseconds per enemy,
 * comfortably inside the 16 ms turn budget (TDD §5.7).
 */

/** Distance marker for a tile the goal cannot reach (walls, sealed pockets). */
export const UNREACHABLE = -1;

/** 8-neighbour offsets, orthogonal first to match the movement tie-break. */
const NEIGHBORS: readonly (readonly [number, number])[] = [
  [0, -1], [0, 1], [-1, 0], [1, 0], [-1, -1], [-1, 1], [1, -1], [1, 1],
];

/**
 * Computes the BFS distance field from `goal` over 8-connected passable tiles
 * (walls block; every other tile type is traversable, matching the movement
 * rules — hazards are walkable, they just hurt on entry). Returns a row-major
 * `Int32Array` of step counts where each cell holds its shortest-path distance
 * to `goal`, or {@link UNREACHABLE} for walls and tiles the goal can't reach.
 *
 * Enemy occupancy is intentionally ignored here: allies may move out of the way
 * next turn, so they shouldn't permanently inflate the distance estimate. The
 * caller enforces "don't step onto an occupied tile" separately when picking the
 * actual move.
 */
export function bfsDistanceField(grid: GridState, goal: Position): Int32Array {
  const { width, height } = grid;
  const dist = new Int32Array(width * height).fill(UNREACHABLE);
  if (!inBounds(grid, goal) || tileAt(grid, goal) === 'wall') return dist;

  const start = goal.y * width + goal.x;
  dist[start] = 0;
  const queue: number[] = [start];
  let head = 0;
  while (head < queue.length) {
    const idx = queue[head++]!;
    const cx = idx % width;
    const cy = (idx - cx) / width;
    const nd = dist[idx]! + 1;
    for (const [dx, dy] of NEIGHBORS) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;
      const nidx = ny * width + nx;
      if (dist[nidx] !== UNREACHABLE) continue;
      if (grid.tiles[nidx] === 'wall') continue;
      dist[nidx] = nd;
      queue.push(nidx);
    }
  }
  return dist;
}

/** Reads a tile's distance out of a field produced by {@link bfsDistanceField}. */
export function fieldAt(field: Int32Array, grid: GridState, p: Position): number {
  return field[p.y * grid.width + p.x]!;
}
