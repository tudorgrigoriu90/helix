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
export function resolveEnemyPhase(state: RunState, _rng: Mulberry32): EnemyPhaseResult {
  const order = state.enemies
    .filter((e) => e.hp > 0)
    .slice()
    .sort((a, b) => b.stats.agi - a.stats.agi || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
    .map((e) => e.id);

  // Attack slots (player-adjacent tiles) claimed earlier in this phase, so a
  // pack spreads out to encircle the player rather than every enemy homing on
  // the same tile and stacking into a single-file queue behind the leader.
  const claimed = new Set<string>();

  let working = state;
  const effects: Effect[] = [];
  for (const id of order) {
    const res = resolveEnemyAction(working, id, claimed);
    working = res.state;
    effects.push(...res.effects);
  }
  return { state: working, effects };
}

function resolveEnemyAction(state: RunState, enemyId: string, claimed: Set<string>): EnemyPhaseResult {
  const enemy = state.enemies.find((e) => e.id === enemyId);
  // Defensive guard: the calling loop only enumerates living enemies, so
  // `enemy === undefined` is theoretically unreachable today. Kept because a
  // future enemy-chain effect (counter-damage, AoE that kills sibling enemies)
  // could remove an entry between iterations. Branch intentionally uncovered.
  if (enemy === undefined || enemy.hp <= 0) return { state, effects: [] };

  // Baseline chase AI, decided against the current board: strike if in melee
  // reach, otherwise advance toward an open flanking position.
  if (chebyshev(enemy.pos, state.player.pos) <= ENEMY_MELEE_RANGE) {
    return enemyAttack(state, enemy, enemy.stats.str);
  }
  return enemyAdvance(state, enemy, claimed);
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

const tileKey = (p: Position): string => `${p.x},${p.y}`;

/** True when `p` is a tile a living enemy other than `selfId` currently stands on. */
function occupiedByOther(state: RunState, p: Position, selfId: string): boolean {
  return state.enemies.some((e) => e.id !== selfId && e.hp > 0 && e.pos.x === p.x && e.pos.y === p.y);
}

/**
 * Reserves the open player-adjacent tile nearest to this enemy (Chebyshev,
 * orthogonal-first tie-break) as its attack slot, skipping walls, tiles held by
 * other living enemies, and slots already claimed by earlier movers this phase.
 * Returns null when every slot is taken (the player is fully surrounded), in
 * which case the caller falls back to pressing straight in.
 */
function reserveAttackSlot(state: RunState, enemy: EnemyState, claimed: Set<string>): Position | null {
  let best: Position | null = null;
  let bestDist = Infinity;
  for (const [dx, dy] of STEP_DIRS) {
    const slot: Position = { x: state.player.pos.x + dx, y: state.player.pos.y + dy };
    if (!inBounds(state.grid, slot) || tileAt(state.grid, slot) === 'wall') continue;
    if (claimed.has(tileKey(slot))) continue;
    if (occupiedByOther(state, slot, enemy.id)) continue;
    const d = chebyshev(slot, enemy.pos);
    if (d < bestDist) { bestDist = d; best = slot; } // first dir wins ties (ortho preferred)
  }
  return best;
}

/**
 * Steps one tile toward a flanking position. Each enemy heads for its own open
 * slot around the player (reserved via {@link reserveAttackSlot}) instead of the
 * player's exact tile, so a pack fans out and surrounds rather than funnelling
 * into a queue. Falls back to the player's tile as the goal when no slot is free.
 */
function enemyAdvance(state: RunState, enemy: EnemyState, claimed: Set<string>): EnemyPhaseResult {
  if (isImmobilized(enemy)) return { state, effects: [] };

  const slot = reserveAttackSlot(state, enemy, claimed);
  const goal: Position = slot ?? state.player.pos;
  if (slot !== null) claimed.add(tileKey(slot));

  // Pick the free adjacent tile that gets closest to the chosen goal. Ties on
  // step-count (Chebyshev) break toward the tile that also closes the lateral
  // (Manhattan) gap, so an enemy heading for an off-axis slot peels sideways
  // toward its own flank instead of marching down the centre lane in a queue.
  const cur = chebyshev(enemy.pos, goal);
  let to: Position | null = null;
  let bestDist = Infinity;
  let bestManhattan = Infinity;
  for (const [dx, dy] of STEP_DIRS) {
    const cand: Position = { x: enemy.pos.x + dx, y: enemy.pos.y + dy };
    if (!inBounds(state.grid, cand) || tileAt(state.grid, cand) === 'wall') continue;
    if (cand.x === state.player.pos.x && cand.y === state.player.pos.y) continue; // never onto the player
    if (occupiedByOther(state, cand, enemy.id)) continue;
    const d = chebyshev(cand, goal);
    const m = Math.abs(cand.x - goal.x) + Math.abs(cand.y - goal.y);
    if (d < bestDist || (d === bestDist && m < bestManhattan)) {
      bestDist = d; bestManhattan = m; to = cand; // first dir wins remaining ties (ortho preferred)
    }
  }
  // Only move if a free tile actually gets us closer to the goal; otherwise hold
  // position (boxed in — no step toward the slot is open this turn).
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
