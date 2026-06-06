import type { Position } from '@shared-types/action';
import type { GridState } from '@shared-types/run-state';
import { chebyshev, inBounds, tileAt } from './grid';

/**
 * Tactical line-of-sight & detection — T-441c (GDD §6.1a).
 *
 * Inside a room, an entity sees another only along an unobstructed line within
 * its vision radius. Enemies use this to decide whether to wake: they stay
 * dormant until the player steps into sight, rather than the whole room aggroing
 * the instant it loads. (The same primitive will back the player-side fog of war
 * when the renderer lands — T-441d.)
 */

/**
 * How far an enemy can spot the player, in Chebyshev (king-move) tiles. Tuned to
 * be most of a legible 7–14 phone-sized room but not all of it, so approaching
 * from cover or the far corner stays an option. Pure constant — no magic numbers
 * sprinkled through the AI.
 */
export const ENEMY_VISION_RANGE = 6;

/**
 * True when no wall lies strictly between `a` and `b` along the Bresenham line.
 * The endpoints themselves never block (an enemy standing in a doorway can still
 * see out; the player's own tile doesn't occlude). Symmetric for the open/hazard
 * tile types — only `wall` occludes sight.
 */
export function hasLineOfSight(grid: GridState, a: Position, b: Position): boolean {
  // Canonical integer Bresenham (dy carried negative). The error term advances
  // by `dy` on an x-step and by `dx` on a y-step — getting that pairing wrong
  // makes axis-aligned and diagonal lines never land on `b` and loop forever.
  const dx = Math.abs(b.x - a.x);
  const dy = -Math.abs(b.y - a.y);
  const sx = a.x < b.x ? 1 : -1;
  const sy = a.y < b.y ? 1 : -1;
  let err = dx + dy;
  let x = a.x;
  let y = a.y;

  // Walk from `a` toward `b`. The source tile is never wall-tested, and reaching
  // `b` short-circuits to "clear" before its own tile is tested, so neither
  // endpoint can self-occlude — only an intermediate wall blocks sight.
  for (;;) {
    if (x === b.x && y === b.y) return true;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x += sx; }
    if (e2 <= dx) { err += dx; y += sy; }
    if (x === b.x && y === b.y) return true; // reached the target — unobstructed
    if (inBounds(grid, { x, y }) && tileAt(grid, { x, y }) === 'wall') return false;
  }
}

/**
 * True when `viewer` can detect `target`: within {@link ENEMY_VISION_RANGE} and
 * with a clear line of sight. The range gate is checked first (cheap) before the
 * Bresenham walk.
 */
export function canDetect(grid: GridState, viewer: Position, target: Position): boolean {
  if (chebyshev(viewer, target) > ENEMY_VISION_RANGE) return false;
  return hasLineOfSight(grid, viewer, target);
}
