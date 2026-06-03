import { describe, it, expect } from 'vitest';
import type {
  EnemyState,
  EntityStats,
  GridState,
  RunState,
  TileType,
} from '@shared-types/run-state';
import { Mulberry32 } from '../rng/mulberry32';
import { TurnEngine } from './turn-engine';
import { resolveEnemyPhase } from './enemy-phase';
import { chebyshev } from './grid';

const STATS: EntityStats = { str: 10, res: 10, agi: 10, int: 10 };

function openGrid(width = 7, height = 7): GridState {
  return { width, height, tiles: new Array<TileType>(width * height).fill('open') };
}

function gridWithWall(x: number, y: number, width = 7, height = 7): GridState {
  const tiles = new Array<TileType>(width * height).fill('open');
  tiles[y * width + x] = 'wall';
  return { width, height, tiles };
}

function gridWithHazard(x: number, y: number, width = 7, height = 7): GridState {
  const tiles = new Array<TileType>(width * height).fill('open');
  tiles[y * width + x] = 'hazard';
  return { width, height, tiles };
}

function enemy(
  id: string,
  pos: { x: number; y: number },
  over: Partial<EnemyState> = {},
): EnemyState {
  return {
    id,
    enemyDefId: 'test-enemy',
    pos,
    hp: 30,
    maxHp: 30,
    stats: { str: 12, res: 3, agi: 8, int: 5 },
    statuses: [],
    telegraph: null,
    ...over,
  };
}

