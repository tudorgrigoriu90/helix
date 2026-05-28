import type { DeathCause, RunState } from '@shared-types/run-state';
import type { Effect } from './effect';

/** Floor 20 is the Convergence — clearing it is a run victory (GDD §2.8 / §7.1). */
const FINAL_FLOOR = 20;

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
    if (state.floorNumber >= FINAL_FLOOR) {
      return { state: { ...state, phase: 'victory' }, effects: [{ type: 'victory' }] };
    }
    return { state: { ...state, phase: 'floor_complete' }, effects: [{ type: 'floorComplete' }] };
  }

  return { state, effects: [] };
}
