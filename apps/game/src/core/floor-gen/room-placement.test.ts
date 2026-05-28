import { describe, it, expect } from 'vitest';
import type { ConnectivityRule, FloorTemplate } from '@shared-types/floor-template';
import type { FloorGraph } from '@shared-types/floor-graph';
import { Mulberry32 } from '../rng/mulberry32';
import { placeRooms } from './room-placement';
import { areAdjacent, bfsDistances, buildAdjacency } from './graph';

// ── Helpers ─────────────────────────────────────────────────────────────────

/** Minimal valid floor template, parameterised by connectivity. */
function templateFor(
  connectivity: ConnectivityRule,
  roomCount: { min: number; max: number } = { min: 8, max: 14 },
): FloorTemplate {
  return {
    schemaVersion: 1,
    floor: 1,
    zone: 'shallows',
    roomCount,
    roomWeights: {
      combat: 0.40, loot: 0.20, safe: 0.15,
      merchant: 0.10, trap: 0.10, lace_event: 0.05,
    },
    roomMinima: { safe: 1 },
    connectivity,
    enemyPool: ['filterer', 'cave_crawler'],
    bossId: 'pressure_warden',
    aestheticTags: ['caves'],
  };
}

function rng(seed = 0xdeadbeef): Mulberry32 {
  return new Mulberry32(seed);
}

// ── Invariants that must hold for every topology ────────────────────────────

function assertGraphInvariants(g: FloorGraph, template: FloorTemplate): void {
  // 1. Room count is within the template window.
  expect(g.rooms.length).toBeGreaterThanOrEqual(template.roomCount.min);
  expect(g.rooms.length).toBeLessThanOrEqual(template.roomCount.max);

  // 2. All room ids are unique.
  const ids = new Set(g.rooms.map((r) => r.id));
  expect(ids.size).toBe(g.rooms.length);

  // 3. All positions are unique.
  const positions = new Set(g.rooms.map((r) => `${r.pos.x},${r.pos.y}`));
  expect(positions.size).toBe(g.rooms.length);

  // 4. Edge endpoints reference real rooms.
  for (const e of g.edges) {
    expect(ids.has(e.from)).toBe(true);
    expect(ids.has(e.to)).toBe(true);
    expect(e.from).not.toBe(e.to);
  }

  // 5. start and boss are distinct.
  expect(g.startRoomId).not.toBe(g.bossRoomId);
  expect(ids.has(g.startRoomId)).toBe(true);
  expect(ids.has(g.bossRoomId)).toBe(true);

  // 6. start and boss are NOT directly connected (GDD §7.2 / TDD §7.4).
  expect(areAdjacent(g.startRoomId, g.bossRoomId, g.edges)).toBe(false);

  // 7. Every room is reachable from start (forms a connected graph).
  const distances = bfsDistances(g.startRoomId, g.rooms, g.edges);
  expect(distances.size).toBe(g.rooms.length);
}

