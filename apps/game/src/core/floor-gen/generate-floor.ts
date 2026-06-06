import type { FloorEdge, FloorGraph, RoomNode } from '@shared-types/floor-graph';
import type { FloorTemplate, RoomType, RoomTypeMinima } from '@shared-types/floor-template';
import type { PopulatedFloor, TypedRoom } from '@shared-types/floor-plan';
import type { Mulberry32 } from '../rng/mulberry32';
import { placeRooms } from './room-placement';
import { validateConnectivity } from './connectivity';
import { fillRoomTypes } from './room-fill';
import { buildRoom } from './encounter';
import { placeCodexFragments } from './codex-fragments';

/**
 * Floor generation orchestrator — T-79 (TDD §7.1).
 *
 * Runs the full pipeline — placeRooms (T-71) → validateConnectivity (T-72) →
 * fillRoomTypes (T-73) → buildRoom per room (T-74/T-75/T-77) — and returns a
 * playable {@link PopulatedFloor}.
 *
 * Generation can legitimately fail an attempt: placement can throw on a cramped
 * loop, connectivity can (in principle) reject a graph, and the filler throws
 * when the template's minima cannot fit. Each failure retries against the
 * advanced RNG stream. After {@link MAX_GEN_ATTEMPTS} failures, a deterministic
 * fixed fallback floor is returned (`fromFallback: true`) so generation never
 * leaves the player without a floor.
 *
 * Assumes a loader-validated template (weights sum ~1.0, etc.). The fallback is
 * self-contained — it does no weighted draw and cannot throw — so it stays safe
 * even for templates whose topology/minima the procedural path can't satisfy.
 */

export const MAX_GEN_ATTEMPTS = 5;

export function generateFloor(template: FloorTemplate, rng: Mulberry32): PopulatedFloor {
  for (let attempt = 0; attempt < MAX_GEN_ATTEMPTS; attempt++) {
    const floor = tryGenerate(template, rng);
    if (floor !== null) return floor;
  }
  return buildFallbackFloor(template, rng);
}

/** One procedural attempt. Returns null on any recoverable failure. */
function tryGenerate(template: FloorTemplate, rng: Mulberry32): PopulatedFloor | null {
  try {
    const graph = placeRooms(template, rng);
    if (!validateConnectivity(graph).ok) return null;
    const typed = fillRoomTypes(graph, template, rng);
    return assemble(template, graph, typed, rng, false);
  } catch {
    return null;
  }
}

function assemble(
  template: FloorTemplate,
  graph: FloorGraph,
  typed: readonly TypedRoom[],
  rng: Mulberry32,
  fromFallback: boolean,
): PopulatedFloor {
  const rooms = typed.map((t) => buildRoom(t, template, rng));
  return {
    floor: template.floor,
    zone: template.zone,
    // Step 6 (GDD §7.2): scatter 0–4 Codex Fragments across non-boss rooms.
    // Last step so it can't invalidate topology/minima.
    rooms: placeCodexFragments(rooms, rng),
    edges: graph.edges,
    startRoomId: graph.startRoomId,
    bossRoomId: graph.bossRoomId,
    fromFallback,
  };
}

// ── Fixed fallback ───────────────────────────────────────────────────────────

const MINIMA_TYPES: readonly RoomType[] = ['safe', 'merchant', 'loot', 'trap', 'lace_event'];

function minimumCount(minima: RoomTypeMinima, type: RoomType): number {
  switch (type) {
    case 'safe':       return minima.safe ?? 0;
    case 'merchant':   return minima.merchant ?? 0;
    case 'loot':       return minima.loot ?? 0;
    case 'trap':       return minima.trap ?? 0;
    case 'lace_event': return minima.lace_event ?? 0;
    default:           return 0;
  }
}

/**
 * A guaranteed-valid linear floor with deterministic room types. Big enough to
 * hold every minimum plus a start and boss; no weighted randomness, so it is
 * fully predictable and cannot throw.
 */
function buildFallbackFloor(template: FloorTemplate, rng: Mulberry32): PopulatedFloor {
  const minimaTotal = MINIMA_TYPES.reduce((sum, t) => sum + minimumCount(template.roomMinima, t), 0);
  const n = Math.max(6, minimaTotal + 3);

  const rooms: RoomNode[] = [];
  const edges: FloorEdge[] = [];
  for (let i = 0; i < n; i++) {
    rooms.push({ id: `r${i}`, pos: { x: i, y: 0 } });
    if (i > 0) edges.push({ from: `r${i - 1}`, to: `r${i}` });
  }
  const graph: FloorGraph = { rooms, edges, startRoomId: 'r0', bossRoomId: `r${n - 1}` };

  const typed = assignFallbackTypes(graph, template);
  return assemble(template, graph, typed, rng, true);
}

/**
 * Deterministic type assignment for the fallback: start → safe, boss → boss,
 * remaining minima placed on the earliest open rooms, everything else → combat.
 * Mirrors fillRoomTypes' guarantees without its weighted draw.
 */
function assignFallbackTypes(graph: FloorGraph, template: FloorTemplate): TypedRoom[] {
  const assigned = new Map<string, RoomType>();
  assigned.set(graph.startRoomId, 'safe');
  assigned.set(graph.bossRoomId, 'boss');

  const open = graph.rooms.filter((r) => !assigned.has(r.id));
  let cursor = 0;
  for (const type of MINIMA_TYPES) {
    // The start room already covers one `safe`.
    const need = minimumCount(template.roomMinima, type) - (type === 'safe' ? 1 : 0);
    for (let k = 0; k < need && cursor < open.length; k++) {
      assigned.set(open[cursor]!.id, type);
      cursor++;
    }
  }
  for (; cursor < open.length; cursor++) {
    assigned.set(open[cursor]!.id, 'combat');
  }

  return graph.rooms.map((r) => ({ id: r.id, pos: r.pos, type: assigned.get(r.id)! }));
}
