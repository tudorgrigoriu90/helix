/**
 * MetaState — the persistent player profile that survives across runs (T-111,
 * TDD §4.2). Distinct from RunState (a single in-progress run): this holds
 * unlocks and lifetime aggregates, saved to its own slot. No PII (NFR P6) —
 * only ids and counters.
 */

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
  readonly lifetime: LifetimeStats;
}

export const CURRENT_META_SCHEMA_VERSION = 1;
