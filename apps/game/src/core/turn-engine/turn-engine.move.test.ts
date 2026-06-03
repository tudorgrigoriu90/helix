import { describe, it, expect } from 'vitest';
import type {
  EnemyState,
  EntityStats,
  GridState,
  RunState,
  TileType,
} from '@shared-types/run-state';
import type { MoveAction, Position } from '@shared-types/action';
import { Mulberry32 } from '../rng/mulberry32';
import { TurnEngine } from './turn-engine';

const STATS: EntityStats = { str: 5, res: 5, agi: 5, int: 5 };

/** 5×5 all-open grid. */
function openGrid(width = 5, height = 5): GridState {
  return {
    width,
    height,
    tiles: new Array<TileType>(width * height).fill('open'),
  };
}

function gridWith(width: number, height: number, overrides: Record<string, TileType>): GridState {
  const tiles = new Array<TileType>(width * height).fill('open');
  for (const [key, type] of Object.entries(overrides)) {
    const [x, y] = key.split(',').map(Number);
    tiles[y! * width + x!] = type;
  }
  return { width, height, tiles };
}

function baseState(over: Partial<RunState> = {}): RunState {
  return {
    schemaVersion: 1,
    seed: 0xdeadbeef,
    floorNumber: 1,
    phase: 'player',
    turn: 1,
    grid: openGrid(),
    player: {
      id: 'player',
      pos: { x: 2, y: 2 },
      hp: 30,
      maxHp: 30,
      ap: 3,
      maxAp: 3,
      stats: STATS,
      statuses: [],
      abilities: [],
      items: [],
      mutations: [],
    },
    enemies: [],
    ...over,
  };
}

function enemy(id: string, pos: Position, hp = 10): EnemyState {
  return {
    id,
    enemyDefId: 'test-enemy',
    pos,
    hp,
    maxHp: 10,
    stats: STATS,
    statuses: [],
    telegraph: null,
  };
}

function move(targetPos: Position): MoveAction {
  return { type: 'move', targetPos };
}

const rng = (): Mulberry32 => new Mulberry32(1);

