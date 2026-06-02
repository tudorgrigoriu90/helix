import { describe, it, expect } from 'vitest';
import type { RoomType } from '@shared-types/floor-template';
import { bfsDistances } from './graph';
import { BOSS_ROOM_SIZE, STANDARD_ROOM_SIZE } from './encounter';
import { buildFloorZero, FLOOR_ZERO_NUMBER, FLOOR_ZERO_ROOM_IDS } from './floor-zero';

const opts = { combatEnemyId: 'filterer', bossId: 'pressure_warden' } as const;

describe('buildFloorZero — T-137 hardcoded tutorial floor', () => {
  it('is the four scripted rooms in teaching order (safe → combat → strand → boss)', () => {
    const floor = buildFloorZero(opts);
    expect(floor.floor).toBe(FLOOR_ZERO_NUMBER);
    expect(floor.rooms.map((r) => r.id)).toEqual([
      FLOOR_ZERO_ROOM_IDS.entry, FLOOR_ZERO_ROOM_IDS.combat, FLOOR_ZERO_ROOM_IDS.strand, FLOOR_ZERO_ROOM_IDS.boss,
    ]);
    expect(floor.rooms.map((r) => r.type)).toEqual<RoomType[]>(['safe', 'combat', 'lace_event', 'boss']);
    expect(floor.startRoomId).toBe(FLOOR_ZERO_ROOM_IDS.entry);
    expect(floor.bossRoomId).toBe(FLOOR_ZERO_ROOM_IDS.boss);
    expect(floor.fromFallback).toBe(false);
  });

  it('is a single line — boss reachable from start, in exactly three steps', () => {
    const floor = buildFloorZero(opts);
    const dist = bfsDistances(floor.startRoomId, floor.rooms, floor.edges);
    expect(dist.get(floor.bossRoomId)).toBe(3); // entry→combat→strand→boss
    // Every room is reachable (no orphan).
    for (const room of floor.rooms) expect(dist.has(room.id)).toBe(true);
  });

  it('places the injected enemies: one grunt in combat, the boss in the boss room', () => {
    const floor = buildFloorZero(opts);
    const byId = new Map(floor.rooms.map((r) => [r.id, r]));
    const combat = byId.get(FLOOR_ZERO_ROOM_IDS.combat)!;
    const boss = byId.get(FLOOR_ZERO_ROOM_IDS.boss)!;

    expect(combat.enemies).toHaveLength(1);
    expect(combat.enemies[0]!.enemyDefId).toBe('filterer');
    expect(boss.enemies).toEqual([{ enemyDefId: 'pressure_warden', pos: { x: Math.floor(BOSS_ROOM_SIZE / 2), y: 1 } }]);
    expect(boss.locked).toBe(true); // boss door locked until cleared (T-77)

    // Movement + strand rooms hold no enemies and auto-clear.
    expect(byId.get(FLOOR_ZERO_ROOM_IDS.entry)!.enemies).toHaveLength(0);
    expect(byId.get(FLOOR_ZERO_ROOM_IDS.strand)!.enemies).toHaveLength(0);
  });

  it('uses the standard room size for normal rooms and the larger boss arena', () => {
    const floor = buildFloorZero(opts);
    const byId = new Map(floor.rooms.map((r) => [r.id, r]));
    expect(byId.get(FLOOR_ZERO_ROOM_IDS.entry)!.grid.width).toBe(STANDARD_ROOM_SIZE);
    expect(byId.get(FLOOR_ZERO_ROOM_IDS.boss)!.grid.width).toBe(BOSS_ROOM_SIZE);
    // Player always enters at bottom-centre.
    const entry = byId.get(FLOOR_ZERO_ROOM_IDS.entry)!;
    expect(entry.playerSpawn).toEqual({ x: Math.floor(STANDARD_ROOM_SIZE / 2), y: STANDARD_ROOM_SIZE - 1 });
  });

  it('is deterministic — no RNG, identical every build', () => {
    expect(buildFloorZero(opts)).toEqual(buildFloorZero(opts));
  });

  it('tints to the requested zone (defaults to shallows)', () => {
    expect(buildFloorZero(opts).zone).toBe('shallows');
    expect(buildFloorZero({ ...opts, zone: 'mycosphere' }).zone).toBe('mycosphere');
  });
});
