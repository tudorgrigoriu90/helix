import type { Position } from '@shared-types/action';
import type { EnemyState, RunState } from '@shared-types/run-state';
import { chebyshev, inBounds, tileAt } from '../core/turn-engine/grid';

/**
 * Pure threat-range helpers for the combat threat/reach overlay (T-159, S047
 * "planning combat" — GDD §6.2 / §6.2.1).
 *
 * Baseline enemies are melee decide-and-act chasers with a reach of 1 (see
 * `enemy-phase.ts`), so a tile is "threatened" when a living enemy stands within
 * Chebyshev reach of it. The overlay surfaces those tiles so the player can
 * reason about where it is safe to stand before committing a move — the legible
 * threat ranges that replace per-enemy telegraph icons for non-boss enemies.
 *
 * Kept Phaser-free so it can be unit-tested without a scene. All functions are
 * pure; no canvas, no global state.
 */

/** Melee reach of baseline enemies (mirrors `ENEMY_MELEE_RANGE` in enemy-phase.ts). */
export const ENEMY_REACH = 1;

/** Stable "x,y" key for a grid position, for Set membership. */
export const posKey = (p: Position): string => `${p.x},${p.y}`;

/**
 * Every tile a living enemy could strike this turn without moving: all in-bounds,
 * non-wall tiles within {@link ENEMY_REACH} of any living enemy, excluding the
 * tiles the enemies themselves occupy. Returns a Set of {@link posKey} strings.
 */
export function threatenedTiles(state: RunState, reach: number = ENEMY_REACH): ReadonlySet<string> {
  const threatened = new Set<string>();
  const occupied = new Set<string>();
  for (const e of state.enemies) {
    if (e.hp > 0) occupied.add(posKey(e.pos));
  }
  for (const e of state.enemies) {
    if (e.hp <= 0) continue;
    for (let dy = -reach; dy <= reach; dy++) {
      for (let dx = -reach; dx <= reach; dx++) {
        if (dx === 0 && dy === 0) continue;
        const t: Position = { x: e.pos.x + dx, y: e.pos.y + dy };
        if (!inBounds(state.grid, t)) continue;
        if (tileAt(state.grid, t) === 'wall') continue;
        const key = posKey(t);
        if (occupied.has(key)) continue; // an enemy stands here; not a step-into threat tile
        threatened.add(key);
      }
    }
  }
  return threatened;
}

/** True when `enemy` can strike the player from where it currently stands. */
export function enemyInReach(enemy: EnemyState, playerPos: Position, reach: number = ENEMY_REACH): boolean {
  return enemy.hp > 0 && chebyshev(enemy.pos, playerPos) <= reach;
}
