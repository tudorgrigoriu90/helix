import type { RoomNode } from '@shared-types/floor-graph';

/**
 * Pure layout helpers for rendering a floor's room graph (used by the tutorial
 * map and the production game scene).
 *
 * Kept separate from the scenes so they can be unit-tested without spinning up
 * Phaser. All functions are pure; no DOM, no canvas, no global state.
 */

export interface Bounds {
  readonly minX: number;
  readonly minY: number;
  readonly maxX: number;
  readonly maxY: number;
  /** maxX - minX. May be zero for vertically-collinear layouts. */
  readonly width: number;
  /** maxY - minY. May be zero for horizontally-collinear layouts. */
  readonly height: number;
}

export interface Viewport {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface LayoutTransform {
  /** Screen pixels per logical grid unit. */
  readonly scale: number;
  /** Screen X for `room.pos.x === bounds.minX`. */
  readonly offsetX: number;
  /** Screen Y for `room.pos.y === bounds.minY`. */
  readonly offsetY: number;
}

export interface LayoutOptions {
  /** Minimum scale (px per grid unit) so single-row layouts still feel spacious. */
  readonly minScale?: number;
  /** Maximum scale so tiny graphs don't blow up to screen size. */
  readonly maxScale?: number;
  /** Inner padding inside the viewport (each side). */
  readonly padding?: number;
}

/** Compute the axis-aligned bounding box of a room set. Empty input → zero box. */
export function computeBounds(rooms: readonly RoomNode[]): Bounds {
  if (rooms.length === 0) {
    return { minX: 0, minY: 0, maxX: 0, maxY: 0, width: 0, height: 0 };
  }
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const r of rooms) {
    if (r.pos.x < minX) minX = r.pos.x;
    if (r.pos.y < minY) minY = r.pos.y;
    if (r.pos.x > maxX) maxX = r.pos.x;
    if (r.pos.y > maxY) maxY = r.pos.y;
  }
  return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY };
}

/**
 * Fit a graph's bounds into a viewport, preserving aspect ratio. Scale is
 * clamped to [minScale, maxScale] so very-small or very-large graphs still
 * render legibly. The transform centers the bounds within the viewport.
 *
 * Zero-width or zero-height bounds (e.g. a perfect-horizontal-chain linear
 * layout) are handled by treating the degenerate axis as if it had a single
 * unit of extent — the scale picker uses the non-degenerate axis.
 */
export function computeLayout(
  bounds: Bounds,
  viewport: Viewport,
  options: LayoutOptions = {},
): LayoutTransform {
  const { minScale = 24, maxScale = 70, padding = 24 } = options;

  const innerW = Math.max(1, viewport.width - 2 * padding);
  const innerH = Math.max(1, viewport.height - 2 * padding);

  // Treat zero extents as 1 unit (a single node row/column still gets
  // breathing room) but keep the *projection math* faithful — we just want
  // the scale picker not to divide by zero.
  const wForScale = bounds.width > 0 ? bounds.width : 1;
  const hForScale = bounds.height > 0 ? bounds.height : 1;

  let scale = Math.min(innerW / wForScale, innerH / hForScale);
  scale = Math.max(minScale, Math.min(maxScale, scale));

  const usedW = bounds.width * scale;
  const usedH = bounds.height * scale;

  // Center within the viewport (after padding).
  const offsetX = viewport.x + padding + (innerW - usedW) / 2;
  const offsetY = viewport.y + padding + (innerH - usedH) / 2;

  return { scale, offsetX, offsetY };
}

/** Project a logical position into screen coordinates using the layout transform. */
export function project(
  pos: { readonly x: number; readonly y: number },
  bounds: Bounds,
  transform: LayoutTransform,
): { readonly x: number; readonly y: number } {
  return {
    x: transform.offsetX + (pos.x - bounds.minX) * transform.scale,
    y: transform.offsetY + (pos.y - bounds.minY) * transform.scale,
  };
}
