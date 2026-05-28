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
  DamageType,
  DeathCause,
  ActiveStatus,
  EntityStats,
  PlayerState,
  EnemyState,
  Telegraph,
  TurnPhase,
  TileType,
  GridState,
  RunState,
} from './run-state.js';

export type {
  AbilityTargetType,
  AbilityDef,
  AbilitySlot,
} from './ability.js';

export type {
  ItemCategory,
  ItemEffect,
  ItemDef,
} from './item.js';

export type {
  RoomType,
  Zone,
  ConnectivityRule,
  RoomTypeWeights,
  RoomTypeMinima,
  RoomCountRange,
  FloorTemplate,
} from './floor-template.js';

export {
  ROOM_WEIGHTS_TOLERANCE,
  CURRENT_FLOOR_TEMPLATE_SCHEMA_VERSION,
} from './floor-template.js';
