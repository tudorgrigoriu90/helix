// Strand Descent — shared types between game client and Cloud Functions.
// See TDD §3 and §5.2 for the architecture rationale.
export type {
  Position,
  Action,
  ActionType,
  MoveAction,
  AttackAction,
  UseAbilityAction,
  UseItemAction,
  WaitAction,
  EndTurnAction,
  SurrenderAction,
} from './action.js';

export type {
  StatusEffect,
  ActiveStatus,
  EntityStats,
  PlayerState,
  EnemyState,
  TurnPhase,
  TileType,
  GridState,
  RunState,
} from './run-state.js';
