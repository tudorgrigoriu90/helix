import { describe, it, expect } from 'vitest';
import type {
  EnemyState,
  EntityStats,
  GridState,
  RunState,
  TileType,
} from '@shared-types/run-state';
import { Mulberry32 } from '../rng/mulberry32';
import { detectOutcome } from './outcome';
import { TurnEngine } from './turn-engine';

const STATS: EntityStats = { str: 10, res: 10, agi: 10, int: 10 };

function grid(): GridState {
  return { width: 7, height: 7, tiles: new Array<TileType>(49).fill('open') };
}

function enemy(id: string, hp = 30): EnemyState {
  return {
    id, enemyDefId: 'e', pos: { x: 3, y: 2 }, hp, maxHp: 30,
    stats: { str: 8, res: 3, agi: 8, int: 5 }, statuses: [], telegraph: null,
  };
}

function state(over: Partial<RunState> = {}): RunState {
  return {
    schemaVersion: 1, seed: 1, floorNumber: 1, phase: 'player', turn: 1, grid: grid(),
    player: {
      id: 'player', pos: { x: 3, y: 3 }, hp: 100, maxHp: 100, ap: 3, maxAp: 3,
      stats: STATS, statuses: [], abilities: [], items: [], mutations: [],
    },
    enemies: [enemy('e1')],
    ...over,
  };
}

describe('detectOutcome — T-66', () => {
  it('declares defeat when player HP is 0', () => {
    const result = detectOutcome(state({ player: { ...state().player, hp: 0 } }));
    expect(result.state.phase).toBe('defeat');
    expect(result.effects).toContainEqual({ type: 'defeat', cause: 'enemy_kill' });
  });

  it('passes through a death cause', () => {
    const result = detectOutcome(state({ player: { ...state().player, hp: 0 } }), 'status_tick');
    expect(result.effects).toContainEqual({ type: 'defeat', cause: 'status_tick' });
  });

  it('declares floor_complete when every enemy is dead', () => {
    const result = detectOutcome(state({ enemies: [enemy('e1', 0), enemy('e2', 0)] }));
    expect(result.state.phase).toBe('floor_complete');
    expect(result.effects).toContainEqual({ type: 'floorComplete' });
  });

  it('declares victory when the final floor is cleared', () => {
    const result = detectOutcome(state({ floorNumber: 20, enemies: [enemy('e1', 0)] }));
    expect(result.state.phase).toBe('victory');
    expect(result.effects).toContainEqual({ type: 'victory' });
  });

  it('does nothing while combat is ongoing', () => {
    const result = detectOutcome(state());
    expect(result.effects).toEqual([]);
    expect(result.state.phase).toBe('player');
  });

  it('does not declare floor_complete when there are no enemies at all', () => {
    const result = detectOutcome(state({ enemies: [] }));
    expect(result.effects).toEqual([]);
  });

  it('is idempotent on an already-terminal phase', () => {
    const s = state({ phase: 'defeat', player: { ...state().player, hp: 0 } });
    const result = detectOutcome(s);
    expect(result.effects).toEqual([]);
    expect(result.state).toBe(s);
  });

  // ── Integration through apply() ──────────────────────────────────────────────

  it('a killing blow that clears the last enemy ends the floor', () => {
    const s = state({ enemies: [enemy('e1', 5)] });
    const result = TurnEngine.apply(s, { type: 'attack', targetId: 'e1' }, new Mulberry32(1));
    expect(result.state.enemies[0]?.hp).toBe(0);
    expect(result.state.phase).toBe('floor_complete');
    expect(result.effects).toContainEqual({ type: 'floorComplete' });
  });

  it('surrender transitions to defeat with cause surrender', () => {
    const result = TurnEngine.apply(state(), { type: 'surrender' }, new Mulberry32(1));
    expect(result.state.phase).toBe('defeat');
    expect(result.effects).toContainEqual({ type: 'defeat', cause: 'surrender' });
  });

  it('surrendering again is rejected', () => {
    const result = TurnEngine.apply(state({ phase: 'defeat' }), { type: 'surrender' }, new Mulberry32(1));
    expect(result.errors[0]?.code).toBe('ALREADY_SURRENDERED');
  });
});
