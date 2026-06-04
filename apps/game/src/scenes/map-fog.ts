import type { FloorEdge } from '@shared-types/floor-graph';
import type { RoomType } from '@shared-types/floor-template';

/**
 * Pure map-level fog of war (T-154, GDD §7.2).
 *
 * As the player descends a floor, the minimap reveals room *outlines* one ring
 * ahead of where they've been but keeps each room's *type* hidden until it is
 * actually entered — so exploration still means something. Safe rooms are the
 * single exception: their location and type are known from the start so the
 * player can always navigate toward a rest.
 *
 * The reveal is derived entirely from the set of visited rooms plus the floor
 * topology, so it is fully deterministic, survives save/resume (both the
 * cleared set and the current room are persisted), and needs no extra state.
 *
 * Kept Phaser-free so it can be unit-tested without a scene.
 */

/** How much of a room the map should show. */
export type RevealLevel =
  /** Not drawn at all — beyond the explored frontier. */
  | 'hidden'
  /** Drawn as a bare outline; the player knows a room is *there*. */
  | 'discovered'
  /** Fully drawn — the player has stood in it. */
  | 'visited';

export interface RoomReveal {
  readonly level: RevealLevel;
  /**
   * Whether the room's *type* (icon / colour) should be shown. True for visited
   * rooms and for safe rooms (always known); false for a discovered outline,
   * which renders a neutral "?" instead.
   */
  readonly typeKnown: boolean;
}

interface RoomLike {
  readonly id: string;
  readonly type: RoomType;
}

interface FloorLike {
  readonly rooms: readonly RoomLike[];
  readonly edges: readonly FloorEdge[];
}

const HIDDEN: RoomReveal = { level: 'hidden', typeKnown: false };

/**
 * Compute the per-room reveal state for a floor given the rooms the player has
 * visited (entered or cleared). Every room in the floor gets an entry.
 *
 * Precedence, highest first:
 *   1. visited            → fully shown.
 *   2. safe room          → discovered with its type known (shown from start).
 *   3. neighbour of (1)   → discovered outline, type hidden.
 *   4. everything else    → hidden.
 */
export function computeFogReveal(
  floor: FloorLike,
  visited: ReadonlySet<string>,
): Map<string, RoomReveal> {
  // Rooms one corridor away from anything visited form the "discovered" ring.
  const frontier = new Set<string>();
  for (const e of floor.edges) {
    if (visited.has(e.from) && !visited.has(e.to)) frontier.add(e.to);
    if (visited.has(e.to) && !visited.has(e.from)) frontier.add(e.from);
  }

  const reveal = new Map<string, RoomReveal>();
  for (const room of floor.rooms) {
    if (visited.has(room.id)) {
      reveal.set(room.id, { level: 'visited', typeKnown: true });
    } else if (room.type === 'safe') {
      // Safe rooms are always at least discovered, and always reveal their type.
      reveal.set(room.id, { level: 'discovered', typeKnown: true });
    } else if (frontier.has(room.id)) {
      reveal.set(room.id, { level: 'discovered', typeKnown: false });
    } else {
      reveal.set(room.id, HIDDEN);
    }
  }
  return reveal;
}

/**
 * Whether the corridor between two rooms should be drawn. A corridor shows once
 * at least one of its rooms has been visited — this leads the eye outward from
 * explored ground toward the discovered frontier without exposing links between
 * two rooms the player hasn't reached yet.
 */
export function edgeVisible(
  edge: FloorEdge,
  visited: ReadonlySet<string>,
): boolean {
  return visited.has(edge.from) || visited.has(edge.to);
}
