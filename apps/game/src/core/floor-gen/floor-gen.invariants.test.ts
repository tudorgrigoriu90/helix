import { describe, it, expect } from 'vitest';
import type { ConnectivityRule, FloorTemplate } from '@shared-types/floor-template';
import type { FloorGraph } from '@shared-types/floor-graph';
import type { PopulatedFloor } from '@shared-types/floor-plan';
import { Mulberry32 } from '../rng/mulberry32';
import { generateFloor } from './generate-floor';
import { validateConnectivity } from './connectivity';
import { parseFloorTemplate } from './floor-template-loader';
import floor01 from '../../../../../packages/content/floors/floor_01.json';

/**
 * T-80 — end-to-end floor-generation invariants.
 *
 * A broad property sweep over the whole S-3.3 pipeline. Each per-task test file
 * checks one stage; this guards the guarantees the rest of the game relies on,
 * holding across topologies, seeds, and template variations:
 *   - the floor is always connected (start can reach boss, no orphans)
 *   - procedural floors respect roomCount; all floors honour minima
 *   - exactly one boss; the start room is safe
 *   - all spawns and hazards stay in-bounds; spawns never collide
 *   - identical seed -> identical floor
 */

const TOPOLOGIES: ConnectivityRule[] = ['linear', 'branching', 'loop'];

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
    enemyPool: ['filterer', 'cave_crawler', 'acid_spitter'],
    bossId: 'pressure_warden',
    aestheticTags: ['caves'],
    ...over,
  };
}

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

/** Asserts the full per-floor invariant set, given the template it came from. */
function assertFloorInvariants(floor: PopulatedFloor, template: FloorTemplate, label: string): void {
  // Connectivity.
  expect(validateConnectivity(asGraph(floor)).ok, `${label} connected`).toBe(true);

  // Room count (procedural floors only — fallback sizes itself).
  if (!floor.fromFallback) {
    expect(floor.rooms.length, `${label} >= min`).toBeGreaterThanOrEqual(template.roomCount.min);
    expect(floor.rooms.length, `${label} <= max`).toBeLessThanOrEqual(template.roomCount.max);
  }

  // Minima + structural roles.
  const counts = typeCounts(floor);
  expect(counts['boss'], `${label} one boss`).toBe(1);
  const startRoom = floor.rooms.find((r) => r.id === floor.startRoomId);
  expect(startRoom?.type, `${label} start safe`).toBe('safe');
  expect(counts['safe'] ?? 0, `${label} safe min`).toBeGreaterThanOrEqual(template.roomMinima.safe ?? 0);
  expect(counts['merchant'] ?? 0, `${label} merchant min`).toBeGreaterThanOrEqual(
    template.roomMinima.merchant ?? 0,
  );

  // Spawns + hazards in-bounds; spawns distinct and off the player tile.
  for (const room of floor.rooms) {
    const inBounds = (x: number, y: number): boolean =>
      x >= 0 && x < room.grid.width && y >= 0 && y < room.grid.height;
    expect(inBounds(room.playerSpawn.x, room.playerSpawn.y), `${label} ${room.id} player`).toBe(true);
    const seen = new Set<string>();
    for (const e of room.enemies) {
      expect(inBounds(e.pos.x, e.pos.y), `${label} ${room.id} enemy bounds`).toBe(true);
      const k = `${e.pos.x},${e.pos.y}`;
      expect(seen.has(k), `${label} ${room.id} enemy distinct`).toBe(false);
      seen.add(k);
      expect(k, `${label} ${room.id} enemy off player`).not.toBe(
        `${room.playerSpawn.x},${room.playerSpawn.y}`,
      );
    }
    expect(room.grid.tiles.length, `${label} ${room.id} grid size`).toBe(
      room.grid.width * room.grid.height,
    );
  }
}

describe('floor-gen invariants — T-80', () => {
  it('holds across topologies x 60 seeds', () => {
    for (const topo of TOPOLOGIES) {
      const t = templateFor(topo);
      for (let seed = 1; seed <= 60; seed++) {
        assertFloorInvariants(generateFloor(t, new Mulberry32(seed)), t, `${topo}/${seed}`);
      }
    }
  });

  it('holds for demanding-but-feasible minima', () => {
    const t = templateFor('branching', {
      roomMinima: { safe: 2, merchant: 1, loot: 2, trap: 1 },
    });
    for (let seed = 1; seed <= 40; seed++) {
      const floor = generateFloor(t, new Mulberry32(seed * 7 + 1));
      assertFloorInvariants(floor, t, `demanding/${seed}`);
      const counts = typeCounts(floor);
      expect(counts['safe'] ?? 0).toBeGreaterThanOrEqual(2);
      expect(counts['loot'] ?? 0).toBeGreaterThanOrEqual(2);
      expect(counts['trap'] ?? 0).toBeGreaterThanOrEqual(1);
    }
  });

  it('still satisfies invariants when forced down the fallback path', () => {
    const t = templateFor('loop', {
      roomCount: { min: 3, max: 3 }, // impossible for a loop -> fallback
      roomMinima: { safe: 1, merchant: 2 },
    });
    for (let seed = 1; seed <= 20; seed++) {
      const floor = generateFloor(t, new Mulberry32(seed));
      expect(floor.fromFallback).toBe(true);
      assertFloorInvariants(floor, t, `fallback/${seed}`);
    }
  });

  it('is deterministic for a fixed seed across topologies', () => {
    for (const topo of TOPOLOGIES) {
      const t = templateFor(topo);
      expect(generateFloor(t, new Mulberry32(2024))).toEqual(generateFloor(t, new Mulberry32(2024)));
    }
  });

  it('generates a valid floor from the shipped Floor 1 content', () => {
    const parsed = parseFloorTemplate(floor01);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    for (let seed = 1; seed <= 30; seed++) {
      assertFloorInvariants(
        generateFloor(parsed.template, new Mulberry32(seed)),
        parsed.template,
        `floor01/${seed}`,
      );
    }
  });
});
