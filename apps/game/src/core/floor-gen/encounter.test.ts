import { describe, it, expect } from 'vitest';
import type { FloorTemplate, RoomType } from '@shared-types/floor-template';
import type { TypedRoom } from '@shared-types/floor-plan';
import type { Position } from '@shared-types/action';
import { Mulberry32 } from '../rng/mulberry32';
import { buildRoom } from './encounter';

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
    enemyPool: ['filterer', 'cave_crawler', 'acid_spitter'],
    bossId: 'pressure_warden',
    aestheticTags: ['caves'],
    ...over,
  };
}

const typed = (id: string, type: RoomType): TypedRoom => ({ id, pos: { x: 0, y: 0 }, type });

const key = (p: Position): string => `${p.x},${p.y}`;

function hazardTiles(grid: { width: number; height: number; tiles: readonly string[] }): Position[] {
  const out: Position[] = [];
  for (let y = 0; y < grid.height; y++) {
    for (let x = 0; x < grid.width; x++) {
      if (grid.tiles[y * grid.width + x] === 'hazard') out.push({ x, y });
    }
  }
  return out;
}

describe('buildRoom — T-74 enemy placement', () => {
  it('combat rooms get 2-4 enemies, all drawn from the pool', () => {
    const t = template();
    for (let seed = 1; seed <= 50; seed++) {
      const room = buildRoom(typed('r1', 'combat'), t, new Mulberry32(seed));
      expect(room.enemies.length, `seed ${seed}`).toBeGreaterThanOrEqual(2);
      expect(room.enemies.length, `seed ${seed}`).toBeLessThanOrEqual(4);
      for (const e of room.enemies) {
        expect(t.enemyPool).toContain(e.enemyDefId);
      }
    }
  });

  it('non-combat, non-boss rooms have no enemies', () => {
    const t = template();
    for (const type of ['loot', 'safe', 'merchant', 'trap', 'lace_event'] as RoomType[]) {
      const room = buildRoom(typed('r1', type), t, new Mulberry32(3));
      expect(room.enemies, type).toHaveLength(0);
    }
  });

  it('boss rooms spawn exactly the boss from bossId', () => {
    const room = buildRoom(typed('rb', 'boss'), template(), new Mulberry32(9));
    expect(room.enemies).toHaveLength(1);
    expect(room.enemies[0]!.enemyDefId).toBe('pressure_warden');
  });

  it('enemy spawns are on distinct tiles and never on the player spawn', () => {
    const t = template();
    for (let seed = 1; seed <= 50; seed++) {
      const room = buildRoom(typed('r1', 'combat'), t, new Mulberry32(seed));
      const positions = room.enemies.map((e) => key(e.pos));
      expect(new Set(positions).size, `seed ${seed} distinct`).toBe(positions.length);
      expect(positions, `seed ${seed} not on player`).not.toContain(key(room.playerSpawn));
    }
  });

  it('every spawn is inside the grid bounds', () => {
    const room = buildRoom(typed('r1', 'combat'), template(), new Mulberry32(11));
    for (const e of room.enemies) {
      expect(e.pos.x).toBeGreaterThanOrEqual(0);
      expect(e.pos.x).toBeLessThan(room.grid.width);
      expect(e.pos.y).toBeGreaterThanOrEqual(0);
      expect(e.pos.y).toBeLessThan(room.grid.height);
    }
  });

  it('is deterministic for a fixed (typed, template, rng-state)', () => {
    const t = template();
    const a = buildRoom(typed('r1', 'combat'), t, new Mulberry32(77));
    const b = buildRoom(typed('r1', 'combat'), t, new Mulberry32(77));
    expect(a).toEqual(b);
  });

  it('preserves the room id, type, and minimap position', () => {
    const room = buildRoom({ id: 'r5', pos: { x: 3, y: -2 }, type: 'combat' }, template(), new Mulberry32(1));
    expect(room.id).toBe('r5');
    expect(room.type).toBe('combat');
    expect(room.pos).toEqual({ x: 3, y: -2 });
  });
});

describe('buildRoom — T-75 hazard placement', () => {
  it('combat rooms get 1-3 hazard tiles', () => {
    const t = template();
    for (let seed = 1; seed <= 50; seed++) {
      const room = buildRoom(typed('r1', 'combat'), t, new Mulberry32(seed));
      const hazards = hazardTiles(room.grid);
      expect(hazards.length, `seed ${seed}`).toBeGreaterThanOrEqual(1);
      expect(hazards.length, `seed ${seed}`).toBeLessThanOrEqual(3);
    }
  });

  it('hazards never overlap the player spawn or any enemy spawn', () => {
    const t = template();
    for (let seed = 1; seed <= 50; seed++) {
      const room = buildRoom(typed('r1', 'combat'), t, new Mulberry32(seed));
      const hazards = new Set(hazardTiles(room.grid).map(key));
      expect(hazards.has(key(room.playerSpawn)), `seed ${seed} player`).toBe(false);
      for (const e of room.enemies) {
        expect(hazards.has(key(e.pos)), `seed ${seed} enemy`).toBe(false);
      }
    }
  });

  it('non-combat rooms have no hazard tiles', () => {
    const t = template();
    for (const type of ['loot', 'safe', 'merchant', 'trap', 'lace_event', 'boss'] as RoomType[]) {
      const room = buildRoom(typed('r1', type), t, new Mulberry32(4));
      expect(hazardTiles(room.grid), type).toHaveLength(0);
    }
  });
});
