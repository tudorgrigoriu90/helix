import type { FloorEdge, RoomNode } from '@shared-types/floor-graph';

/**
 * Floor-graph utilities shared by the placement algorithm (T-71) and the
 * connectivity validator (T-72). Both treat edges as undirected.
 */

/** Build an undirected adjacency list from a room/edge pair. */
export function buildAdjacency(
  rooms: readonly RoomNode[],
  edges: readonly FloorEdge[],
): Map<string, string[]> {
  const adj = new Map<string, string[]>();
  for (const r of rooms) adj.set(r.id, []);
  for (const e of edges) {
    adj.get(e.from)?.push(e.to);
    adj.get(e.to)?.push(e.from);
  }
  return adj;
}

/**
 * Distance in edges from `startId` to every reachable room. Unreachable rooms
 * are absent from the returned map. Treats edges as undirected.
 */
export function bfsDistances(
  startId: string,
  rooms: readonly RoomNode[],
  edges: readonly FloorEdge[],
): Map<string, number> {
  const adj = buildAdjacency(rooms, edges);
  const dist = new Map<string, number>([[startId, 0]]);
  const queue: string[] = [startId];
  let head = 0;
  while (head < queue.length) {
    const u = queue[head]!;
    head++;
    const du = dist.get(u)!;
    const neighbours = adj.get(u) ?? [];
    for (const v of neighbours) {
      if (!dist.has(v)) {
        dist.set(v, du + 1);
        queue.push(v);
      }
    }
  }
  return dist;
}

/**
 * True iff there is an edge directly connecting `a` and `b` (in either
 * direction). Used to enforce the start-boss non-adjacency rule (GDD §7.2 /
 * TDD §7.4).
 */
export function areAdjacent(
  a: string,
  b: string,
  edges: readonly FloorEdge[],
): boolean {
  for (const e of edges) {
    if ((e.from === a && e.to === b) || (e.from === b && e.to === a)) return true;
  }
  return false;
}
