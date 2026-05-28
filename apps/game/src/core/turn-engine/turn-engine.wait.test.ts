import { describe, it, expect } from 'vitest';
import type {
  ActiveStatus,
  EnemyState,
  EntityStats,
  GridState,
  RunState,
  TileType,
} from '@shared-types/run-state';
import type { Position, WaitAction } from '@shared-types/action';
import { Mulberry32 } from '../rng/mulberry32';
import { TurnEngine } from './turn-engine';

// T-68 coverage gap fill: `wait` had only one happy-path invocation in the
// enemy-phase tests. This file covers the phase guard, AP-skip semantics, and
// the interaction with status ticking — explicit per-action coverage as the
// Task Plan calls for ("every Action type, every edge case").

const STATS: EntityStats = { str: 5, res: 5, agi: 5, int: 5 };

function openGrid(width = 5, height = 5): GridState {
  return { width, height, tiles: new Array<TileType>(width * height).fill('open') };
}

function enemy(id: string, pos: Position): EnemyState {
  return {
    id,
    enemyDefId: 'test-enemy',
    pos,
    hp: 10,
    maxHp: 10,
    stats: STATS,
    statuses: [],
    telegraph: null,
  };
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
      ap: 2, // deliberately not full — wait should still defer to endTurn
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

const wait = (): WaitAction => ({ type: 'wait' });
const rng = (): Mulberry32 => new Mulberry32(1);

describe('TurnEngine.apply — wait (T-68 coverage)', () => {
  it('rejects wait outside the player phase', () => {
    const result = TurnEngine.apply(baseState({ phase: 'enemy' }), wait(), rng());
    expect(result.errors[0]?.code).toBe('INVALID_PHASE');
    expect(result.errors[0]?.message).toMatch(/wait requires player phase/);
    expect(result.effects).toEqual([]);
  });

  it('hands control back to the player with refreshed AP and an advanced turn counter', () => {
    // No enemies means the enemy phase is a no-op; we should land back in
    // player phase with maxAp and turn+1.
    const result = TurnEngine.apply(baseState({ turn: 5 }), wait(), rng());
    expect(result.errors).toEqual([]);
    expect(result.state.phase).toBe('player');
    expect(result.state.turn).toBe(6);
    expect(result.state.player.ap).toBe(result.state.player.maxAp);
  });

  it('forfeits remaining AP (does not preserve unused AP across turns)', () => {
    // GDD §4.4 — "Unused AP does not carry over to the next turn."
    const result = TurnEngine.apply(baseState({ player: { ...baseState().player, ap: 2 } }), wait(), rng());
    expect(result.state.player.ap).toBe(3); // maxAp, not the previous 2 + something
  });

  it('still triggers the enemy phase — enemies act on a waited turn', () => {
    // mitigate() clamps damage to max(0, str - res); equal stats deal zero.
    // Use a hard-hitting enemy (STR 12) against default RES 5 → 7 damage.
    const hardHitter: EnemyState = {
      ...enemy('e1', { x: 3, y: 2 }),
      stats: { ...STATS, str: 12 },
    };
    const state = baseState({ enemies: [hardHitter] });
    const before = state.player.hp;
    const result = TurnEngine.apply(state, wait(), rng());
    expect(result.state.player.hp).toBeLessThan(before);
    expect(result.effects).toContainEqual(
      expect.objectContaining({ type: 'damageDealt', targetId: 'player' }),
    );
  });

  it('ticks player statuses on the resulting endTurn cycle', () => {
    // A 1-turn Burn should expire over the wait → endTurn cycle.
    const burn: ActiveStatus = { effect: 'burn', turnsRemaining: 1 };
    const state = baseState({ player: { ...baseState().player, statuses: [burn] } });
    const result = TurnEngine.apply(state, wait(), rng());
    expect(result.state.player.statuses).toEqual([]);
  });

  it('is pure — does not mutate the input state', () => {
    const state = baseState({ enemies: [enemy('e1', { x: 3, y: 2 })] });
    const snapshot = structuredClone(state);
    TurnEngine.apply(state, wait(), rng());
    expect(state).toEqual(snapshot);
  });
});
