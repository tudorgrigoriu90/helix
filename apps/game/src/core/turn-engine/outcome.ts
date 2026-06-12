import type { DeathCause, RunState } from '@shared-types/run-state';
import { MAX_FLOOR } from '@shared-types/campaign';
import type { Effect } from './effect';

export interface OutcomeResult {
  readonly state: RunState;
  readonly effects: readonly Effect[];
}

/**
 * Detects run/floor outcomes and transitions phase accordingly (TDD §5.3):
 * player HP 0 → defeat; all enemies dead → floor_complete (or victory on the
 * final floor). Idempotent — once a terminal phase is set it is left untouched,
 * so this is safe to call after every action.
 */
export function detectOutcome(state: RunState, cause: DeathCause = 'enemy_kill'): OutcomeResult {
  if (state.phase === 'defeat' || state.phase === 'victory' || state.phase === 'floor_complete') {
    return { state, effects: [] };
  }

  if (state.player.hp <= 0) {
    return { state: { ...state, phase: 'defeat' }, effects: [{ type: 'defeat', cause }] };
  }

  if (state.enemies.length > 0 && state.enemies.every((e) => e.hp <= 0)) {
    if (state.floorNumber >= MAX_FLOOR) {
      return { state: { ...state, phase: 'victory' }, effects: [{ type: 'victory' }] };
    }
    return { state: { ...state, phase: 'floor_complete' }, effects: [{ type: 'floorComplete' }] };
  }

  return { state, effects: [] };
}
