import { describe, it, expect } from 'vitest';
import type {
  EnemyState,
  EntityStats,
  GridState,
  RunState,
  TileType,
} from '@shared-types/run-state';
import type { ItemDef } from '@shared-types/item';
import type { Position, UseItemAction } from '@shared-types/action';
import { Mulberry32 } from '../rng/mulberry32';
import { TurnEngine } from './turn-engine';

const STATS: EntityStats = { str: 10, res: 10, agi: 10, int: 10 };

function openGrid(width = 7, height = 7): GridState {
  return { width, height, tiles: new Array<TileType>(width * height).fill('open') };
}

const veinSerum: ItemDef = { id: 'vein_serum', category: 'consumable', effect: { kind: 'heal', amount: 25 } };
const nullGrenade: ItemDef = { id: 'null_grenade', category: 'consumable', effect: { kind: 'damage', amount: 30, damageType: 'true', aoeRadius: 1 } };
const physGrenade: ItemDef = { id: 'phys_grenade', category: 'consumable', effect: { kind: 'damage', amount: 30, damageType: 'physical', aoeRadius: 0 } };
const sporeBomb: ItemDef = { id: 'spore_bomb', category: 'consumable', effect: { kind: 'applyStatus', status: 'infected', duration: 4, aoeRadius: 1 } };
const depthGauge: ItemDef = { id: 'depth_gauge', category: 'passive', effect: null };

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
      hp: 60,
      maxHp: 100,
      ap: 3,
      maxAp: 3,
      stats: STATS,
      statuses: [],
      abilities: [],
      items: [veinSerum],
      mutations: [],
    },
    enemies: [enemy('e1', { x: 3, y: 2 })],
    ...over,
  };
}

function use(itemId: string, target: { targetPos?: Position } = {}): UseItemAction {
  return { type: 'useItem', itemId, ...target };
}

const rng = (): Mulberry32 => new Mulberry32(1);

