import type { Position } from './action.js';
import type { AbilitySlot } from './ability.js';
import type { ItemDef } from './item.js';
import type { MutationFamily } from './mutation.js';

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

/** Locked analytics enum for run-end attribution (GDD §6.7). */
export type DeathCause =
  | 'enemy_kill'
  | 'boss_kill'
  | 'hazard'
  | 'status_tick'
  | 'surrender'
  | 'mutation_backfire';

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
  /**
   * Families with an active Dominant Trait (3+ mutations of that family,
   * GDD §5.5). Precomputed at mutation-selection time so the engine reads trait
   * effects without a content registry. Optional — absent on pre-trait saves and
   * treated as none.
   */
  readonly dominantTraits?: readonly MutationFamily[];
}

/**
 * Pre-committed enemy intent (GDD §6.2). Baseline AI decides-and-acts at action
 * time and never sets this — it is `null` for ordinary enemies. Reserved for
 * scripted wind-ups (boss charges, multi-turn specials) where a deliberate,
 * readable tell is the point.
 */
export type Telegraph = 'melee' | 'ranged' | 'defense' | 'move' | 'special' | 'idle';

export interface EnemyState {
  readonly id: string;
  readonly enemyDefId: string;
  readonly pos: Position;
  readonly hp: number;
  readonly maxHp: number;
  readonly stats: EntityStats;
  readonly statuses: readonly ActiveStatus[];
  /** Scripted wind-up only; `null` for baseline decide-and-act enemies. */
  readonly telegraph: Telegraph | null;
  /**
   * Aggro state (GDD §6.1a). An enemy stays *dormant* — holding position, not
   * acting — until it detects the player (within vision range + line of sight),
   * then latches `aware: true` and chases for the rest of the encounter even if
   * the player breaks line of sight. Optional: absent is treated as dormant, so
   * pre-vision saves load without migration and self-correct on the next phase.
   */
  readonly aware?: boolean;
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
