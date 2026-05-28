import type { EnemyState, RunState } from '@shared-types/run-state';
import type { Position } from '@shared-types/action';
import type { Mulberry32 } from '../rng/mulberry32';
import type { Effect } from './effect';
import { chebyshev, inBounds, tileAt } from './grid';
import { mitigate } from './combat';

const ENEMY_MELEE_RANGE = 1;
const ENEMY_RANGED_RANGE = 5;
/** Ranged attacks deal less than melee (mirrors the player's STR×0.8). */
const RANGED_DAMAGE_MULT = 0.8;

export interface EnemyPhaseResult {
  readonly state: RunState;
  readonly effects: readonly Effect[];
}

/**
 * Resolves the enemy phase: every living enemy acts once, in descending
 * initiative (AGI) order with id as a deterministic tie-break, performing the
 * telegraph it set on the previous turn (GDD §6.2, TDD §5.3).
 *
 * Status ticking (T-65), win/loss detection (T-66) and next-turn telegraph
 * generation (T-67) are resolved by their own steps in the turn flow.
 */
export function resolveEnemyPhase(state: RunState, rng: Mulberry32): EnemyPhaseResult {
  const order = state.enemies
    .filter((e) => e.hp > 0)
    .slice()
    .sort((a, b) => b.stats.agi - a.stats.agi || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
    .map((e) => e.id);

  let working = state;
  const effects: Effect[] = [];
  for (const id of order) {
    const res = resolveEnemyAction(working, id, rng);
    working = res.state;
    effects.push(...res.effects);
  }
  return { state: working, effects };
}

function resolveEnemyAction(state: RunState, enemyId: string, _rng: Mulberry32): EnemyPhaseResult {
  const enemy = state.enemies.find((e) => e.id === enemyId);
  if (enemy === undefined || enemy.hp <= 0) return { state, effects: [] };

  switch (enemy.telegraph) {
    case 'melee':
      return enemyAttack(state, enemy, ENEMY_MELEE_RANGE, enemy.stats.str);
    case 'ranged':
      return enemyAttack(state, enemy, ENEMY_RANGED_RANGE, Math.floor(enemy.stats.str * RANGED_DAMAGE_MULT));
    case 'move':
      return enemyStepTowardPlayer(state, enemy);
    case 'defense':
    case 'special':
    case 'idle':
    case null:
      // Defense stance and enemy special abilities are not modeled yet; idle/no
      // telegraph are no-ops.
      return { state, effects: [] };
  }
}

function enemyAttack(state: RunState, enemy: EnemyState, range: number, rawDamage: number): EnemyPhaseResult {
  if (chebyshev(enemy.pos, state.player.pos) > range) {
    // Player moved out of reach — the telegraphed attack fizzles.
    return { state, effects: [] };
  }
  const dealt = mitigate(rawDamage, state.player.stats.res, 'physical');
  const newHp = Math.max(0, state.player.hp - dealt);
  const effects: Effect[] = [
    { type: 'damageDealt', targetId: 'player', amount: dealt, isCrit: false, damageType: 'physical' },
  ];
  return {
    state: { ...state, player: { ...state.player, hp: newHp } },
    effects,
  };
}

function enemyStepTowardPlayer(state: RunState, enemy: EnemyState): EnemyPhaseResult {
  const to: Position = {
    x: enemy.pos.x + Math.sign(state.player.pos.x - enemy.pos.x),
    y: enemy.pos.y + Math.sign(state.player.pos.y - enemy.pos.y),
  };
  if (to.x === enemy.pos.x && to.y === enemy.pos.y) return { state, effects: [] };
  if (!inBounds(state.grid, to) || tileAt(state.grid, to) === 'wall') return { state, effects: [] };
  if (to.x === state.player.pos.x && to.y === state.player.pos.y) return { state, effects: [] };
  const occupied = state.enemies.some((e) => e.id !== enemy.id && e.hp > 0 && e.pos.x === to.x && e.pos.y === to.y);
  if (occupied) return { state, effects: [] };

  const from = enemy.pos;
  const nextEnemies = state.enemies.map((e) => (e.id === enemy.id ? { ...e, pos: to } : e));
  return {
    state: { ...state, enemies: nextEnemies },
    effects: [{ type: 'entityMoved', entityId: enemy.id, from, to }],
  };
}
