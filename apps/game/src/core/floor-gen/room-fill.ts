import type { FloorGraph } from '@shared-types/floor-graph';
import type {
  FloorTemplate,
  RoomType,
  RoomTypeMinima,
  RoomTypeWeights,
} from '@shared-types/floor-template';
import type { TypedRoom } from '@shared-types/floor-plan';
import type { Mulberry32 } from '../rng/mulberry32';

/**
 * Room-type filler — T-73 (GDD §7.2 / TDD §7.1 step 5).
 *
 * Assigns a {@link RoomType} to every room in the placed graph:
 *
 *   - The boss room (`graph.bossRoomId`) is always `boss`.
 *   - The start room (`graph.startRoomId`) is always `safe` — the entrance is a
 *     guaranteed resting point (the rationale behind the `safe` minimum in
 *     RoomTypeMinima), and it counts toward the `safe` minimum.
 *   - Remaining hard minima (e.g. `merchant: 1`) are placed next, on the
 *     earliest unassigned rooms.
 *   - Every other room is drawn by weighted random sampling over
 *     {@link RoomTypeWeights}.
 *
 * **Determinism:** identical `(graph, template, rng-state)` → identical
 * assignment. Rooms are processed in their graph order so the RNG draw sequence
 * is stable.
 *
 * Throws when the template's minima cannot fit in the available rooms — the
 * generation orchestrator (T-79) treats that as a failed attempt and retries,
 * then falls back.
 */

const FILLABLE_TYPES: readonly RoomType[] = [
  'combat',
  'loot',
  'safe',
  'merchant',
  'trap',
  'lace_event',
];

/** Weighted random draw over the six fillable room types. */
function drawWeightedType(weights: RoomTypeWeights, rng: Mulberry32): RoomType {
  const total =
    weights.combat +
    weights.loot +
    weights.safe +
    weights.merchant +
    weights.trap +
    weights.lace_event;
  // A non-positive total would make the draw meaningless; treat as malformed.
  if (total <= 0) {
    throw new Error('floor-gen: roomWeights sum to a non-positive total');
  }

  let r = rng.next() * total;
  const ordered: ReadonlyArray<readonly [RoomType, number]> = [
    ['combat', weights.combat],
    ['loot', weights.loot],
    ['safe', weights.safe],
    ['merchant', weights.merchant],
    ['trap', weights.trap],
    ['lace_event', weights.lace_event],
  ];
  for (const [type, w] of ordered) {
    r -= w;
    if (r < 0) return type;
  }
  // Floating-point guard: fall through to the last positive-weight type.
  return 'combat';
}

/** Required count for a minimum entry, defaulting absent keys to 0. */
function minimumCount(minima: RoomTypeMinima, type: RoomType): number {
  switch (type) {
    case 'safe':       return minima.safe ?? 0;
    case 'merchant':   return minima.merchant ?? 0;
    case 'loot':       return minima.loot ?? 0;
    case 'trap':       return minima.trap ?? 0;
    case 'lace_event': return minima.lace_event ?? 0;
    default:           return 0; // combat/boss have no minima
  }
}

export function fillRoomTypes(
  graph: FloorGraph,
  template: FloorTemplate,
  rng: Mulberry32,
): TypedRoom[] {
  const assigned = new Map<string, RoomType>();
  assigned.set(graph.bossRoomId, 'boss');
  assigned.set(graph.startRoomId, 'safe');

  // Track how many of each type are still owed by the minima. The start room
  // already covers one `safe`.
  const owed = new Map<RoomType, number>();
  for (const type of FILLABLE_TYPES) {
    const need = minimumCount(template.roomMinima, type) - (type === 'safe' ? 1 : 0);
    if (need > 0) owed.set(type, need);
  }

  // Rooms still needing a type, in stable graph order (excludes start + boss).
  const open = graph.rooms.filter((r) => !assigned.has(r.id));

  const totalOwed = [...owed.values()].reduce((a, b) => a + b, 0);
  if (totalOwed > open.length) {
    throw new Error(
      `floor-gen: room minima require ${totalOwed} room(s) beyond start/boss but only ${open.length} are available`,
    );
  }

  let cursor = 0;
  for (const [type, count] of owed) {
    for (let k = 0; k < count; k++) {
      const room = open[cursor]!;
      assigned.set(room.id, type);
      cursor++;
    }
  }

  // Weighted-fill whatever remains.
  for (; cursor < open.length; cursor++) {
    const room = open[cursor]!;
    assigned.set(room.id, drawWeightedType(template.roomWeights, rng));
  }

  return graph.rooms.map((r) => ({ id: r.id, pos: r.pos, type: assigned.get(r.id)! }));
}
