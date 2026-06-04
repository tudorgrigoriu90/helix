import type { RoomType } from '@shared-types/floor-template';

/**
 * Color-blind-friendly room glyphs (T-156, GDD §17 a11y).
 *
 * The map already tints rooms by role (combat blue, boss red, …), but colour
 * alone fails ~8% of players. This maps every {@link RoomType} to a distinct
 * *shape* glyph so the room type is always legible from form, not hue — a
 * redundant encoding that is always on (no toggle), which is the accessible
 * default rather than an opt-in.
 *
 * Glyphs are drawn over the node on the full map and the expanded minimap (the
 * compact widget plots plain dots — too small for a glyph). Kept Phaser-free so
 * it can be unit-tested without a scene.
 */

const GLYPHS: Record<RoomType, string> = {
  combat: '⚔',      // crossed swords
  loot: '◆',        // filled diamond
  safe: '✚',        // heal cross
  merchant: '$',    // dispenser / shop
  trap: '▲',        // warning triangle
  lace_event: '✦',  // narrative spark
  boss: '★',        // star
};

/** Distinct shape glyph for a room type (T-156). */
export function roomGlyph(type: RoomType): string {
  return GLYPHS[type] ?? '?';
}