describe('TurnEngine.apply — move (T-60)', () => {
  // ── Valid moves ────────────────────────────────────────────────────────────

  it('moves the player one orthogonal tile and spends 1 AP', () => {
    const state = baseState();
    const result = TurnEngine.apply(state, move({ x: 2, y: 1 }), rng());

    expect(result.errors).toEqual([]);
    expect(result.state.player.pos).toEqual({ x: 2, y: 1 });
    expect(result.state.player.ap).toBe(2);
  });

  it('moves diagonally (Chebyshev distance 1)', () => {
    const state = baseState();
    const result = TurnEngine.apply(state, move({ x: 3, y: 3 }), rng());

    expect(result.errors).toEqual([]);
    expect(result.state.player.pos).toEqual({ x: 3, y: 3 });
    expect(result.state.player.ap).toBe(2);
  });

  it('emits entityMoved and apSpent effects in order', () => {
    const state = baseState();
    const result = TurnEngine.apply(state, move({ x: 1, y: 2 }), rng());

    expect(result.effects).toEqual([
      { type: 'entityMoved', entityId: 'player', from: { x: 2, y: 2 }, to: { x: 1, y: 2 } },
      { type: 'apSpent', amount: 1, remaining: 2 },
    ]);
  });

  it('is pure — does not mutate the input state', () => {
    const state = baseState();
    const snapshot = structuredClone(state);
    TurnEngine.apply(state, move({ x: 2, y: 1 }), rng());
    expect(state).toEqual(snapshot);
  });

  it('moves to a non-wall special tile (hazard is enterable)', () => {
    const state = baseState({ grid: gridWith(5, 5, { '2,1': 'hazard' }) });
    const result = TurnEngine.apply(state, move({ x: 2, y: 1 }), rng());
    expect(result.errors).toEqual([]);
    expect(result.state.player.pos).toEqual({ x: 2, y: 1 });
  });

  it('can move onto a tile where a dead enemy lies', () => {
    const state = baseState({ enemies: [enemy('e1', { x: 2, y: 1 }, 0)] });
    const result = TurnEngine.apply(state, move({ x: 2, y: 1 }), rng());
    expect(result.errors).toEqual([]);
    expect(result.state.player.pos).toEqual({ x: 2, y: 1 });
  });

  // ── Invalid moves ────────────────────────────────────────────────────────────

  it('rejects a move outside the grid', () => {
    const state = baseState({ player: { ...baseState().player, pos: { x: 0, y: 0 } } });
    const result = TurnEngine.apply(state, move({ x: -1, y: 0 }), rng());
    expect(result.errors[0]?.code).toBe('OUT_OF_RANGE');
    expect(result.state).toBe(state);
  });

  it('rejects a non-adjacent move (2 tiles away)', () => {
    const state = baseState();
    const result = TurnEngine.apply(state, move({ x: 4, y: 2 }), rng());
    expect(result.errors[0]?.code).toBe('OUT_OF_RANGE');
  });

  it('rejects a zero-distance move (staying put)', () => {
    const state = baseState();
    const result = TurnEngine.apply(state, move({ x: 2, y: 2 }), rng());
    expect(result.errors[0]?.code).toBe('OUT_OF_RANGE');
  });

  it('rejects moving into a wall', () => {
    const state = baseState({ grid: gridWith(5, 5, { '2,1': 'wall' }) });
    const result = TurnEngine.apply(state, move({ x: 2, y: 1 }), rng());
    expect(result.errors[0]?.code).toBe('INVALID_TARGET');
    expect(result.state).toBe(state);
  });

  it('rejects moving into a living enemy', () => {
    const state = baseState({ enemies: [enemy('e1', { x: 2, y: 1 })] });
    const result = TurnEngine.apply(state, move({ x: 2, y: 1 }), rng());
    expect(result.errors[0]?.code).toBe('INVALID_TARGET');
  });

  it('rejects a move with insufficient AP', () => {
    const state = baseState({ player: { ...baseState().player, ap: 0 } });
    const result = TurnEngine.apply(state, move({ x: 2, y: 1 }), rng());
    expect(result.errors[0]?.code).toBe('INSUFFICIENT_AP');
    expect(result.state).toBe(state);
  });

  it('rejects a move outside the player phase', () => {
    const state = baseState({ phase: 'enemy' });
    const result = TurnEngine.apply(state, move({ x: 2, y: 1 }), rng());
    expect(result.errors[0]?.code).toBe('INVALID_PHASE');
  });

  it('rejects a move while the player is Rooted (GDD §6.5)', () => {
    const state = baseState({
      player: {
        ...baseState().player,
        statuses: [{ effect: 'rooted', turnsRemaining: 2 }],
      },
    });
    const result = TurnEngine.apply(state, move({ x: 2, y: 1 }), rng());
    expect(result.errors[0]?.code).toBe('ROOTED');
    expect(result.state.player.pos).toEqual({ x: 2, y: 2 });
    expect(result.state.player.ap).toBe(3); // AP not spent
  });

  // ── Determinism ──────────────────────────────────────────────────────────────

  it('produces identical results on repeated application', () => {
    const state = baseState();
    const a = TurnEngine.apply(state, move({ x: 3, y: 1 }), rng());
    const b = TurnEngine.apply(state, move({ x: 3, y: 1 }), rng());
    expect(a).toEqual(b);
  });

  // ── Hazard tiles (GDD §6.1 — damage on entry) ────────────────────────────────

  it('damages the player on entering a hazard tile (true damage), emitting the hit', () => {
    const state = baseState({ grid: gridWith(5, 5, { '2,1': 'hazard' }) });
    const result = TurnEngine.apply(state, move({ x: 2, y: 1 }), rng());
    expect(result.errors).toHaveLength(0);
    expect(result.state.player.hp).toBe(30 - 5); // HAZARD_DAMAGE
    expect(result.effects.some((e) => e.type === 'damageDealt' && e.targetId === 'player' && e.damageType === 'true')).toBe(true);
  });

  it('moving onto an open tile deals no damage (regression)', () => {
    const result = TurnEngine.apply(baseState(), move({ x: 2, y: 1 }), rng());
    expect(result.state.player.hp).toBe(30);
    expect(result.effects.some((e) => e.type === 'damageDealt')).toBe(false);
  });

  it('a hazard step that drops HP to 0 ends the run with cause "hazard"', () => {
    const base = baseState({ grid: gridWith(5, 5, { '2,1': 'hazard' }) });
    const state: RunState = { ...base, player: { ...base.player, hp: 3 } }; // less than HAZARD_DAMAGE
    const result = TurnEngine.apply(state, move({ x: 2, y: 1 }), rng());
    expect(result.state.phase).toBe('defeat');
    expect(result.effects.some((e) => e.type === 'defeat' && e.cause === 'hazard')).toBe(true);
  });
});
