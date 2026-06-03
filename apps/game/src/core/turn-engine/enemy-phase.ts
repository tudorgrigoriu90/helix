import type { EnemyState, RunState } from '@shared-types/run-state';
import type { Position } from '@shared-types/action';
import type { Mulberry32 } from '../rng/mulberry32';
import type { Effect } from './effect';
import { chebyshev, inBounds, tileAt } from './grid';
import { damageTo, isImmobilized } from './effective-stats';
import { HAZARD_DAMAGE } from './combat';

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
  const dealt = damageTo(state.player, rawDamage, 'physical');
  const newHp = Math.max(0, state.player.hp - dealt);
  const effects: Effect[] = [
    { type: 'damageDealt', targetId: 'player', amount: dealt, isCrit: false, damageType: 'physical' },
  ];
  return {
    state: { ...state, player: { ...state.player, hp: newHp } },
    effects,
  };
}

/** 8-neighbour offsets, orthogonal first so a clear straight approach is
 *  preferred over a diagonal on ties (keeps simple chases looking direct). */
const STEP_DIRS: readonly (readonly [number, number])[] = [
  [0, -1], [0, 1], [-1, 0], [1, 0], [-1, -1], [-1, 1], [1, -1], [1, 1],
];

function enemyStepTowardPlayer(state: RunState, enemy: EnemyState): EnemyPhaseResult {
  if (isImmobilized(enemy)) return { state, effects: [] };

  // Pick the free adjacent tile that gets *closest* to the player, rather than
  // only the straight sign-step. When the tile directly toward the player is
  // taken by another enemy, this routes the enemy to an open flanking tile, so
  // a group encircles the player instead of queueing behind one another.
  const cur = chebyshev(enemy.pos, state.player.pos);
  let to: Position | null = null;
  let bestDist = Infinity;
  for (const [dx, dy] of STEP_DIRS) {
    const cand: Position = { x: enemy.pos.x + dx, y: enemy.pos.y + dy };
    if (!inBounds(state.grid, cand) || tileAt(state.grid, cand) === 'wall') continue;
    if (cand.x === state.player.pos.x && cand.y === state.player.pos.y) continue; // never onto the player
    if (state.enemies.some((e) => e.id !== enemy.id && e.hp > 0 && e.pos.x === cand.x && e.pos.y === cand.y)) continue;
    const d = chebyshev(cand, state.player.pos);
    if (d < bestDist) { bestDist = d; to = cand; } // first dir wins ties (ortho preferred)
  }
  // Only move if a free tile actually gets us closer; otherwise hold position
  // (blocked in — an ally is in the way and no flank is open this turn).
  if (to === null || bestDist >= cur) return { state, effects: [] };

  const from = enemy.pos;
  // Hazard tiles damage on entry (GDD §6.1) — enemies are not immune.
  const hazardDmg = tileAt(state.grid, to) === 'hazard' ? HAZARD_DAMAGE : 0;
  const newHp = Math.max(0, enemy.hp - hazardDmg);
  const nextEnemies = state.enemies.map((e) => (e.id === enemy.id ? { ...e, pos: to, hp: newHp } : e));
  const effects: Effect[] = [{ type: 'entityMoved', entityId: enemy.id, from, to }];
  if (hazardDmg > 0) {
    effects.push({ type: 'damageDealt', targetId: enemy.id, amount: hazardDmg, isCrit: false, damageType: 'true' });
    if (newHp === 0) effects.push({ type: 'entityDied', entityId: enemy.id });
  }
  return { state: { ...state, enemies: nextEnemies }, effects };
}
