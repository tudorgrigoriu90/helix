/**
 * LACE line — one authored barb from the player's companion AI (TDD §9.2).
 *
 * Lines are tagged by the run *event* that can trigger them (`context`) and the
 * companion's `mood`, and carry a sampling `weight`. The selection engine
 * (T-98) filters by context, prefers the current mood, excludes lines already
 * spoken this run (T-103), and weight-samples; when nothing matches it falls
 * back to the `generic` context pool (T-102).
 *
 * Authored as a single JSON bundle (`{ schemaVersion, lines }`) under
 * `packages/content/lace-lines/`. Schema lives in @shared-types — same rationale
 * as the other content contracts.
 */

/**
 * LACE's moods (GDD §10.1, TDD §9.4). Five behaviour-driven moods plus the
 * resting `neutral` baseline the mood machine drifts back toward (T-99/T-100):
 *
 *   - `curious`      — unexpected build choices; first reaching a new floor
 *   - `clinical`     — optimal / safe / defensive play
 *   - `amused`       — risky / creative play
 *   - `contemptuous` — death loops (repeated death to the same thing)
 *   - `reverent`     — Floor 16+ reached; Hybrid Synergy unlocked
 */
export type LaceMood = 'neutral' | 'curious' | 'clinical' | 'amused' | 'contemptuous' | 'reverent';

/**
 * Accumulated mood pressure per behaviour-driven mood (everything except the
 * resting `neutral`). This is the unit the mood state machine accumulates
 * (T-99), MetaState persists across runs, and the drift step decays toward
 * neutral over time (T-100).
 */
export type LaceMoodPressure = Readonly<Record<Exclude<LaceMood, 'neutral'>, number>>;

/** Run events a line can be tagged to. `generic` is the catch-all fallback pool. */
export type LaceContext =
  | 'run_start'
  | 'floor_enter'
  | 'combat_start'
  | 'enemy_killed'
  | 'player_hurt'
  | 'room_cleared'
  | 'boss_start'
  | 'boss_killed'
  | 'floor_complete'
  | 'player_death'
  | 'generic';

export interface LaceLine {
  readonly id: string;
  readonly text: string;
  readonly context: LaceContext;
  readonly mood: LaceMood;
  /** Relative sampling weight; must be > 0. */
  readonly weight: number;
}

/** On-disk bundle shape. */
export interface LaceLineBundle {
  readonly schemaVersion: number;
  readonly lines: readonly LaceLine[];
}

export const CURRENT_LACE_SCHEMA_VERSION = 1;
