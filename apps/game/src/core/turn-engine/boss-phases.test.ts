import { describe, it, expect } from 'vitest';
import type { EnemyState, RunState, PlayerState, GridState } from '@shared-types/run-state';
import { Mulberry32 } from '../rng/mulberry32';
import {
  bossPhaseOf,
  bossAttackProfile,
  withBossPhaseRes,
  FLOOR_BOSS_PHASE2_AT,
  WARDEN_PHASE2_AT,
  WARDEN_PHASE3_AT,
} from './boss-phases';
import { resolveEnemyPhase } from './enemy-phase';

/**
 * T-503 — boss phase system (DR-008, GDD §8.2/§8.4).
 * Profiles per Warden + the generic Floor Boss template, and the enemy-phase
 * integration (strikes, status infliction, regrowth, stoneplate).
 */

function enemy(over: Partial<EnemyState>): EnemyState {
  return {
    id: 'b#0', enemyDefId: 'the_convergence', pos: { x: 1, y: 0 },
    hp: 100, maxHp: 100,
    stats: { str: 20, res: 10, agi: 5, int: 5 },
    statuses: [], telegraph: null, tier: 'zone_warden', aware: true,
    ...over,
  };
}

function grid(): GridState {
  return { width: 5, height: 5, tiles: Array.from({ length: 25 }, () => 'open' as const) };
}

function player(over: Partial<PlayerState> = {}): PlayerState {
  return {
    pos: { x: 0, y: 0 }, hp: 200, maxHp: 200, ap: 3, maxAp: 3,
    stats: { str: 10, res: 5, agi: 10, int: 10 },
    statuses: [], abilities: [], items: [], mutations: [], dominantTraits: [],
    ...over,
  } as PlayerState;
}

function combatState(e: EnemyState, p: PlayerState = player()): RunState {
  return {
    schemaVersion: 1, seed: 1, floorNumber: 20, turn: 1, phase: 'enemy',
    grid: grid(), player: p, enemies: [e],
  };
}

describe('bossPhaseOf — thresholds (T-503)', () => {
  it('Wardens phase at 66% / 33%; Floor Bosses at 50%; others never', () => {
    const w = (hp: number): number => bossPhaseOf(enemy({ hp }));
    expect(w(100)).toBe(1);
    expect(w(Math.ceil(100 * WARDEN_PHASE2_AT) + 1)).toBe(1);
    expect(w(66)).toBe(2);
    expect(w(Math.ceil(100 * WARDEN_PHASE3_AT) + 1)).toBe(2);
    expect(w(33)).toBe(3);
    expect(w(1)).toBe(3);

    const fb = (hp: number): number =>
      bossPhaseOf(enemy({ enemyDefId: 'the_quarrylord', tier: 'floor_boss', hp }));
    expect(fb(100)).toBe(1);
    expect(fb(100 * FLOOR_BOSS_PHASE2_AT)).toBe(2);

    expect(bossPhaseOf(enemy({ enemyDefId: 'filterer', tier: 'grunt', hp: 1 }))).toBe(1);
  });

  it('falls back to the warden id for pre-T-503 combat saves with no tier', () => {
    expect(bossPhaseOf(enemy({ tier: undefined, hp: 30 }))).toBe(3);
  });
});

