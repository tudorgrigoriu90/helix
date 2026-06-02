/**
 * MetaState — the persistent player profile that survives across runs (T-111,
 * TDD §4.2). Distinct from RunState (a single in-progress run): this holds
 * unlocks and lifetime aggregates, saved to its own slot. No PII (NFR P6) —
 * only ids and counters.
 */

import type { LaceMoodPressure } from './lace-line';

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
}

/** v2 added `shardCrystals`; v3 added `laceMood`; v4 added `tutorialComplete`. */
export const CURRENT_META_SCHEMA_VERSION = 4;
