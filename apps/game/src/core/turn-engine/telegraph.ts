import type { RunState, Telegraph } from '@shared-types/run-state';
import type { Effect } from './effect';
import { chebyshev } from './grid';

export interface TelegraphResult {
  readonly state: RunState;
  readonly effects: readonly Effect[];
}

/**
 * Generates each living enemy's telegraph for the upcoming enemy phase
 * (GDD §6.2). Baseline chase AI: melee when adjacent to the player, otherwise
 * move toward them. Per-archetype intent (ranged / defense / special) arrives
 * with enemy behaviour data and smarter AI.
 */
export function generateTelegraphs(state: RunState): TelegraphResult {
  const effects: Effect[] = [];
  const enemies = state.enemies.map((e) => {
    if (e.hp <= 0) return e;
    const next: Telegraph = chebyshev(e.pos, state.player.pos) <= 1 ? 'melee' : 'move';
    if (next !== e.telegraph) {
      effects.push({ type: 'telegraphUpdated', enemyId: e.id, telegraph: next });
    }
    return { ...e, telegraph: next };
  });
  return { state: { ...state, enemies }, effects };
}