describe('bossAttackProfile — bespoke Warden patterns (T-503)', () => {
  it('Leviathan Hatchling: +20% STR, then suppressing strikes', () => {
    const id = 'leviathan_hatchling';
    expect(bossAttackProfile(enemy({ enemyDefId: id, hp: 60 }))).toMatchObject({ strMult: 1.2, strikes: 1 });
    expect(bossAttackProfile(enemy({ enemyDefId: id, hp: 20 }))).toMatchObject({
      strMult: 1.2, inflicts: { status: 'suppressed', turns: 1 },
    });
  });

  it('The Great Mycelium: infecting strikes, then 5% regrowth', () => {
    const id = 'the_great_mycelium';
    expect(bossAttackProfile(enemy({ enemyDefId: id, hp: 60 }))).toMatchObject({
      inflicts: { status: 'infected', turns: 2 },
    });
    expect(bossAttackProfile(enemy({ enemyDefId: id, hp: 20 }))).toMatchObject({
      selfHealFraction: 0.05,
    });
  });

  it("The Mountain's Heart: stoneplate (+4 RES), then sheds it for +40% STR", () => {
    const id = 'the_mountains_heart';
    expect(bossAttackProfile(enemy({ enemyDefId: id, hp: 60 }))).toMatchObject({ resBonus: 4, telegraph: 'defense' });
    expect(bossAttackProfile(enemy({ enemyDefId: id, hp: 20 }))).toMatchObject({ strMult: 1.4 });
    // The RES wrapper applies only while the plate holds.
    expect(withBossPhaseRes(enemy({ enemyDefId: id, hp: 60 })).stats.res).toBe(14);
    expect(withBossPhaseRes(enemy({ enemyDefId: id, hp: 20 })).stats.res).toBe(10);
  });

  it('The Convergence: +15% STR, then strikes twice', () => {
    const id = 'the_convergence';
    expect(bossAttackProfile(enemy({ enemyDefId: id, hp: 60 }))).toMatchObject({ strMult: 1.15, strikes: 1 });
    expect(bossAttackProfile(enemy({ enemyDefId: id, hp: 20 }))).toMatchObject({ strMult: 1, strikes: 2 });
  });

  it('Floor Bosses enrage generically below half: +25% STR, no bespoke extras', () => {
    const fb = enemy({ enemyDefId: 'the_quarrylord', tier: 'floor_boss', hp: 40 });
    expect(bossAttackProfile(fb)).toMatchObject({ strMult: 1.25, strikes: 1 });
    expect(bossAttackProfile(fb).inflicts).toBeUndefined();
  });
});

describe('enemy phase integration — phases act on the board (T-503)', () => {
  it('a phase-3 Convergence strikes twice in one action', () => {
    const e = enemy({ enemyDefId: 'the_convergence', hp: 20 });
    const before = combatState(e);
    const { state } = resolveEnemyPhase(before, new Mulberry32(1));
    const perHit = Math.max(1, 20 - 5); // base STR − player res (mult drops to 1 with the double strike)
    expect(before.player.hp - state.player.hp).toBe(perHit * 2);
  });

  it('a phase-3 Hatchling suppresses the player exactly once', () => {
    const e = enemy({ enemyDefId: 'leviathan_hatchling', hp: 20 });
    const { state } = resolveEnemyPhase(combatState(e), new Mulberry32(1));
    expect(state.player.statuses.filter((s) => s.effect === 'suppressed')).toHaveLength(1);
    // A second phase never stacks a duplicate.
    const again = resolveEnemyPhase({ ...state, phase: 'enemy' }, new Mulberry32(2));
    expect(again.state.player.statuses.filter((s) => s.effect === 'suppressed')).toHaveLength(1);
  });

  it('a phase-3 Mycelium regrows 5% max HP before acting', () => {
    const e = enemy({ enemyDefId: 'the_great_mycelium', hp: 20, maxHp: 100 });
    const { state, effects } = resolveEnemyPhase(combatState(e), new Mulberry32(1));
    expect(state.enemies[0]!.hp).toBe(25);
    expect(effects.some((fx) => fx.type === 'healingApplied' && fx.targetId === 'b#0')).toBe(true);
  });

  it('surfaces the phase tell on the telegraph channel', () => {
    const e = enemy({ enemyDefId: 'the_mountains_heart', hp: 60 });
    const { state, effects } = resolveEnemyPhase(combatState(e), new Mulberry32(1));
    expect(state.enemies[0]!.telegraph).toBe('defense');
    expect(effects.some((fx) => fx.type === 'telegraphUpdated')).toBe(true);
  });

  it('phase 1 is the unchanged baseline (no tell, single plain strike)', () => {
    const e = enemy({ enemyDefId: 'the_convergence', hp: 100 });
    const before = combatState(e);
    const { state } = resolveEnemyPhase(before, new Mulberry32(1));
    expect(state.enemies[0]!.telegraph).toBeNull();
    expect(before.player.hp - state.player.hp).toBe(Math.max(1, 20 - 5));
  });
});
