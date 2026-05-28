import { describe, it, expect } from 'vitest';
import type {
  ActiveStatus,
  EnemyState,
  EntityStats,
  GridState,
  RunState,
  TileType,
} from '@shared-types/run-state';
import type { AbilityDef, AbilitySlot } from '@shared-types/ability';
import type { Position, UseAbilityAction } from '@shared-types/action';
import { Mulberry32 } from '../rng/mulberry32';
import { TurnEngine } from './turn-engine';

const STATS: EntityStats = { str: 10, res: 10, agi: 10, int: 10 };

function openGrid(width = 7, height = 7): GridState {
  return { width, height, tiles: new Array<TileType>(width * height).fill('open') };
}

function ability(over: Partial<AbilityDef> = {}): AbilityDef {
  return {
    id: 'test_bolt',
    apCost: 2,
    cooldown: 3,
    range: 3,
    targetType: 'enemy',
    baseDamage: 15,
    damageType: 'pressure',
    intScaling: 0.5,
    aoeRadius: 0,
    appliesStatus: null,
    statusDuration: 0,
    ...over,
  };
}

function slot(def: AbilityDef, cooldownRemaining = 0): AbilitySlot {
  return { def, cooldownRemaining };
}

function enemy(id: string, pos: Position, over: Partial<EnemyState> = {}): EnemyState {
  return {
    id,
    enemyDefId: 'test-enemy',
    pos,
    hp: 30,
    maxHp: 30,
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
      pos: { x: 3, y: 3 },
      hp: 100,
      maxHp: 100,
      ap: 3,
      maxAp: 3,
      stats: STATS,
      statuses: [],
      abilities: [slot(ability())],
      items: [],
      mutations: [],
    },
    enemies: [enemy('e1', { x: 3, y: 2 })],
    ...over,
  };
}

function use(abilityId: string, target: { targetId?: string; targetPos?: Position } = {}): UseAbilityAction {
  return { type: 'useAbility', abilityId, ...target };
}

const rng = (): Mulberry32 => new Mulberry32(1);

