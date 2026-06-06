import { describe, it, expect } from 'vitest';
import type { PopulatedRoom } from '@shared-types/floor-plan';
import type { RoomType } from '@shared-types/floor-template';
import type { GridState, TileType } from '@shared-types/run-state';
import { Mulberry32 } from '../rng/mulberry32';
import {
  placeCodexFragments,
  MIN_CODEX_FRAGMENTS,
  MAX_CODEX_FRAGMENTS,
} from './codex-fragments';

function grid(): GridState {
  return { width: 5, height: 5, tiles: new Array<TileType>(25).fill('open') };
}

function room(id: string, type: RoomType): PopulatedRoom {
  return {
    id,
    pos: { x: 0, y: 0 },
    type,
    grid: grid(),
    playerSpawn: { x: 0, y: 0 },
    enemies: [],
    locked: type === 'boss',
  };
}

/** A typical floor: start (safe), several combat/loot, one boss. */
function floorRooms(): PopulatedRoom[] {
  return [
    room('r0', 'safe'),
    room('r1', 'combat'),
    room('r2', 'combat'),
    room('r3', 'loot'),
    room('r4', 'merchant'),
    room('r5', 'trap'),
    room('r6', 'lace_event'),
    room('r7', 'boss'),
  ];
}

const fragCount = (rooms: readonly PopulatedRoom[]): number =>
  rooms.filter((r) => r.codexFragment === true).length;

describe('placeCodexFragments — T-76', () => {
  it('places between 0 and 4 fragments across many seeds', () => {
    for (let seed = 0; seed < 200; seed++) {
      const out = placeCodexFragments(floorRooms(), new Mulberry32(seed));
      const n = fragCount(out);
      expect(n).toBeGreaterThanOrEqual(MIN_CODEX_FRAGMENTS);
      expect(n).toBeLessThanOrEqual(MAX_CODEX_FRAGMENTS);
    }
  });

  it('never marks the boss room', () => {
    for (let seed = 0; seed < 200; seed++) {
      const out = placeCodexFragments(floorRooms(), new Mulberry32(seed));
      const boss = out.find((r) => r.type === 'boss')!;
      expect(boss.codexFragment).not.toBe(true);
    }
  });

  it('is deterministic for a given seed', () => {
    const a = placeCodexFragments(floorRooms(), new Mulberry32(1234));
    const b = placeCodexFragments(floorRooms(), new Mulberry32(1234));
    expect(a.map((r) => r.codexFragment ?? false)).toEqual(b.map((r) => r.codexFragment ?? false));
  });

  it('does not mutate the input rooms', () => {
    const input = floorRooms();
    const snapshot = structuredClone(input);
    placeCodexFragments(input, new Mulberry32(7));
    expect(input).toEqual(snapshot);
  });

  it('eventually produces the full 0..4 range across seeds', () => {
    const seen = new Set<number>();
    for (let seed = 0; seed < 500; seed++) {
      seen.add(fragCount(placeCodexFragments(floorRooms(), new Mulberry32(seed))));
    }
    expect(seen).toEqual(new Set([0, 1, 2, 3, 4]));
  });

  it('clamps the count to the number of eligible (non-boss) rooms', () => {
    // Only a boss + one combat room: at most one fragment can ever be placed.
    const tiny = [room('r0', 'combat'), room('r1', 'boss')];
    for (let seed = 0; seed < 100; seed++) {
      const out = placeCodexFragments(tiny, new Mulberry32(seed));
      expect(fragCount(out)).toBeLessThanOrEqual(1);
      expect(out.find((r) => r.type === 'boss')!.codexFragment).not.toBe(true);
    }
  });

  it('places nothing when the only room is the boss', () => {
    const out = placeCodexFragments([room('r0', 'boss')], new Mulberry32(3));
    expect(fragCount(out)).toBe(0);
  });
});
