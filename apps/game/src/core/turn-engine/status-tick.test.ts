import { describe, it, expect } from 'vitest';
import type {
  ActiveStatus,
  EnemyState,
  EntityStats,
  GridState,
  RunState,
  TileType,
} from '@shared-types/run-state';
import { tickStatuses } from './status-tick';

const STATS: EntityStats = { str: 10, res: 10, agi: 10, int: 10 };

function grid(): GridState {
  return { width: 7, height: 7, tiles: new Array<TileType>(49).fill('open') };
}

function enemy(id: string, statuses: ActiveStatus[], hp = 30): EnemyState {
  return {
    id, enemyDefId: 'e', pos: { x: 0, y: 0 }, hp, maxHp: 30,
    stats: { str: 8, res: 3, agi: 8, int: 5 }, statuses, telegraph: null,
  };
}

function state(over: Partial<RunState> = {}): RunState {
  return {
    schemaVersion: 1, seed: 1, floorNumber: 1, phase: 'enemy', turn: 1, grid: grid(),
    player: {
      id: 'player', pos: { x: 3, y: 3 }, hp: 100, maxHp: 100, ap: 3, maxAp: 3,
      stats: STATS, statuses: [], abilities: [], items: [], mutations: [],
    },
    enemies: [],
    ...over,
  };
}

const burn = (t = 3): ActiveStatus => ({ effect: 'burn', turnsRemaining: t });

describe('tickStatuses — T-65', () => {
  it('applies Burn damage (5/turn) to the player', () => {
    const result = tickStatuses(state({ player: { ...state().player, statuses: [burn()] } }));
    expect(result.state.player.hp).toBe(95);
    expect(result.effects).toContainEqual({ type: 'damageDealt', targetId: 'player', amount: 5, isCrit: false, damageType: 'thermal' });
  });

  it('Burn stacks — two stacks deal 10', () => {
    const result = tickStatuses(state({ player: { ...state().player, statuses: [burn(), burn()] } }));
    expect(result.state.player.hp).toBe(90);
  });

  it('Overheated deals 8/turn', () => {
    const s = state({ player: { ...state().player, statuses: [{ effect: 'overheated', turnsRemaining: 2 }] } });
    expect(tickStatuses(s).state.player.hp).toBe(92);
  });

  it('Regenerating heals 5/turn, clamped to maxHp', () => {
    const s = state({ player: { ...state().player, hp: 98, statuses: [{ effect: 'regenerating', turnsRemaining: 3 }] } });
    const result = tickStatuses(s);
    expect(result.state.player.hp).toBe(100);
    expect(result.effects).toContainEqual({ type: 'healingApplied', targetId: 'player', amount: 2 });
  });

  it('decrements timers and keeps statuses that have turns left', () => {
    const result = tickStatuses(state({ player: { ...state().player, statuses: [burn(3)] } }));
    expect(result.state.player.statuses).toEqual([{ effect: 'burn', turnsRemaining: 2 }]);
  });

  it('expires statuses at zero and emits statusExpired', () => {
    const result = tickStatuses(state({ player: { ...state().player, statuses: [burn(1)] } }));
    expect(result.state.player.statuses).toEqual([]);
    expect(result.effects).toContainEqual({ type: 'statusExpired', targetId: 'player', status: 'burn' });
  });

  it('ticks enemy statuses and emits entityDied when Burn is lethal', () => {
    const result = tickStatuses(state({ enemies: [enemy('e1', [burn()], 3)] }));
    expect(result.state.enemies[0]?.hp).toBe(0);
    expect(result.effects).toContainEqual({ type: 'entityDied', entityId: 'e1' });
  });

  it('does not tick dead enemies', () => {
    const result = tickStatuses(state({ enemies: [enemy('e1', [burn()], 0)] }));
    expect(result.effects).toEqual([]);
  });

  it('ticks player and enemies in the same pass', () => {
    const s = state({
      player: { ...state().player, statuses: [burn()] },
      enemies: [enemy('e1', [burn()])],
    });
    const result = tickStatuses(s);
    expect(result.state.player.hp).toBe(95);
    expect(result.state.enemies[0]?.hp).toBe(25);
  });

  it('is a no-op when nothing has statuses', () => {
    const s = state({ enemies: [enemy('e1', [])] });
    const result = tickStatuses(s);
    expect(result.effects).toEqual([]);
    expect(result.state).toEqual(s);
  });

  it('is pure — does not mutate input', () => {
    const s = state({ player: { ...state().player, statuses: [burn()] } });
    const snapshot = structuredClone(s);
    tickStatuses(s);
    expect(s).toEqual(snapshot);
  });
});
