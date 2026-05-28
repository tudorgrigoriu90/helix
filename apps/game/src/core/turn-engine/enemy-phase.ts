import type { EnemyState, RunState } from '@shared-types/run-state';
import type { Position } from '@shared-types/action';
import type { Mulberry32 } from '../rng/mulberry32';
import type { Effect } from './effect';
import { chebyshev, inBounds, tileAt } from './grid';
import { mitigate } from './combat';

const ENEMY_MELEE_RANGE = 1;

export interface EnemyPhaseResult {
  readonly state: RunState;
  readonly effects: readonly Effect[];
}

/**
 * Resolves the enemy phase: every living enemy acts once, in descending
 * initiative (AGI) order with id as a deterministic tie-break (TDD §5.3).
 *
 * Enemies decide-and-act at action time against the live board — there is no
 * pre-committed telegraph for baseline AI. A chaser attacks if the player is in
 * reach, otherwise steps toward them. This is planning combat (Heroes 3 / Fire
 * Emblem model), not reaction combat: the player reasons from the legible,
 * deterministic ruleset and threat ranges rather than from a previewed intent.
 *
 * Scripted wind-ups (boss charges, etc.) can still drive behaviour off the
 * `EnemyState.telegraph` seam once enemy-behaviour data lands; baseline AI
 * ignores it. Status ticking (T-65) and win/loss detection (T-66) are resolved
 * by their own steps in the turn flow.
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
  // Defensive guard: the calling loop only enumerates living enemies, so
  // `enemy === undefined` is theoretically unreachable today. Kept because a
  // future enemy-chain effect (counter-damage, AoE that kills sibling enemies)
  // could remove an entry between iterations. Branch intentionally uncovered.
  if (enemy === undefined || enemy.hp <= 0) return { state, effects: [] };

  // Baseline chase AI, decided against the current board: strike if in melee
  // reach, otherwise close the distance.
  if (chebyshev(enemy.pos, state.player.pos) <= ENEMY_MELEE_RANGE) {
    return enemyAttack(state, enemy, enemy.stats.str);
  }
  return enemyStepTowardPlayer(state, enemy);
}

function enemyAttack(state: RunState, enemy: EnemyState, rawDamage: number): EnemyPhaseResult {
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
  if (enemy.statuses.some((s) => s.effect === 'rooted')) return { state, effects: [] };

  const to: Position = {
    x: enemy.pos.x + Math.sign(state.player.pos.x - enemy.pos.x),
    y: enemy.pos.y + Math.sign(state.player.pos.y - enemy.pos.y),
  };
  // Defensive: if player and enemy share a tile (zero-distance step), abort.
  // Unreachable from a valid RunState since player/enemy tile collision is
  // forbidden upstream. Branch intentionally uncovered.
  if (to.x === enemy.pos.x && to.y === enemy.pos.y) return { state, effects: [] };
  if (!inBounds(state.grid, to) || tileAt(state.grid, to) === 'wall') return { state, effects: [] };
  // Defensive: never step onto the player's tile. Unreachable today because
  // the melee-range-1 check above redirects to enemyAttack before this path;
  // ranged enemies with reach > step distance would exercise it. Branch
  // intentionally uncovered until ranged AI lands.
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
