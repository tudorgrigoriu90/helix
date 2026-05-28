import { describe, it, expect } from 'vitest';
import type {
  ActiveStatus,
  EnemyState,
  EntityStats,
  GridState,
  RunState,
  TileType,
} from '@shared-types/run-state';
import type { AttackAction, Position } from '@shared-types/action';
import { Mulberry32 } from '../rng/mulberry32';
import { TurnEngine } from './turn-engine';

const STATS: EntityStats = { str: 10, res: 10, agi: 10, int: 10 };

function openGrid(width = 5, height = 5): GridState {
  return { width, height, tiles: new Array<TileType>(width * height).fill('open') };
}

function enemy(
  id: string,
  pos: Position,
  over: Partial<EnemyState> = {},
): EnemyState {
  return {
    id,
    enemyDefId: 'test-enemy',
    pos,
    hp: 10,
    maxHp: 10,
    stats: { str: 8, res: 3, agi: 8, int: 5 },
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
    phase: 'player',
    turn: 1,
    grid: openGrid(),
    player: {
      id: 'player',
      pos: { x: 2, y: 2 },
      hp: 100,
      maxHp: 100,
      ap: 3,
      maxAp: 3,
      stats: STATS,
      statuses: [],
      abilities: [],
      items: [],
      mutations: [],
    },
    enemies: [enemy('e1', { x: 2, y: 1 })],
    ...over,
  };
}

function attack(targetId: string): AttackAction {
  return { type: 'attack', targetId };
}

/** Seed 1's first roll is ~0.195 ≥ 5% base crit, so a base-AGI attacker never crits. */
const noCritRng = (): Mulberry32 => new Mulberry32(1);
/** AGI 210 → crit chance ≥ 1.0, so the attacker always crits regardless of roll. */
const CRIT_STATS: EntityStats = { ...STATS, agi: 210 };

