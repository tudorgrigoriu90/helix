import type {
  Action,
  MoveAction,
  AttackAction,
  UseAbilityAction,
  UseItemAction,
  WaitAction,
  EndTurnAction,
  SurrenderAction,
} from '@shared-types/action';
import type { RunState } from '@shared-types/run-state';
import type { Mulberry32 } from '../rng/mulberry32';
import type { Effect } from './effect';
import type { TurnError } from './turn-error';

export interface TurnResult {
  readonly state: RunState;
  readonly effects: readonly Effect[];
  readonly errors: readonly TurnError[];
}

function ok(state: RunState, effects: readonly Effect[] = []): TurnResult {
  return { state, effects, errors: [] };
}

function err(state: RunState, code: TurnError['code'], message: string): TurnResult {
  return { state, effects: [], errors: [{ code, message }] };
}

function applyMove(
  state: RunState,
  _action: MoveAction,
  _rng: Mulberry32,
): TurnResult {
  if (state.phase !== 'player') return err(state, 'INVALID_PHASE', 'move requires player phase');
  return ok(state);
}

function applyAttack(
  state: RunState,
  _action: AttackAction,
  _rng: Mulberry32,
): TurnResult {
  if (state.phase !== 'player') return err(state, 'INVALID_PHASE', 'attack requires player phase');
  return ok(state);
}

function applyUseAbility(
  state: RunState,
  _action: UseAbilityAction,
  _rng: Mulberry32,
): TurnResult {
  if (state.phase !== 'player') return err(state, 'INVALID_PHASE', 'useAbility requires player phase');
  return ok(state);
}

function applyUseItem(
  state: RunState,
  _action: UseItemAction,
  _rng: Mulberry32,
): TurnResult {
  if (state.phase !== 'player') return err(state, 'INVALID_PHASE', 'useItem requires player phase');
  return ok(state);
}

function applyWait(
  state: RunState,
  _action: WaitAction,
  _rng: Mulberry32,
): TurnResult {
  if (state.phase !== 'player') return err(state, 'INVALID_PHASE', 'wait requires player phase');
  return ok(state);
}

function applyEndTurn(
  state: RunState,
  _action: EndTurnAction,
  _rng: Mulberry32,
): TurnResult {
  if (state.phase !== 'player') return err(state, 'INVALID_PHASE', 'endTurn requires player phase');
  return ok(state);
}

function applySurrender(
  state: RunState,
  _action: SurrenderAction,
  _rng: Mulberry32,
): TurnResult {
  if (state.phase === 'defeat') return err(state, 'ALREADY_SURRENDERED', 'already in defeat phase');
  return ok(state);
}

export const TurnEngine = {
  apply(state: RunState, action: Action, rng: Mulberry32): TurnResult {
    switch (action.type) {
      case 'move':       return applyMove(state, action, rng);
      case 'attack':     return applyAttack(state, action, rng);
      case 'useAbility': return applyUseAbility(state, action, rng);
      case 'useItem':    return applyUseItem(state, action, rng);
      case 'wait':       return applyWait(state, action, rng);
      case 'endTurn':    return applyEndTurn(state, action, rng);
      case 'surrender':  return applySurrender(state, action, rng);
    }
  },
};
