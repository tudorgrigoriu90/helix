import { describe, it, expect } from 'vitest';
import type { ConnectivityRule, FloorTemplate, RoomType } from '@shared-types/floor-template';
import type { FloorGraph } from '@shared-types/floor-graph';
import type { PopulatedFloor } from '@shared-types/floor-plan';
import { Mulberry32 } from '../rng/mulberry32';
import { generateFloor } from './generate-floor';
import { validateConnectivity } from './connectivity';

function templateFor(
  connectivity: ConnectivityRule,
  over: Partial<FloorTemplate> = {},
): FloorTemplate {
  return {
    schemaVersion: 1,
    floor: 1,
    zone: 'shallows',
    roomCount: { min: 8, max: 14 },
    roomWeights: {
      combat: 0.4, loot: 0.2, safe: 0.15, merchant: 0.1, trap: 0.1, lace_event: 0.05,
    },
    roomMinima: { safe: 1, merchant: 1 },
    connectivity,
    enemyPool: ['filterer', 'cave_crawler'],
    bossId: 'pressure_warden',
    aestheticTags: ['caves'],
    ...over,
  };
}

const topologies: ConnectivityRule[] = ['linear', 'branching', 'loop'];

/** Connectivity check over a populated floor (PopulatedRoom is a RoomNode superset). */
function asGraph(floor: PopulatedFloor): FloorGraph {
  return {
    rooms: floor.rooms.map((r) => ({ id: r.id, pos: r.pos })),
    edges: floor.edges,
    startRoomId: floor.startRoomId,
    bossRoomId: floor.bossRoomId,
  };
}

function typeCounts(floor: PopulatedFloor): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const r of floor.rooms) counts[r.type] = (counts[r.type] ?? 0) + 1;
  return counts;
}

describe('generateFloor — T-79 orchestration', () => {
  it('produces a connected, in-range floor across topologies and seeds', () => {
    for (const topo of topologies) {
      const t = templateFor(topo);
      for (let seed = 1; seed <= 40; seed++) {
        const floor = generateFloor(t, new Mulberry32(seed));
        expect(floor.fromFallback, `${topo}/${seed} not fallback`).toBe(false);
        expect(validateConnectivity(asGraph(floor)).ok, `${topo}/${seed} connected`).toBe(true);
        expect(floor.rooms.length, `${topo}/${seed} >= min`).toBeGreaterThanOrEqual(t.roomCount.min);
        expect(floor.rooms.length, `${topo}/${seed} <= max`).toBeLessThanOrEqual(t.roomCount.max);
      }
    }
  });

  it('honours every minimum (procedural path)', () => {
    const t = templateFor('branching', { roomMinima: { safe: 1, merchant: 1, loot: 2 } });
    for (let seed = 1; seed <= 40; seed++) {
      const counts = typeCounts(generateFloor(t, new Mulberry32(seed)));
      expect(counts['safe'] ?? 0).toBeGreaterThanOrEqual(1);
      expect(counts['merchant'] ?? 0).toBeGreaterThanOrEqual(1);
      expect(counts['loot'] ?? 0).toBeGreaterThanOrEqual(2);
    }
  });

  it('marks exactly one boss room and one start (safe) room', () => {
    const floor = generateFloor(templateFor('branching'), new Mulberry32(5));
    const counts = typeCounts(floor);
    expect(counts['boss']).toBe(1);
    const bossRoom = floor.rooms.find((r) => r.id === floor.bossRoomId);
    const startRoom = floor.rooms.find((r) => r.id === floor.startRoomId);
    expect(bossRoom?.type).toBe('boss');
    expect(startRoom?.type).toBe('safe');
  });

  it('is deterministic for a fixed seed', () => {
    const t = templateFor('loop');
    expect(generateFloor(t, new Mulberry32(321))).toEqual(generateFloor(t, new Mulberry32(321)));
  });

  it('falls back when the topology is structurally impossible', () => {
    // A loop needs >= 4 rooms; max 3 makes placeRooms throw on every attempt.
    const t = templateFor('loop', { roomCount: { min: 3, max: 3 } });
    const floor = generateFloor(t, new Mulberry32(1));
    expect(floor.fromFallback).toBe(true);
    expect(validateConnectivity(asGraph(floor)).ok).toBe(true);
  });

  it('falls back when minima cannot fit the room budget', () => {
    const t = templateFor('linear', {
      roomCount: { min: 3, max: 3 },
      roomMinima: { merchant: 5 },
    });
    const floor = generateFloor(t, new Mulberry32(2));
    expect(floor.fromFallback).toBe(true);
  });

  it('the fallback floor is itself valid and honours minima', () => {
    const t = templateFor('loop', {
      roomCount: { min: 3, max: 3 }, // forces fallback
      roomMinima: { safe: 1, merchant: 2, loot: 1 },
    });
    const floor = generateFloor(t, new Mulberry32(7));
    expect(floor.fromFallback).toBe(true);
    expect(validateConnectivity(asGraph(floor)).ok).toBe(true);
    const counts = typeCounts(floor);
    expect(counts['safe'] ?? 0).toBeGreaterThanOrEqual(1);
    expect(counts['merchant'] ?? 0).toBeGreaterThanOrEqual(2);
    expect(counts['loot'] ?? 0).toBeGreaterThanOrEqual(1);
    expect(counts['boss']).toBe(1);
  });

  it('every room carries a valid type and a grid', () => {
    const valid = new Set<RoomType>([
      'combat', 'loot', 'safe', 'merchant', 'trap', 'lace_event', 'boss',
    ]);
    const floor = generateFloor(templateFor('branching'), new Mulberry32(13));
    for (const room of floor.rooms) {
      expect(valid.has(room.type)).toBe(true);
      expect(room.grid.tiles.length).toBe(room.grid.width * room.grid.height);
    }
  });
});