describe('TurnEngine.apply — attack (T-61)', () => {
  // ── Damage calc ──────────────────────────────────────────────────────────────

  it('deals STR-minus-RES flat damage on a normal hit', () => {
    const result = TurnEngine.apply(baseState(), attack('e1'), noCritRng());
    // STR 10 × 1.0 = 10, minus RES 3 = 7.
    expect(result.errors).toEqual([]);
    expect(result.state.enemies[0]?.hp).toBe(3);
    const dmg = result.effects.find((e) => e.type === 'damageDealt');
    expect(dmg).toEqual({ type: 'damageDealt', targetId: 'e1', amount: 7, isCrit: false, damageType: 'physical' });
  });

  it('spends 1 AP', () => {
    const result = TurnEngine.apply(baseState(), attack('e1'), noCritRng());
    expect(result.state.player.ap).toBe(2);
    expect(result.effects).toContainEqual({ type: 'apSpent', amount: 1, remaining: 2 });
  });

  it('applies the 1.5× crit multiplier before RES mitigation', () => {
    const state = baseState({
      player: { ...baseState().player, stats: CRIT_STATS },
    });
    const result = TurnEngine.apply(state, attack('e1'), noCritRng());
    // floor(10 × 1.5) = 15, minus RES 3 = 12 → enemy (10 hp) dies.
    const dmg = result.effects.find((e) => e.type === 'damageDealt');
    expect(dmg).toMatchObject({ amount: 12, isCrit: true });
    expect(result.state.enemies[0]?.hp).toBe(0);
  });

  it('never deals negative damage when RES exceeds raw damage', () => {
    const state = baseState({
      enemies: [enemy('e1', { x: 2, y: 1 }, { stats: { str: 8, res: 99, agi: 8, int: 5 } })],
    });
    const result = TurnEngine.apply(state, attack('e1'), noCritRng());
    const dmg = result.effects.find((e) => e.type === 'damageDealt');
    expect(dmg).toMatchObject({ amount: 0 });
    expect(result.state.enemies[0]?.hp).toBe(10);
  });

  it('emits entityDied when the target reaches 0 HP', () => {
    const state = baseState({ enemies: [enemy('e1', { x: 2, y: 1 }, { hp: 5 })] });
    const result = TurnEngine.apply(state, attack('e1'), noCritRng());
    expect(result.state.enemies[0]?.hp).toBe(0);
    expect(result.effects).toContainEqual({ type: 'entityDied', entityId: 'e1' });
  });

  it('does not emit entityDied when the target survives', () => {
    const result = TurnEngine.apply(baseState(), attack('e1'), noCritRng());
    expect(result.effects.some((e) => e.type === 'entityDied')).toBe(false);
  });

  it('only damages the targeted enemy', () => {
    const state = baseState({
      enemies: [enemy('e1', { x: 2, y: 1 }), enemy('e2', { x: 1, y: 2 })],
    });
    const result = TurnEngine.apply(state, attack('e1'), noCritRng());
    expect(result.state.enemies[0]?.hp).toBe(3);
    expect(result.state.enemies[1]?.hp).toBe(10);
  });

  it('is pure — does not mutate the input state', () => {
    const state = baseState();
    const snapshot = structuredClone(state);
    TurnEngine.apply(state, attack('e1'), noCritRng());
    expect(state).toEqual(snapshot);
  });

  // ── Validation ───────────────────────────────────────────────────────────────

  it('rejects an attack on a nonexistent target and returns state unchanged', () => {
    const state = baseState();
    const result = TurnEngine.apply(state, attack('ghost'), noCritRng());
    expect(result.errors[0]?.code).toBe('TARGET_NOT_FOUND');
    expect(result.state).toBe(state);
  });

  it('rejects an attack on an already-dead target', () => {
    const state = baseState({ enemies: [enemy('e1', { x: 2, y: 1 }, { hp: 0 })] });
    const result = TurnEngine.apply(state, attack('e1'), noCritRng());
    expect(result.errors[0]?.code).toBe('INVALID_TARGET');
  });

  it('rejects an attack on a phased (untargetable) enemy', () => {
    const phased: ActiveStatus = { effect: 'phased', turnsRemaining: 1 };
    const state = baseState({ enemies: [enemy('e1', { x: 2, y: 1 }, { statuses: [phased] })] });
    const result = TurnEngine.apply(state, attack('e1'), noCritRng());
    expect(result.errors[0]?.code).toBe('INVALID_TARGET');
  });

  it('rejects an attack beyond melee range', () => {
    const state = baseState({ enemies: [enemy('e1', { x: 4, y: 4 })] });
    const result = TurnEngine.apply(state, attack('e1'), noCritRng());
    expect(result.errors[0]?.code).toBe('OUT_OF_RANGE');
  });

  it('allows a diagonal melee attack (Chebyshev range 1)', () => {
    const state = baseState({ enemies: [enemy('e1', { x: 3, y: 1 })] });
    const result = TurnEngine.apply(state, attack('e1'), noCritRng());
    expect(result.errors).toEqual([]);
    expect(result.state.enemies[0]?.hp).toBe(3);
  });

  it('rejects an attack with insufficient AP', () => {
    const state = baseState({ player: { ...baseState().player, ap: 0 } });
    const result = TurnEngine.apply(state, attack('e1'), noCritRng());
    expect(result.errors[0]?.code).toBe('INSUFFICIENT_AP');
  });

  it('rejects an attack outside the player phase', () => {
    const state = baseState({ phase: 'enemy' });
    const result = TurnEngine.apply(state, attack('e1'), noCritRng());
    expect(result.errors[0]?.code).toBe('INVALID_PHASE');
  });

  // ── Determinism ──────────────────────────────────────────────────────────────

  it('produces identical results for the same rng seed', () => {
    const a = TurnEngine.apply(baseState(), attack('e1'), new Mulberry32(42));
    const b = TurnEngine.apply(baseState(), attack('e1'), new Mulberry32(42));
    expect(a).toEqual(b);
  });
});
