import { describe, it, expect } from 'vitest';
import type { EnemyDef } from '@shared-types/enemy';
import type { PopulatedRoom } from '@shared-types/floor-plan';
import { buildEncounterState, buildEnemyRegistry } from './encounter';
import { newRunPlayer } from './start-player';

function def(id: string, maxHp = 20): EnemyDef {
  return {
    schemaVersion: 1,
    id,
    name: id,
    tier: 'grunt',
    zone: 'shallows',
    maxHp,
    stats: { str: 7, res: 3, agi: 6, int: 2 },
    damageType: 'physical',
    aestheticTags: ['caves'],
  };
}

function room(over: Partial<PopulatedRoom> = {}): PopulatedRoom {
  return {
    id: 'r1',
    pos: { x: 0, y: 0 },
    type: 'combat',
    grid: { width: 7, height: 7, tiles: new Array(49).fill('open') },
    playerSpawn: { x: 3, y: 6 },
    enemies: [
      { enemyDefId: 'filterer', pos: { x: 1, y: 1 } },
      { enemyDefId: 'filterer', pos: { x: 5, y: 1 } },
      { enemyDefId: 'cave_crawler', pos: { x: 3, y: 0 } },
    ],
    locked: false,
    ...over,
  };
}

const registry = buildEnemyRegistry([def('filterer', 16), def('cave_crawler', 18)]);

describe('buildEncounterState — encounter bridge', () => {
  it('instantiates one EnemyState per spawn at full HP from the def', () => {
    const state = buildEncounterState({ room: room(), registry, player: newRunPlayer(), floorNumber: 1, seed: 1 });
    expect(state.enemies).toHaveLength(3);
    const first = state.enemies[0]!;
    expect(first.enemyDefId).toBe('filterer');
    expect(first.hp).toBe(16);
    expect(first.maxHp).toBe(16);
    expect(first.stats).toEqual({ str: 7, res: 3, agi: 6, int: 2 });
    expect(first.pos).toEqual({ x: 1, y: 1 });
  });

  it('gives every enemy a unique id even when defs repeat', () => {
    const state = buildEncounterState({ room: room(), registry, player: newRunPlayer(), floorNumber: 1, seed: 1 });
    const ids = state.enemies.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('places the carried player at the room entry tile with AP refreshed', () => {
    const player = { ...newRunPlayer(), hp: 40, ap: 0 };
    const state = buildEncounterState({ room: room(), registry, player, floorNumber: 2, seed: 9 });
    expect(state.player.pos).toEqual({ x: 3, y: 6 });
    expect(state.player.ap).toBe(state.player.maxAp);
    expect(state.player.hp).toBe(40); // carried, not reset
    expect(state.floorNumber).toBe(2);
    expect(state.phase).toBe('player');
  });

  it('uses the room grid verbatim (hazards preserved)', () => {
    const hazardGrid = { width: 7, height: 7, tiles: new Array(49).fill('open') };
    hazardGrid.tiles[10] = 'hazard';
    const state = buildEncounterState({
      room: room({ grid: hazardGrid }), registry, player: newRunPlayer(), floorNumber: 1, seed: 1,
    });
    expect(state.grid.tiles[10]).toBe('hazard');
  });

  it('throws on an unknown enemy def (defensive — content is validated upstream)', () => {
    const bad = room({ enemies: [{ enemyDefId: 'ghost', pos: { x: 0, y: 0 } }] });
    expect(() => buildEncounterState({ room: bad, registry, player: newRunPlayer(), floorNumber: 1, seed: 1 })).toThrow(/ghost/);
  });

  it('produces no enemies for a non-combat room', () => {
    const safe = room({ type: 'safe', enemies: [] });
    const state = buildEncounterState({ room: safe, registry, player: newRunPlayer(), floorNumber: 1, seed: 1 });
    expect(state.enemies).toHaveLength(0);
  });

  it('scales enemies up on deeper floors (T-78)', () => {
    const f1 = buildEncounterState({ room: room(), registry, player: newRunPlayer(), floorNumber: 1, seed: 1 });
    const f5 = buildEncounterState({ room: room(), registry, player: newRunPlayer(), floorNumber: 5, seed: 1 });
    expect(f5.enemies[0]!.maxHp).toBeGreaterThan(f1.enemies[0]!.maxHp);
    expect(f5.enemies[0]!.stats.str).toBeGreaterThan(f1.enemies[0]!.stats.str);
    expect(f1.enemies[0]!.maxHp).toBe(16); // floor 1 = authored baseline
  });
});
