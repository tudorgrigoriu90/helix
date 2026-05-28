import { describe, it, expect } from 'vitest';
import type {
  EnemyState,
  EntityStats,
  GridState,
  RunState,
  Telegraph,
  TileType,
} from '@shared-types/run-state';
import { generateTelegraphs } from './telegraph';

const STATS: EntityStats = { str: 10, res: 10, agi: 10, int: 10 };

function grid(): GridState {
  return { width: 7, height: 7, tiles: new Array<TileType>(49).fill('open') };
}

function enemy(id: string, pos: { x: number; y: number }, telegraph: Telegraph | null, hp = 30): EnemyState {
  return {
    id, enemyDefId: 'e', pos, hp, maxHp: 30,
    stats: { str: 8, res: 3, agi: 8, int: 5 }, statuses: [], telegraph,
  };
}

function state(enemies: EnemyState[]): RunState {
  return {
    schemaVersion: 1, seed: 1, floorNumber: 1, phase: 'enemy', turn: 1, grid: grid(),
    player: {
      id: 'player', pos: { x: 3, y: 3 }, hp: 100, maxHp: 100, ap: 3, maxAp: 3,
      stats: STATS, statuses: [], abilities: [], items: [], mutations: [],
    },
    enemies,
  };
}

describe('generateTelegraphs — T-67', () => {
  it('telegraphs melee when adjacent to the player', () => {
    const result = generateTelegraphs(state([enemy('e1', { x: 3, y: 2 }, null)]));
    expect(result.state.enemies[0]?.telegraph).toBe('melee');
    expect(result.effects).toContainEqual({ type: 'telegraphUpdated', enemyId: 'e1', telegraph: 'melee' });
  });

  it('telegraphs move when far from the player', () => {
    const result = generateTelegraphs(state([enemy('e1', { x: 0, y: 0 }, null)]));
    expect(result.state.enemies[0]?.telegraph).toBe('move');
    expect(result.effects).toContainEqual({ type: 'telegraphUpdated', enemyId: 'e1', telegraph: 'move' });
  });

  it('does not emit an update when the telegraph is unchanged', () => {
    const result = generateTelegraphs(state([enemy('e1', { x: 3, y: 2 }, 'melee')]));
    expect(result.effects).toEqual([]);
  });

  it('leaves dead enemies untouched', () => {
    const result = generateTelegraphs(state([enemy('e1', { x: 3, y: 2 }, 'idle', 0)]));
    expect(result.state.enemies[0]?.telegraph).toBe('idle');
    expect(result.effects).toEqual([]);
  });

  it('is pure — does not mutate input', () => {
    const s = state([enemy('e1', { x: 0, y: 0 }, null)]);
    const snapshot = structuredClone(s);
    generateTelegraphs(s);
    expect(s).toEqual(snapshot);
  });
});
