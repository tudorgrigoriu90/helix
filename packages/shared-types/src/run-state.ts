import type { Position } from './action.js';

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
  readonly abilities: readonly string[];
  readonly items: readonly string[];
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

export interface RunState {
  readonly schemaVersion: number;
  readonly seed: number;
  readonly floorNumber: number;
  readonly phase: TurnPhase;
  readonly turn: number;
  readonly player: PlayerState;
  readonly enemies: readonly EnemyState[];
}
