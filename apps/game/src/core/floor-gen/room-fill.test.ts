import { describe, it, expect } from 'vitest';
import type { ConnectivityRule, FloorTemplate, RoomType } from '@shared-types/floor-template';
import { Mulberry32 } from '../rng/mulberry32';
import { placeRooms } from './room-placement';
import { fillRoomTypes } from './room-fill';

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

function countByType(types: RoomType[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const t of types) counts[t] = (counts[t] ?? 0) + 1;
  return counts;
}

describe('fillRoomTypes — T-73', () => {
  it('assigns a type to every room exactly once', () => {
    const template = templateFor('branching');
    const graph = placeRooms(template, new Mulberry32(42));
    const typed = fillRoomTypes(graph, template, new Mulberry32(7));
    expect(typed.length).toBe(graph.rooms.length);
    expect(new Set(typed.map((r) => r.id)).size).toBe(graph.rooms.length);
    for (const room of typed) expect(room.type).toBeTruthy();
  });

  it('makes the boss room "boss" and the start room "safe"', () => {
    const template = templateFor('branching');
    const graph = placeRooms(template, new Mulberry32(99));
    const typed = fillRoomTypes(graph, template, new Mulberry32(99));
    const byId = new Map(typed.map((r) => [r.id, r.type]));
    expect(byId.get(graph.bossRoomId)).toBe('boss');
    expect(byId.get(graph.startRoomId)).toBe('safe');
  });

  it('honours every minimum across topologies and seeds', () => {
    for (const topo of topologies) {
      const t = templateFor(topo, { roomMinima: { safe: 1, merchant: 1, loot: 2 } });
      for (let seed = 1; seed <= 40; seed++) {
        const graph = placeRooms(t, new Mulberry32(seed));
        const typed = fillRoomTypes(graph, t, new Mulberry32(seed * 31));
        const counts = countByType(typed.map((r) => r.type));
        expect(counts['safe'] ?? 0, `${topo}/${seed} safe`).toBeGreaterThanOrEqual(1);
        expect(counts['merchant'] ?? 0, `${topo}/${seed} merchant`).toBeGreaterThanOrEqual(1);
        expect(counts['loot'] ?? 0, `${topo}/${seed} loot`).toBeGreaterThanOrEqual(2);
      }
    }
  });

  it('is deterministic for a fixed (graph, rng-state)', () => {
    const template = templateFor('loop');
    const graph = placeRooms(template, new Mulberry32(123));
    const a = fillRoomTypes(graph, template, new Mulberry32(456));
    const b = fillRoomTypes(graph, template, new Mulberry32(456));
    expect(a).toEqual(b);
  });

  it('produces only valid room types', () => {
    const valid = new Set<RoomType>([
      'combat', 'loot', 'safe', 'merchant', 'trap', 'lace_event', 'boss',
    ]);
    const template = templateFor('branching');
    const graph = placeRooms(template, new Mulberry32(5));
    const typed = fillRoomTypes(graph, template, new Mulberry32(5));
    for (const room of typed) expect(valid.has(room.type)).toBe(true);
  });

  it('throws when minima cannot fit in the available rooms', () => {
    // Tiny linear floor (3 rooms: start/boss + 1 fillable) but minima demand
    // far more than one extra room.
    const template = templateFor('linear', {
      roomCount: { min: 3, max: 3 },
      roomMinima: { merchant: 5 },
    });
    const graph = placeRooms(template, new Mulberry32(1));
    expect(() => fillRoomTypes(graph, template, new Mulberry32(1))).toThrow(/minima/);
  });
});
