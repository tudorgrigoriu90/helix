import type { Position } from './action.js';
import type { AbilitySlot } from './ability.js';
import type { ItemDef } from './item.js';

export type StatusEffect =
  | 'burn'
  | 'infected'
  | 'stagger'
  | 'suppressed'
  | 'fractured'
  | 'crushed'
  | 'rooted'
  | 'phased'
  | 'regenerating'
  | 'overheated';

export type DamageType =
  | 'physical'
  | 'thermal'
  | 'void'
  | 'spore'
  | 'seismic'
  | 'pressure'
  | 'true';

export interface ActiveStatus {
  readonly effect: StatusEffect;
  readonly turnsRemaining: number;
}

export interface EntityStats {
  readonly str: number;
  readonly res: number;
  readonly agi: number;
  readonly int: number;
}

export interface PlayerState {
  readonly id: 'player';
  readonly pos: Position;
  readonly hp: number;
  readonly maxHp: number;
  readonly ap: number;
  readonly maxAp: number;
  readonly stats: EntityStats;
  readonly statuses: readonly ActiveStatus[];
  readonly abilities: readonly AbilitySlot[];
  readonly items: readonly ItemDef[];
  readonly mutations: readonly string[];
}

export interface EnemyState {
  readonly id: string;
  readonly enemyDefId: string;
  readonly pos: Position;
  readonly hp: number;
  readonly maxHp: number;
  readonly stats: EntityStats;
  readonly statuses: readonly ActiveStatus[];
  readonly telegraph: string | null;
}

export type TurnPhase =
  | 'player'
  | 'enemy'
  | 'floor_complete'
  | 'victory'
  | 'defeat';

export type TileType =
  | 'open'
  | 'wall'
  | 'hazard'
  | 'cover'
  | 'elevated'
  | 'corruption';

export interface GridState {
  readonly width: number;
  readonly height: number;
  /** Row-major tile array; length === width * height. Index = y * width + x. */
  readonly tiles: readonly TileType[];
}

export interface RunState {
  readonly schemaVersion: number;
  readonly seed: number;
  readonly floorNumber: number;
  readonly phase: TurnPhase;
  readonly turn: number;
  readonly grid: GridState;
  readonly player: PlayerState;
  readonly enemies: readonly EnemyState[];
}
