/**
 * MetaState — the persistent player profile that survives across runs (T-111,
 * TDD §4.2). Distinct from RunState (a single in-progress run): this holds
 * unlocks and lifetime aggregates, saved to its own slot. No PII (NFR P6) —
 * only ids and counters.
 */

import type { LaceMoodPressure } from './lace-line';
import type { MutationFamily } from './mutation.js';
import type { DamageType } from './run-state.js';

export interface LifetimeStats {
  readonly runs: number;
  readonly wins: number;
  readonly deepestFloor: number;
  readonly enemiesKilled: number;
  readonly totalPlaytimeMs: number;
}

export interface MetaState {
  /** Bumped when the on-disk shape changes; loader runs migrations. */
  readonly schemaVersion: number;
  /** Codex entry ids the player has discovered. */
  readonly codexEntryIds: readonly string[];
  /** Unlocked Sigma Strain ids (meta-progression). */
  readonly sigmaStrainIds: readonly string[];
  /** Earned achievement ids. */
  readonly achievementIds: readonly string[];
  /** Unlocked cosmetic ids. */
  readonly cosmeticIds: readonly string[];
  /**
   * Shard Crystal balance — the persistent hard currency (GDD §15.5). Earned
   * slowly across runs (T-107/T-113) and spent on revives + cosmetics. Stored
   * fractionally (runs accrue `vein × 0.005`); floor it when displaying/spending.
   */
  readonly shardCrystals: number;
  /**
   * LACE's accumulated mood pressure, carried across runs (GDD §10.1, T-99/T-100).
   * Persisting it is what makes the companion's disposition *stick* between runs;
   * each recorded run drifts it one step back toward neutral (T-100).
   */
  readonly laceMood: LaceMoodPressure;
  /**
   * Whether the player has finished the Floor 0 tutorial (TDD §21 Q4). Set on the
   * Floor 0 boss kill (T-142/T-143); once true, returning players skip the
   * tutorial and start runs straight from the Hub.
   */
  readonly tutorialComplete: boolean;
  readonly lifetime: LifetimeStats;
  /**
   * Sigma Strain achievement counters (T-306, GDD §11.2). Sparse maps — a type
   * or family the player has never tallied is simply absent (treated as 0).
   */
  /** Lifetime kills per enemy basic-attack damage type ("Kill 100 Thermal enemies"). */
  readonly killsByType: Readonly<Partial<Record<DamageType, number>>>;
  /** Lifetime deaths per killing-blow damage type ("Die to Void enemy 5 times"). */
  readonly deathsByType: Readonly<Partial<Record<DamageType, number>>>;
  /** Runs finished per most-stacked mutation family ("10 runs with Abyssal"). */
  readonly runsByFamily: Readonly<Partial<Record<MutationFamily, number>>>;
  /** The mutation ids the player ended the last run with (Convergence Echo). */
  readonly lastRunMutationIds: readonly string[];
}

/** v2 added `shardCrystals`; v3 added `laceMood`; v4 added `tutorialComplete`;
 *  v5 added the Sigma Strain counters (`killsByType`, `deathsByType`,
 *  `runsByFamily`, `lastRunMutationIds`) — T-306. */
export const CURRENT_META_SCHEMA_VERSION = 5;
