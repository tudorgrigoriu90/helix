import type { Viewport } from './floor-graph-layout';

/**
 * Pure minimap helpers (T-155, GDD §12.6).
 *
 * Backs the compact minimap widget shown on the combat / room screens (so the
 * player keeps a sense of where they are on the floor) and the full-screen map
 * it expands into. The drawing itself lives in the scene; the testable bits —
 * the corner rectangle and the floor-clear progress readout — live here.
 *
 * Kept Phaser-free so it can be unit-tested without a scene.
 */

export interface FloorProgress {
  /** Rooms the player has cleared (includes the start room). */
  readonly cleared: number;
  /** Total rooms on the floor. */
  readonly total: number;
  /** cleared / total, clamped to [0, 1]; 0 when the floor has no rooms. */
  readonly fraction: number;
}

/**
 * How many of a floor's rooms have been cleared. Drives the "ROOMS c/t" line on
 * the compact minimap + expanded map.
 */
export function floorProgress(
  roomIds: readonly string[],
  clearedIds: ReadonlySet<string>,
): FloorProgress {
  const total = roomIds.length;
  let cleared = 0;
  for (const id of roomIds) {
    if (clearedIds.has(id)) cleared += 1;
  }
  const fraction = total === 0 ? 0 : cleared / total;
  return { cleared, total, fraction };
}

/**
 * The compact minimap's screen rectangle, pinned to the top-right corner under
 * the HUD. Sized as a square `size`×`size` with `margin` of breathing room from
 * the right and top edges.
 */
export function compactMinimapRect(
  screenW: number,
  size: number,
  top: number,
  margin: number,
): Viewport {
  return { x: screenW - size - margin, y: top, width: size, height: size };
}
