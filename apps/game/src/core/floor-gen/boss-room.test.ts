import { describe, it, expect } from 'vitest';
import type { FloorTemplate } from '@shared-types/floor-template';
import type { TypedRoom } from '@shared-types/floor-plan';
import { Mulberry32 } from '../rng/mulberry32';
import { BOSS_ROOM_SIZE, STANDARD_ROOM_SIZE, buildRoom } from './encounter';

/**
 * T-77 — boss-room handling. The boss room is produced by the same buildRoom
 * dispatch as every other room (it routes on `type === 'boss'`); these tests
 * lock in the boss-specific contract: a larger arena, a locked door, and a
 * single boss spawn taken from the template's bossId (GDD §7.4 / TDD §7.1).
 */

function template(over: Partial<FloorTemplate> = {}): FloorTemplate {
  return {
    schemaVersion: 1,
    floor: 1,
    zone: 'shallows',
    roomCount: { min: 8, max: 14 },
    roomWeights: {
      combat: 0.4, loot: 0.2, safe: 0.15, merchant: 0.1, trap: 0.1, lace_event: 0.05,
    },
    roomMinima: { safe: 1 },
    connectivity: 'branching',
    enemyPool: ['filterer', 'cave_crawler'],
    bossId: 'pressure_warden',
    aestheticTags: ['caves'],
    ...over,
  };
}

const bossRoom = (t: FloorTemplate, seed: number): ReturnType<typeof buildRoom> =>
  buildRoom({ id: 'rb', pos: { x: 9, y: 9 }, type: 'boss' } as TypedRoom, t, new Mulberry32(seed));

describe('boss-room handling — T-77', () => {
  it('uses the 10x10 boss arena, larger than a standard room', () => {
    const room = bossRoom(template(), 1);
    expect(room.grid.width).toBe(BOSS_ROOM_SIZE);
    expect(room.grid.height).toBe(BOSS_ROOM_SIZE);
    expect(room.grid.tiles).toHaveLength(BOSS_ROOM_SIZE * BOSS_ROOM_SIZE);
    expect(BOSS_ROOM_SIZE).toBeGreaterThan(STANDARD_ROOM_SIZE);
  });

  it('locks the door', () => {
    expect(bossRoom(template(), 1).locked).toBe(true);
  });

  it('spawns exactly one enemy and it is the bossId', () => {
    const room = bossRoom(template({ bossId: 'thermal_apex' }), 1);
    expect(room.enemies).toHaveLength(1);
    expect(room.enemies[0]!.enemyDefId).toBe('thermal_apex');
  });

  it('keeps the boss off the player entry tile and inside bounds', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const room = bossRoom(template(), seed);
      const boss = room.enemies[0]!;
      expect(boss.pos).not.toEqual(room.playerSpawn);
      expect(boss.pos.x).toBeGreaterThanOrEqual(0);
      expect(boss.pos.x).toBeLessThan(room.grid.width);
      expect(boss.pos.y).toBeGreaterThanOrEqual(0);
      expect(boss.pos.y).toBeLessThan(room.grid.height);
    }
  });

  it('is hazard-free (boss arenas are clean — T-75)', () => {
    const room = bossRoom(template(), 7);
    expect(room.grid.tiles.every((t) => t !== 'hazard')).toBe(true);
  });

  it('is deterministic', () => {
    expect(bossRoom(template(), 3)).toEqual(bossRoom(template(), 3));
  });
});
