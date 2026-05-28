import type { FloorGraph } from '@shared-types/floor-graph';
import { bfsDistances } from './graph';

/**
 * Connectivity validator — T-72 (TDD §7.1 step 4).
 *
 * The placement algorithm (T-71) builds connected graphs by construction, but
 * a floor is only playable if the player can actually reach the boss, so the
 * generation pipeline gates every candidate graph through this check before the
 * room-type filler runs (T-73). A failure here triggers a retry, and after the
 * retry budget is exhausted, the fixed-template fallback (T-79).
 *
 * Treats edges as undirected (the boss-door one-way rule is a FloorScene
 * concern, not a topology one — see floor-graph.ts).
 */

export type ConnectivityErrorCode =
  | 'MISSING_START'
  | 'MISSING_BOSS'
  | 'START_IS_BOSS'
  | 'BOSS_UNREACHABLE'
  | 'ORPHAN_ROOMS';

export interface ConnectivityError {
  readonly code: ConnectivityErrorCode;
  readonly message: string;
}

export type ConnectivityResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly error: ConnectivityError };

function fail(code: ConnectivityErrorCode, message: string): ConnectivityResult {
  return { ok: false, error: { code, message } };
}

/**
 * Validates that `graph` is playable: start and boss exist and differ, the boss
 * is reachable from the start, and no room is stranded off the main component.
 */
export function validateConnectivity(graph: FloorGraph): ConnectivityResult {
  const ids = new Set(graph.rooms.map((r) => r.id));

  if (!ids.has(graph.startRoomId)) {
    return fail('MISSING_START', `startRoomId "${graph.startRoomId}" is not a room in the graph`);
  }
  if (!ids.has(graph.bossRoomId)) {
    return fail('MISSING_BOSS', `bossRoomId "${graph.bossRoomId}" is not a room in the graph`);
  }
  if (graph.startRoomId === graph.bossRoomId) {
    return fail('START_IS_BOSS', 'startRoomId and bossRoomId must differ');
  }

  const distances = bfsDistances(graph.startRoomId, graph.rooms, graph.edges);

  if (!distances.has(graph.bossRoomId)) {
    return fail(
      'BOSS_UNREACHABLE',
      `no path from start "${graph.startRoomId}" to boss "${graph.bossRoomId}"`,
    );
  }

  // Every room must sit on the start's connected component — an orphan room is
  // content the player can never visit.
  if (distances.size !== graph.rooms.length) {
    const orphans = graph.rooms
      .filter((r) => !distances.has(r.id))
      .map((r) => r.id);
    return fail(
      'ORPHAN_ROOMS',
      `${orphans.length} room(s) unreachable from start: ${orphans.join(', ')}`,
    );
  }

  return { ok: true };
}