describe('TurnEngine.apply — useAbility (T-62)', () => {
  // ── Damage + INT scaling ───────────────────────────────────────────────────

  it('deals base + INT-scaled damage, mitigated by RES', () => {
    const result = TurnEngine.apply(baseState(), use('test_bolt', { targetId: 'e1' }), rng());
    // 15 + floor(10 × 0.5)=5 → 20, minus RES 3 = 17. Enemy 30 → 13.
    expect(result.errors).toEqual([]);
    expect(result.state.enemies[0]?.hp).toBe(13);
    expect(result.effects).toContainEqual({
      type: 'damageDealt', targetId: 'e1', amount: 17, isCrit: false, damageType: 'pressure',
    });
  });

  it('true damage ignores RES', () => {
    const state = baseState({
      player: { ...baseState().player, abilities: [slot(ability({ damageType: 'true' }))] },
    });
    const result = TurnEngine.apply(state, use('test_bolt', { targetId: 'e1' }), rng());
    // 20 true damage, no mitigation. Enemy 30 → 10.
    expect(result.state.enemies[0]?.hp).toBe(10);
  });

  it('emits abilityUsed and apSpent', () => {
    const result = TurnEngine.apply(baseState(), use('test_bolt', { targetId: 'e1' }), rng());
    expect(result.effects[0]).toEqual({ type: 'abilityUsed', entityId: 'player', abilityId: 'test_bolt' });
    expect(result.effects).toContainEqual({ type: 'apSpent', amount: 2, remaining: 1 });
    expect(result.state.player.ap).toBe(1);
  });

  it('emits entityDied when the ability is lethal', () => {
    const state = baseState({ enemies: [enemy('e1', { x: 3, y: 2 }, { hp: 10 })] });
    const result = TurnEngine.apply(state, use('test_bolt', { targetId: 'e1' }), rng());
    expect(result.state.enemies[0]?.hp).toBe(0);
    expect(result.effects).toContainEqual({ type: 'entityDied', entityId: 'e1' });
  });

  // ── Cooldown tracking ──────────────────────────────────────────────────────

  it('sets the ability cooldown after use', () => {
    const result = TurnEngine.apply(baseState(), use('test_bolt', { targetId: 'e1' }), rng());
    expect(result.state.player.abilities[0]?.cooldownRemaining).toBe(3);
  });

  it('rejects an ability still on cooldown', () => {
    const state = baseState({
      player: { ...baseState().player, abilities: [slot(ability(), 2)] },
    });
    const result = TurnEngine.apply(state, use('test_bolt', { targetId: 'e1' }), rng());
    expect(result.errors[0]?.code).toBe('ABILITY_ON_COOLDOWN');
    expect(result.state).toBe(state);
  });

  // ── Status application ─────────────────────────────────────────────────────

  it('applies a status to the damaged enemy', () => {
    const state = baseState({
      player: { ...baseState().player, abilities: [slot(ability({ appliesStatus: 'crushed', statusDuration: 2 }))] },
    });
    const result = TurnEngine.apply(state, use('test_bolt', { targetId: 'e1' }), rng());
    expect(result.state.enemies[0]?.statuses).toContainEqual({ effect: 'crushed', turnsRemaining: 2 });
    expect(result.effects).toContainEqual({ type: 'statusApplied', targetId: 'e1', status: 'crushed', turns: 2 });
  });

  it('does not apply a status to an enemy killed by the same ability', () => {
    const state = baseState({
      enemies: [enemy('e1', { x: 3, y: 2 }, { hp: 5 })],
      player: { ...baseState().player, abilities: [slot(ability({ appliesStatus: 'crushed', statusDuration: 2 }))] },
    });
    const result = TurnEngine.apply(state, use('test_bolt', { targetId: 'e1' }), rng());
    expect(result.state.enemies[0]?.hp).toBe(0);
    expect(result.state.enemies[0]?.statuses).toEqual([]);
    expect(result.effects.some((e) => e.type === 'statusApplied')).toBe(false);
  });

  it('self-target ability applies its status to the player', () => {
    const state = baseState({
      player: {
        ...baseState().player,
        abilities: [slot(ability({ targetType: 'self', range: 0, baseDamage: 0, intScaling: 0, appliesStatus: 'regenerating', statusDuration: 3 }))],
      },
    });
    const result = TurnEngine.apply(state, use('test_bolt'), rng());
    expect(result.state.player.statuses).toContainEqual({ effect: 'regenerating', turnsRemaining: 3 });
    expect(result.effects).toContainEqual({ type: 'statusApplied', targetId: 'player', status: 'regenerating', turns: 3 });
  });

  // ── AoE targeting ──────────────────────────────────────────────────────────

  it('AoE tile ability hits every living enemy within the radius', () => {
    const state = baseState({
      player: { ...baseState().player, abilities: [slot(ability({ targetType: 'tile', aoeRadius: 1 }))] },
      enemies: [
        enemy('e1', { x: 3, y: 3 }), // on the tile
        enemy('e2', { x: 4, y: 3 }), // adjacent — in radius
        enemy('e3', { x: 6, y: 6 }), // far — out of radius
      ],
    });
    const result = TurnEngine.apply(state, use('test_bolt', { targetPos: { x: 3, y: 3 } }), rng());
    expect(result.state.enemies[0]?.hp).toBe(13);
    expect(result.state.enemies[1]?.hp).toBe(13);
    expect(result.state.enemies[2]?.hp).toBe(30);
  });

  it('AoE around an enemy target hits the target plus splash', () => {
    const state = baseState({
      player: { ...baseState().player, abilities: [slot(ability({ aoeRadius: 1 }))] },
      enemies: [enemy('e1', { x: 3, y: 2 }), enemy('e2', { x: 4, y: 2 })],
    });
    const result = TurnEngine.apply(state, use('test_bolt', { targetId: 'e1' }), rng());
    expect(result.state.enemies[0]?.hp).toBe(13);
    expect(result.state.enemies[1]?.hp).toBe(13);
  });

  // ── Validation ─────────────────────────────────────────────────────────────

  it('rejects an unknown ability id', () => {
    const result = TurnEngine.apply(baseState(), use('nope', { targetId: 'e1' }), rng());
    expect(result.errors[0]?.code).toBe('ABILITY_NOT_FOUND');
  });

  it('rejects ability use while suppressed', () => {
    const suppressed: ActiveStatus = { effect: 'suppressed', turnsRemaining: 2 };
    const state = baseState({ player: { ...baseState().player, statuses: [suppressed] } });
    const result = TurnEngine.apply(state, use('test_bolt', { targetId: 'e1' }), rng());
    expect(result.errors[0]?.code).toBe('ABILITY_SUPPRESSED');
  });

  it('rejects insufficient AP', () => {
    const state = baseState({ player: { ...baseState().player, ap: 1 } });
    const result = TurnEngine.apply(state, use('test_bolt', { targetId: 'e1' }), rng());
    expect(result.errors[0]?.code).toBe('INSUFFICIENT_AP');
  });

  it('rejects an enemy target beyond range', () => {
    // Range-1 ability; enemy 3 tiles away (Chebyshev) from player at (3,3).
    const state = baseState({
      player: { ...baseState().player, abilities: [slot(ability({ range: 1 }))] },
      enemies: [enemy('e1', { x: 6, y: 6 })],
    });
    const result = TurnEngine.apply(state, use('test_bolt', { targetId: 'e1' }), rng());
    expect(result.errors[0]?.code).toBe('OUT_OF_RANGE');
  });

  it('rejects an enemy-target ability with no targetId', () => {
    const result = TurnEngine.apply(baseState(), use('test_bolt'), rng());
    expect(result.errors[0]?.code).toBe('INVALID_TARGET');
  });

  it('rejects a phased (untargetable) enemy', () => {
    const phased: ActiveStatus = { effect: 'phased', turnsRemaining: 1 };
    const state = baseState({ enemies: [enemy('e1', { x: 3, y: 2 }, { statuses: [phased] })] });
    const result = TurnEngine.apply(state, use('test_bolt', { targetId: 'e1' }), rng());
    expect(result.errors[0]?.code).toBe('INVALID_TARGET');
  });

  it('rejects ability use outside the player phase', () => {
    const state = baseState({ phase: 'enemy' });
    const result = TurnEngine.apply(state, use('test_bolt', { targetId: 'e1' }), rng());
    expect(result.errors[0]?.code).toBe('INVALID_PHASE');
  });

  // ── Purity & determinism ─────────────────────────────────────────────────────

  it('is pure — does not mutate the input state', () => {
    const state = baseState();
    const snapshot = structuredClone(state);
    TurnEngine.apply(state, use('test_bolt', { targetId: 'e1' }), rng());
    expect(state).toEqual(snapshot);
  });

  it('is deterministic and consumes no RNG (abilities do not crit)', () => {
    const a = TurnEngine.apply(baseState(), use('test_bolt', { targetId: 'e1' }), new Mulberry32(7));
    const b = TurnEngine.apply(baseState(), use('test_bolt', { targetId: 'e1' }), new Mulberry32(999));
    expect(a.state).toEqual(b.state);
    expect(a.effects).toEqual(b.effects);
  });
});