describe('TurnEngine.apply — useItem (T-63)', () => {
  // ── Heal ─────────────────────────────────────────────────────────────────

  it('heals the player and spends 1 AP', () => {
    const result = TurnEngine.apply(baseState(), use('vein_serum'), rng());
    expect(result.errors).toEqual([]);
    expect(result.state.player.hp).toBe(85); // 60 + 25
    expect(result.state.player.ap).toBe(2);
    expect(result.effects).toContainEqual({ type: 'healingApplied', targetId: 'player', amount: 25 });
  });

  it('clamps healing to maxHp and reports the actual amount healed', () => {
    const state = baseState({ player: { ...baseState().player, hp: 90 } });
    const result = TurnEngine.apply(state, use('vein_serum'), rng());
    expect(result.state.player.hp).toBe(100);
    expect(result.effects).toContainEqual({ type: 'healingApplied', targetId: 'player', amount: 10 });
  });

  it('consumes the item from inventory after use', () => {
    const result = TurnEngine.apply(baseState(), use('vein_serum'), rng());
    expect(result.state.player.items).toEqual([]);
  });

  it('consumes only one instance when duplicates are held', () => {
    const state = baseState({ player: { ...baseState().player, items: [veinSerum, veinSerum] } });
    const result = TurnEngine.apply(state, use('vein_serum'), rng());
    expect(result.state.player.items).toEqual([veinSerum]);
  });

  it('emits itemUsed first', () => {
    const result = TurnEngine.apply(baseState(), use('vein_serum'), rng());
    expect(result.effects[0]).toEqual({ type: 'itemUsed', itemId: 'vein_serum' });
  });

  // ── Damage grenades ────────────────────────────────────────────────────────

  it('deals AoE true damage to every living enemy in radius', () => {
    const state = baseState({
      player: { ...baseState().player, items: [nullGrenade] },
      enemies: [
        enemy('e1', { x: 3, y: 3 }),
        enemy('e2', { x: 4, y: 3 }),
        enemy('e3', { x: 6, y: 6 }),
      ],
    });
    const result = TurnEngine.apply(state, use('null_grenade', { targetPos: { x: 3, y: 3 } }), rng());
    // 30 true damage ignores RES. e1 & e2 in radius 1, e3 out.
    expect(result.state.enemies[0]?.hp).toBe(0);
    expect(result.state.enemies[1]?.hp).toBe(0);
    expect(result.state.enemies[2]?.hp).toBe(30);
    expect(result.effects).toContainEqual({ type: 'entityDied', entityId: 'e1' });
    expect(result.effects).toContainEqual({ type: 'entityDied', entityId: 'e2' });
  });

  it('physical grenade damage is mitigated by RES', () => {
    const state = baseState({ player: { ...baseState().player, items: [physGrenade] } });
    const result = TurnEngine.apply(state, use('phys_grenade', { targetPos: { x: 3, y: 2 } }), rng());
    // 30 - RES 3 = 27. Enemy 30 → 3.
    expect(result.state.enemies[0]?.hp).toBe(3);
    expect(result.effects).toContainEqual({ type: 'damageDealt', targetId: 'e1', amount: 27, isCrit: false, damageType: 'physical' });
  });

  // ── Status grenades ──────────────────────────────────────────────────────────

  it('applies a status to every living enemy in radius', () => {
    const state = baseState({
      player: { ...baseState().player, items: [sporeBomb] },
      enemies: [enemy('e1', { x: 3, y: 3 }), enemy('e2', { x: 4, y: 4 })],
    });
    const result = TurnEngine.apply(state, use('spore_bomb', { targetPos: { x: 3, y: 3 } }), rng());
    expect(result.state.enemies[0]?.statuses).toContainEqual({ effect: 'infected', turnsRemaining: 4 });
    expect(result.state.enemies[1]?.statuses).toContainEqual({ effect: 'infected', turnsRemaining: 4 });
    expect(result.effects.filter((e) => e.type === 'statusApplied')).toHaveLength(2);
  });

  // ── Validation ───────────────────────────────────────────────────────────────

  it('rejects an item not in inventory', () => {
    const result = TurnEngine.apply(baseState(), use('ghost_item'), rng());
    expect(result.errors[0]?.code).toBe('ITEM_NOT_FOUND');
    expect(result.state.player.items).toEqual([veinSerum]);
  });

  it('rejects using a non-consumable (passive) item', () => {
    const state = baseState({ player: { ...baseState().player, items: [depthGauge] } });
    const result = TurnEngine.apply(state, use('depth_gauge'), rng());
    expect(result.errors[0]?.code).toBe('ITEM_NOT_CONSUMABLE');
  });

  it('rejects a grenade with no target tile', () => {
    const state = baseState({ player: { ...baseState().player, items: [nullGrenade] } });
    const result = TurnEngine.apply(state, use('null_grenade'), rng());
    expect(result.errors[0]?.code).toBe('INVALID_TARGET');
  });

  it('rejects a grenade targeting a tile outside the grid', () => {
    const state = baseState({ player: { ...baseState().player, items: [nullGrenade] } });
    const result = TurnEngine.apply(state, use('null_grenade', { targetPos: { x: 9, y: 9 } }), rng());
    expect(result.errors[0]?.code).toBe('OUT_OF_RANGE');
  });

  it('rejects item use with insufficient AP', () => {
    const state = baseState({ player: { ...baseState().player, ap: 0 } });
    const result = TurnEngine.apply(state, use('vein_serum'), rng());
    expect(result.errors[0]?.code).toBe('INSUFFICIENT_AP');
  });

  it('rejects item use outside the player phase', () => {
    const state = baseState({ phase: 'enemy' });
    const result = TurnEngine.apply(state, use('vein_serum'), rng());
    expect(result.errors[0]?.code).toBe('INVALID_PHASE');
  });

  it('does not consume the item or AP when validation fails', () => {
    const state = baseState({ player: { ...baseState().player, ap: 0 } });
    const result = TurnEngine.apply(state, use('vein_serum'), rng());
    expect(result.state).toBe(state);
  });

  // ── Purity & determinism ─────────────────────────────────────────────────────

  it('is pure — does not mutate the input state', () => {
    const state = baseState();
    const snapshot = structuredClone(state);
    TurnEngine.apply(state, use('vein_serum'), rng());
    expect(state).toEqual(snapshot);
  });

  it('is deterministic and consumes no RNG', () => {
    const a = TurnEngine.apply(baseState(), use('vein_serum'), new Mulberry32(7));
    const b = TurnEngine.apply(baseState(), use('vein_serum'), new Mulberry32(999));
    expect(a.state).toEqual(b.state);
    expect(a.effects).toEqual(b.effects);
  });
});
