import { describe, it, expect } from 'vitest';
import type { FloorEdge, FloorGraph, RoomNode } from '@shared-types/floor-graph';
import type { ConnectivityRule, FloorTemplate } from '@shared-types/floor-template';
import { Mulberry32 } from '../rng/mulberry32';
import { placeRooms } from './room-placement';
import { validateConnectivity } from './connectivity';

function templateFor(connectivity: ConnectivityRule): FloorTemplate {
  return {
    schemaVersion: 1,
    floor: 1,
    zone: 'shallows',
    roomCount: { min: 8, max: 14 },
    roomWeights: {
      combat: 0.4, loot: 0.2, safe: 0.15, merchant: 0.1, trap: 0.1, lace_event: 0.05,
    },
    roomMinima: { safe: 1 },
    connectivity,
    enemyPool: ['filterer', 'cave_crawler'],
    bossId: 'pressure_warden',
    aestheticTags: ['caves'],
  };
}

function graph(
  rooms: RoomNode[],
  edges: FloorEdge[],
  startRoomId: string,
  bossRoomId: string,
): FloorGraph {
  return { rooms, edges, startRoomId, bossRoomId };
}

const node = (id: string, x: number, y: number): RoomNode => ({ id, pos: { x, y } });

describe('validateConnectivity — T-72', () => {
  it('accepts a simple connected chain', () => {
    const g = graph(
      [node('a', 0, 0), node('b', 1, 0), node('c', 2, 0)],
      [{ from: 'a', to: 'b' }, { from: 'b', to: 'c' }],
      'a',
      'c',
    );
    expect(validateConnectivity(g)).toEqual({ ok: true });
  });

  it('rejects a missing start room', () => {
    const g = graph([node('a', 0, 0), node('b', 1, 0)], [{ from: 'a', to: 'b' }], 'zzz', 'b');
    const res = validateConnectivity(g);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe('MISSING_START');
  });

  it('rejects a missing boss room', () => {
    const g = graph([node('a', 0, 0), node('b', 1, 0)], [{ from: 'a', to: 'b' }], 'a', 'zzz');
    const res = validateConnectivity(g);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe('MISSING_BOSS');
  });

  it('rejects start === boss', () => {
    const g = graph([node('a', 0, 0)], [], 'a', 'a');
    const res = validateConnectivity(g);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe('START_IS_BOSS');
  });

  it('rejects an unreachable boss (boss in a disconnected component)', () => {
    const g = graph(
      [node('a', 0, 0), node('b', 1, 0), node('c', 5, 5)],
      [{ from: 'a', to: 'b' }], // c is isolated
      'a',
      'c',
    );
    const res = validateConnectivity(g);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe('BOSS_UNREACHABLE');
  });

  it('rejects orphan rooms even when the boss is reachable', () => {
    const g = graph(
      [node('a', 0, 0), node('b', 1, 0), node('orphan', 9, 9)],
      [{ from: 'a', to: 'b' }], // orphan is unreachable
      'a',
      'b',
    );
    const res = validateConnectivity(g);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error.code).toBe('ORPHAN_ROOMS');
      expect(res.error.message).toContain('orphan');
    }
  });

  it('accepts every placeRooms output across topologies and seeds', () => {
    const topologies: ConnectivityRule[] = ['linear', 'branching', 'loop'];
    for (const topo of topologies) {
      for (let seed = 1; seed <= 50; seed++) {
        const g = placeRooms(templateFor(topo), new Mulberry32(seed));
        const res = validateConnectivity(g);
        expect(res.ok, `topology=${topo} seed=${seed}`).toBe(true);
      }
    }
  });
});