describe('placeRooms — T-71 (TDD §7.1)', () => {
  // ── Linear ────────────────────────────────────────────────────────────────

  describe('linear connectivity', () => {
    it('produces a chain of n rooms with n-1 edges', () => {
      const template = templateFor('linear', { min: 8, max: 8 });
      const g = placeRooms(template, rng());
      expect(g.rooms.length).toBe(8);
      expect(g.edges.length).toBe(7);
    });

    it('places start at one end and boss at the other', () => {
      const template = templateFor('linear', { min: 6, max: 6 });
      const g = placeRooms(template, rng());
      expect(g.startRoomId).toBe('r0');
      expect(g.bossRoomId).toBe('r5');
    });

    it('every interior room has degree 2; endpoints have degree 1', () => {
      const template = templateFor('linear', { min: 6, max: 6 });
      const g = placeRooms(template, rng());
      const adj = buildAdjacency(g.rooms, g.edges);
      const degrees = g.rooms.map((r) => adj.get(r.id)!.length);
      // Two endpoints with degree 1, the rest with degree 2 → sum = 2 + (n-2)*2 = 2n-2.
      const totalDegree = degrees.reduce((s, d) => s + d, 0);
      expect(totalDegree).toBe(g.edges.length * 2);
      expect(degrees.filter((d) => d === 1).length).toBe(2);
      expect(degrees.filter((d) => d === 2).length).toBe(g.rooms.length - 2);
    });

    it('satisfies all graph invariants', () => {
      const template = templateFor('linear');
      const g = placeRooms(template, rng());
      assertGraphInvariants(g, template);
    });
  });

  // ── Branching ─────────────────────────────────────────────────────────────

  describe('branching connectivity', () => {
    it('produces a tree (n rooms, exactly n-1 edges)', () => {
      const template = templateFor('branching', { min: 10, max: 10 });
      const g = placeRooms(template, rng());
      expect(g.rooms.length).toBe(10);
      expect(g.edges.length).toBe(9); // tree → n-1 edges
    });

    it('contains no cycles — the tree shape is preserved', () => {
      // n-1 edges + connected from start means a tree by definition. Verified
      // by counting edges relative to room count.
      const template = templateFor('branching', { min: 8, max: 14 });
      const g = placeRooms(template, rng());
      expect(g.edges.length).toBe(g.rooms.length - 1);
    });

    it('boss is at BFS distance ≥ 2 from start', () => {
      const template = templateFor('branching');
      const g = placeRooms(template, rng());
      const distances = bfsDistances(g.startRoomId, g.rooms, g.edges);
      expect(distances.get(g.bossRoomId) ?? -1).toBeGreaterThanOrEqual(2);
    });

    it('produces actual branching for larger floors (at least one room with degree ≥ 3)', () => {
      // A branching layout should occasionally produce a fan-out node. We test
      // across many seeds because a single random tree could be path-shaped.
      // With n=14 attachments to random parents, the probability of ALL being
      // a chain is vanishingly small.
      const template = templateFor('branching', { min: 14, max: 14 });
      let foundFork = false;
      for (let seed = 1; seed <= 8 && !foundFork; seed++) {
        const g = placeRooms(template, rng(seed));
        const adj = buildAdjacency(g.rooms, g.edges);
        for (const r of g.rooms) {
          if ((adj.get(r.id) ?? []).length >= 3) {
            foundFork = true;
            break;
          }
        }
      }
      expect(foundFork).toBe(true);
    });

    it('satisfies all graph invariants', () => {
      const template = templateFor('branching');
      const g = placeRooms(template, rng());
      assertGraphInvariants(g, template);
    });
  });

  // ── Loop ──────────────────────────────────────────────────────────────────

  describe('loop connectivity', () => {
    it('produces a ring of n rooms with n edges', () => {
      const template = templateFor('loop', { min: 10, max: 10 });
      const g = placeRooms(template, rng());
      expect(g.rooms.length).toBe(10);
      expect(g.edges.length).toBe(10); // cycle → n edges
    });

    it('every room has exactly degree 2 (pure ring)', () => {
      const template = templateFor('loop', { min: 8, max: 8 });
      const g = placeRooms(template, rng());
      const adj = buildAdjacency(g.rooms, g.edges);
      for (const r of g.rooms) {
        expect(adj.get(r.id)!.length).toBe(2);
      }
    });

    it('places boss diametrically opposite start', () => {
      const template = templateFor('loop', { min: 8, max: 8 });
      const g = placeRooms(template, rng());
      expect(g.startRoomId).toBe('r0');
      expect(g.bossRoomId).toBe('r4'); // floor(8 / 2)
    });

    it('satisfies all graph invariants', () => {
      const template = templateFor('loop');
      const g = placeRooms(template, rng());
      assertGraphInvariants(g, template);
    });

    it('rejects templates whose roomCount.max is below the loop safe minimum', () => {
      // Safe minimum for loop is 4. A template forcing max=3 is unsatisfiable.
      const template = templateFor('loop', { min: 3, max: 3 });
      expect(() => placeRooms(template, rng())).toThrow(/safe minimum/);
    });
  });

  // ── Determinism & purity (cross-topology) ─────────────────────────────────

  describe('determinism & purity', () => {
    it.each(['linear', 'branching', 'loop'] as const)(
      'is deterministic for %s given the same seed',
      (rule) => {
        const template = templateFor(rule);
        const a = placeRooms(template, rng(42));
        const b = placeRooms(template, rng(42));
        expect(a).toEqual(b);
      },
    );

    it.each(['linear', 'branching', 'loop'] as const)(
      'is pure — does not mutate the template (%s)',
      (rule) => {
        const template = templateFor(rule);
        const snapshot = structuredClone(template);
        placeRooms(template, rng());
        expect(template).toEqual(snapshot);
      },
    );

    it('different seeds produce different branching graphs (sanity)', () => {
      // For branching, where rng drives structure heavily, different seeds
      // should almost always produce visibly different layouts.
      const template = templateFor('branching', { min: 14, max: 14 });
      const a = placeRooms(template, rng(1));
      const b = placeRooms(template, rng(99999));
      // Different edge sets → different graphs.
      expect(a.edges).not.toEqual(b.edges);
    });
  });

  // ── Room-count picking ────────────────────────────────────────────────────

  describe('room count selection', () => {
    it('respects the template min/max range across many seeds', () => {
      const template = templateFor('branching', { min: 8, max: 14 });
      for (let seed = 1; seed <= 50; seed++) {
        const g = placeRooms(template, rng(seed));
        expect(g.rooms.length).toBeGreaterThanOrEqual(8);
        expect(g.rooms.length).toBeLessThanOrEqual(14);
      }
    });

    it('exercises the full range over many seeds (samples at both ends)', () => {
      const template = templateFor('branching', { min: 8, max: 14 });
      const counts = new Set<number>();
      for (let seed = 1; seed <= 200; seed++) {
        counts.add(placeRooms(template, rng(seed)).rooms.length);
      }
      // We expect to see most values in [8, 14] over 200 samples.
      expect(counts.size).toBeGreaterThanOrEqual(5);
    });

    it('throws on an unsatisfiable template (max < safe min)', () => {
      // linear/branching safe-min is 3; a template forcing min=2,max=2 is rejected.
      const template = templateFor('linear', { min: 2, max: 2 });
      expect(() => placeRooms(template, rng())).toThrow(/safe minimum/);
    });
  });
});

