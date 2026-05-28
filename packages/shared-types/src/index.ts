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
  ItemRarity,
  ItemEffect,
  ItemDef,
} from './item.js';

export { CURRENT_ITEM_SCHEMA_VERSION } from './item.js';

export type {
  EnemyTier,
  EnemyDef,
} from './enemy.js';

export { CURRENT_ENEMY_SCHEMA_VERSION } from './enemy.js';

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

export type {
  RoomNode,
  FloorEdge,
  FloorGraph,
} from './floor-graph.js';

export type {
  TypedRoom,
  EnemySpawn,
  PopulatedRoom,
  PopulatedFloor,
} from './floor-plan.js';