function baseState(over: Partial<RunState> = {}): RunState {
  return {
    schemaVersion: 1,
    seed: 0xdeadbeef,
    floorNumber: 1,
    phase: 'enemy',
    turn: 1,
    grid: openGrid(),
    player: {
      id: 'player',
      pos: { x: 3, y: 3 },
      hp: 100,
      maxHp: 100,
      ap: 0,
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

const rng = (): Mulberry32 => new Mulberry32(1);

describe('resolveEnemyPhase — T-64 (decide-and-act)', () => {
  // ── Attacking ────────────────────────────────────────────────────────────────

  it('an enemy adjacent to the player attacks for STR-minus-RES damage', () => {
    const state = baseState({ enemies: [enemy('e1', { x: 3, y: 2 })] });
    const result = resolveEnemyPhase(state, rng());
    // STR 12 - RES 10 = 2. Player 100 → 98.
    expect(result.state.player.hp).toBe(98);
    expect(result.effects).toContainEqual({ type: 'damageDealt', targetId: 'player', amount: 2, isCrit: false, damageType: 'physical' });
  });

  it('attacks from a diagonal (Chebyshev counts diagonals as 1)', () => {
    const state = baseState({ enemies: [enemy('e1', { x: 2, y: 2 })] });
    const result = resolveEnemyPhase(state, rng());
    expect(result.state.player.hp).toBe(98);
  });

  it('high-STR enemy pierces low player RES', () => {
    const state = baseState({
      player: { ...baseState().player, stats: { ...STATS, res: 2 } },
      enemies: [enemy('e1', { x: 3, y: 2 }, { stats: { str: 20, res: 3, agi: 8, int: 5 } })],
    });
    const result = resolveEnemyPhase(state, rng());
    // 20 - RES 2 = 18. Player 100 → 82.
    expect(result.state.player.hp).toBe(82);
  });

  it('damage is clamped to zero when RES exceeds STR', () => {
    const state = baseState({
      player: { ...baseState().player, stats: { ...STATS, res: 50 } },
      enemies: [enemy('e1', { x: 3, y: 2 })],
    });
    const result = resolveEnemyPhase(state, rng());
    expect(result.state.player.hp).toBe(100);
    expect(result.effects).toContainEqual({ type: 'damageDealt', targetId: 'player', amount: 0, isCrit: false, damageType: 'physical' });
  });

  // ── Moving ─────────────────────────────────────────────────────────────────

  it('an out-of-reach enemy steps one tile toward the player', () => {
    const state = baseState({ enemies: [enemy('e1', { x: 1, y: 1 })] });
    const result = resolveEnemyPhase(state, rng());
    expect(result.state.enemies[0]?.pos).toEqual({ x: 2, y: 2 });
    expect(result.effects).toContainEqual({ type: 'entityMoved', entityId: 'e1', from: { x: 1, y: 1 }, to: { x: 2, y: 2 } });
  });

  it('does not move onto a wall', () => {
    const state = baseState({
      grid: gridWithWall(2, 2),
      enemies: [enemy('e1', { x: 1, y: 1 })],
    });
    const result = resolveEnemyPhase(state, rng());
    expect(result.state.enemies[0]?.pos).toEqual({ x: 1, y: 1 });
    expect(result.effects).toEqual([]);
  });

  it('does not move onto another enemy', () => {
    const state = baseState({
      enemies: [enemy('e1', { x: 1, y: 1 }), enemy('e2', { x: 2, y: 2 })],
    });
    const result = resolveEnemyPhase(state, rng());
    expect(result.state.enemies[0]?.pos).toEqual({ x: 1, y: 1 });
  });

  it('a rooted enemy out of reach cannot move', () => {
    const state = baseState({
      enemies: [enemy('e1', { x: 1, y: 1 }, { statuses: [{ effect: 'rooted', turnsRemaining: 2 }] })],
    });
    const result = resolveEnemyPhase(state, rng());
    expect(result.state.enemies[0]?.pos).toEqual({ x: 1, y: 1 });
    expect(result.effects).toEqual([]);
  });

  it('closes the gap then attacks the next turn — no wasted turn', () => {
    // Enemy two tiles away: turn 1 moves adjacent, turn 2 attacks immediately.
    const s1 = baseState({ enemies: [enemy('e1', { x: 1, y: 3 })] });
    const r1 = resolveEnemyPhase(s1, rng());
    expect(r1.state.enemies[0]?.pos).toEqual({ x: 2, y: 3 });
    expect(r1.state.player.hp).toBe(100);

    const r2 = resolveEnemyPhase(r1.state, rng());
    expect(r2.state.player.hp).toBe(98);
  });

  // ── Other ──────────────────────────────────────────────────────────────────

  it('dead enemies do not act', () => {
    const state = baseState({ enemies: [enemy('e1', { x: 3, y: 2 }, { hp: 0 })] });
    const result = resolveEnemyPhase(state, rng());
    expect(result.state.player.hp).toBe(100);
    expect(result.effects).toEqual([]);
  });

  // ── Initiative order ───────────────────────────────────────────────────────

  it('resolves enemies in descending AGI order', () => {
    const state = baseState({
      enemies: [
        enemy('slow', { x: 1, y: 3 }, { stats: { str: 12, res: 3, agi: 2, int: 5 } }),
        enemy('fast', { x: 5, y: 3 }, { stats: { str: 12, res: 3, agi: 20, int: 5 } }),
      ],
    });
    const result = resolveEnemyPhase(state, rng());
    const moves = result.effects.filter((e) => e.type === 'entityMoved');
    expect(moves[0]).toMatchObject({ entityId: 'fast' });
    expect(moves[1]).toMatchObject({ entityId: 'slow' });
  });

  it('breaks AGI ties deterministically by id', () => {
    const state = baseState({
      enemies: [
        enemy('b', { x: 5, y: 3 }),
        enemy('a', { x: 1, y: 3 }),
      ],
    });
    const result = resolveEnemyPhase(state, rng());
    const moves = result.effects.filter((e) => e.type === 'entityMoved');
    expect(moves[0]).toMatchObject({ entityId: 'a' });
    expect(moves[1]).toMatchObject({ entityId: 'b' });
  });

  // ── Purity ─────────────────────────────────────────────────────────────────

  it('is pure — does not mutate the input state', () => {
    const state = baseState({ enemies: [enemy('e1', { x: 3, y: 2 })] });
    const snapshot = structuredClone(state);
    resolveEnemyPhase(state, rng());
    expect(state).toEqual(snapshot);
  });
});

describe('endTurn / wait turn flow — T-64', () => {
  function playerTurnState(over: Partial<RunState> = {}): RunState {
    return baseState({ phase: 'player', ...over });
  }

  it('endTurn resolves the enemy phase and returns control to the player', () => {
    const state = playerTurnState({ enemies: [enemy('e1', { x: 3, y: 2 })] });
    const result = TurnEngine.apply(state, { type: 'endTurn' }, rng());
    expect(result.state.phase).toBe('player');
    expect(result.state.player.hp).toBe(98);
  });

  it('endTurn refreshes AP and advances the turn counter', () => {
    const state = playerTurnState({ player: { ...playerTurnState().player, ap: 0 }, turn: 4 });
    const result = TurnEngine.apply(state, { type: 'endTurn' }, rng());
    expect(result.state.player.ap).toBe(3);
    expect(result.state.turn).toBe(5);
  });

  it('endTurn decrements ability cooldowns', () => {
    const def = {
      id: 'a1', apCost: 1, cooldown: 3, range: 1, targetType: 'self' as const,
      baseDamage: 0, damageType: 'physical' as const, intScaling: 0, aoeRadius: 0,
      appliesStatus: null, statusDuration: 0,
    };
    const state = playerTurnState({
      player: { ...playerTurnState().player, abilities: [{ def, cooldownRemaining: 2 }] },
    });
    const result = TurnEngine.apply(state, { type: 'endTurn' }, rng());
    expect(result.state.player.abilities[0]?.cooldownRemaining).toBe(1);
  });

  it('emits phaseChanged for both transitions', () => {
    const state = playerTurnState();
    const result = TurnEngine.apply(state, { type: 'endTurn' }, rng());
    expect(result.effects[0]).toEqual({ type: 'phaseChanged', from: 'player', to: 'enemy' });
    expect(result.effects).toContainEqual({ type: 'phaseChanged', from: 'enemy', to: 'player' });
  });

  it('wait also ends the turn (triggers the enemy phase)', () => {
    const state = playerTurnState({ enemies: [enemy('e1', { x: 3, y: 2 })] });
    const result = TurnEngine.apply(state, { type: 'wait' }, rng());
    expect(result.state.player.hp).toBe(98);
    expect(result.state.turn).toBe(2);
  });

  it('rejects endTurn outside the player phase', () => {
    const state = playerTurnState({ phase: 'enemy' });
    const result = TurnEngine.apply(state, { type: 'endTurn' }, rng());
    expect(result.errors[0]?.code).toBe('INVALID_PHASE');
  });

  it('ticks player statuses during the cycle (Burn bites on endTurn)', () => {
    const state = playerTurnState({
      player: { ...playerTurnState().player, statuses: [{ effect: 'burn', turnsRemaining: 2 }] },
    });
    const result = TurnEngine.apply(state, { type: 'endTurn' }, rng());
    expect(result.state.player.hp).toBe(95);
    expect(result.state.player.statuses).toEqual([{ effect: 'burn', turnsRemaining: 1 }]);
  });

  it('a Burn tick that kills the player ends in defeat with cause status_tick', () => {
    const state = playerTurnState({
      player: { ...playerTurnState().player, hp: 4, statuses: [{ effect: 'burn', turnsRemaining: 2 }] },
    });
    const result = TurnEngine.apply(state, { type: 'endTurn' }, rng());
    expect(result.state.phase).toBe('defeat');
    expect(result.effects).toContainEqual({ type: 'defeat', cause: 'status_tick' });
  });

  it('flanks: a second enemy routes to a free diagonal when the direct tile is taken', () => {
    // Player (3,3). Enemy A is already adjacent at (3,2) → it attacks (stays).
    // Enemy B at (3,1) wants to close, but (3,2) is taken, so it must flank to a
    // free tile next to the player rather than queue behind A.
    const state = baseState({
      enemies: [enemy('a', { x: 3, y: 2 }), enemy('b', { x: 3, y: 1 })],
    });
    const result = resolveEnemyPhase(state, rng());
    const a = result.state.enemies.find((e) => e.id === 'a')!;
    const b = result.state.enemies.find((e) => e.id === 'b')!;
    expect(a.pos).toEqual({ x: 3, y: 2 }); // A held its ground to attack
    expect(b.pos).not.toEqual({ x: 3, y: 2 }); // B did not pile onto A's tile
    expect(chebyshev(b.pos, state.player.pos)).toBe(1); // B reached a flanking tile
  });

  it('damages an enemy that steps onto a hazard tile (GDD §6.1)', () => {
    // Enemy at (3,5) chases the player at (3,3) → steps to (3,4), a hazard.
    const state = baseState({
      grid: gridWithHazard(3, 4),
      enemies: [enemy('e1', { x: 3, y: 5 }, { hp: 30, maxHp: 30 })],
    });
    const result = resolveEnemyPhase(state, rng());
    const e1 = result.state.enemies.find((e) => e.id === 'e1')!;
    expect(e1.pos).toEqual({ x: 3, y: 4 }); // stepped onto the hazard
    expect(e1.hp).toBe(30 - 5); // HAZARD_DAMAGE
    expect(result.effects.some((e) => e.type === 'damageDealt' && e.targetId === 'e1' && e.damageType === 'true')).toBe(true);
  });
});