// ── Graph utilities (graph.ts) ──────────────────────────────────────────────

describe('graph utilities — buildAdjacency / bfsDistances / areAdjacent', () => {
  const rooms = [
    { id: 'a', pos: { x: 0, y: 0 } },
    { id: 'b', pos: { x: 1, y: 0 } },
    { id: 'c', pos: { x: 2, y: 0 } },
    { id: 'd', pos: { x: 3, y: 0 } },
  ];
  const edges = [
    { from: 'a', to: 'b' },
    { from: 'b', to: 'c' },
    { from: 'c', to: 'd' },
  ];

  it('buildAdjacency treats edges as undirected', () => {
    const adj = buildAdjacency(rooms, edges);
    expect(adj.get('a')).toEqual(['b']);
    expect(adj.get('b')).toEqual(['a', 'c']);
    expect(adj.get('c')).toEqual(['b', 'd']);
    expect(adj.get('d')).toEqual(['c']);
  });

  it('bfsDistances reports correct distances along a chain', () => {
    const dist = bfsDistances('a', rooms, edges);
    expect(dist.get('a')).toBe(0);
    expect(dist.get('b')).toBe(1);
    expect(dist.get('c')).toBe(2);
    expect(dist.get('d')).toBe(3);
  });

  it('bfsDistances omits unreachable rooms from the result map', () => {
    const isolated = [...rooms, { id: 'island', pos: { x: 99, y: 99 } }];
    const dist = bfsDistances('a', isolated, edges);
    expect(dist.has('island')).toBe(false);
    expect(dist.size).toBe(4);
  });

  it('areAdjacent matches in either direction', () => {
    expect(areAdjacent('a', 'b', edges)).toBe(true);
    expect(areAdjacent('b', 'a', edges)).toBe(true); // undirected
    expect(areAdjacent('a', 'c', edges)).toBe(false);
    expect(areAdjacent('a', 'd', edges)).toBe(false);
  });
});
