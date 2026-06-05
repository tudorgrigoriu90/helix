/**
 * In-room tactical fog — T-441b / GDD §6.1a.
 *
 * Simple vision-radius model: the player sees tiles within VISION_RADIUS
 * (Chebyshev distance). Living enemies outside that radius are hidden from
 * the display so the player must explore the room. Dead enemies remain
 * visible as permanent room-state markers.
 *
 * Phaser-free — unit-testable without a scene.
 */

import { chebyshev } from '../core/turn-engine/grid';

// ── Constants ─────────────────────────────────────────────────────────────────

/** Player vision radius in tiles (Chebyshev). GDD §6.1a: "close-range awareness". */
export const VISION_RADIUS = 5;

/**
 * Width of the smooth fog gradient at the vision edge (in tiles).
 * Tiles at distance `VISION_RADIUS + GRADIENT_WIDTH` and beyond are fully
 * fogged; between `VISION_RADIUS` and that threshold the fog fades in.
 */
const GRADIENT_WIDTH = 2;

/** Maximum fog alpha. Not 1.0 so the background tile is still hinted. */
const MAX_FOG_ALPHA = 0.88;

// ── Core functions ────────────────────────────────────────────────────────────

/** True when `tilePos` is within the player's current vision radius. */
export function isInVision(
  playerPos: { readonly x: number; readonly y: number },
  tilePos: { readonly x: number; readonly y: number },
): boolean {
  return chebyshev(playerPos, tilePos) <= VISION_RADIUS;
}

/**
 * Returns the fog overlay alpha [0, MAX_FOG_ALPHA] for a tile at `tilePos`.
 *
 * 0           — fully visible (no overlay needed).
 * 0…MAX_FOG  — gradient transition zone just beyond the vision edge.
 * MAX_FOG     — deep fog; tile is fully hidden.
 */
export function fogAlpha(
  playerPos: { readonly x: number; readonly y: number },
  tilePos: { readonly x: number; readonly y: number },
): number {
  const dist = chebyshev(playerPos, tilePos);
  if (dist <= VISION_RADIUS) return 0;
  const excess = dist - VISION_RADIUS;
  if (excess >= GRADIENT_WIDTH) return MAX_FOG_ALPHA;
  return MAX_FOG_ALPHA * (excess / GRADIENT_WIDTH);
}
