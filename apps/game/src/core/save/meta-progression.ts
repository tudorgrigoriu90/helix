import type { MetaState } from '@shared-types/meta-state';
import type { LaceMoodPressure } from '@shared-types/lace-line';
import { shardsForRun } from '../economy';
import { driftPressure } from '../lace';

/**
 * Meta-progression — folds a finished run into the persistent profile (T-111).
 * Pure: returns a new MetaState; the caller persists it via the SaveManager.
 */

export interface RunOutcome {
  readonly won: boolean;
  readonly floorReached: number;
  readonly enemiesKilled: number;
  readonly playtimeMs: number;
  /** Codex entry ids discovered this run (merged, deduped). */
  readonly codexFound?: readonly string[];
  /** Achievement ids earned this run (merged, deduped). */
  readonly achievementsEarned?: readonly string[];
  // ── Shard Crystal sources (hard currency, T-113 / GDD §15.5) ──────────────
  /** Total VEIN *earned* this run — converted to Shards at 0.005 (T-107). */
  readonly veinEarned?: number;
  /** Whether this was the player's first completed run today (daily bonus). */
  readonly firstRunToday?: boolean;
  /** Number of milestones that grant a flat Shard bonus this run. */
  readonly shardAchievements?: number;
  /**
   * LACE's accumulated mood pressure at the end of this run (T-99). Persisted
   * one drift-step toward neutral (T-100). Omit it and the carried-over mood
   * still drifts — mood fades on quiet runs too, not only active ones.
   */
  readonly laceMoodPressure?: LaceMoodPressure;
}

function union(a: readonly string[], b: readonly string[]): string[] {
  return [...new Set([...a, ...b])];
}

/**
 * Whether the Floor 0 tutorial should run for this profile (TDD §21 Q4). The
 * Hub reads this to decide between starting the tutorial and a normal run.
 */
export function shouldShowTutorial(meta: MetaState): boolean {
  return !meta.tutorialComplete;
}

/**
 * Marks the Floor 0 tutorial finished — called on the tutorial boss kill
 * (T-142). Pure and idempotent; returns the same shape when already complete.
 */
export function markTutorialComplete(meta: MetaState): MetaState {
  return meta.tutorialComplete ? meta : { ...meta, tutorialComplete: true };
}

/** The achievement granted for clearing the Floor 0 boss (TDD §21 Q4 / GDD §18.6). */
export const FIRST_CONVERGENCE_ACHIEVEMENT_ID = 'first_convergence';

/**
 * Folds a finished Floor 0 tutorial into the profile (T-142): grants the First
 * Convergence achievement and marks the tutorial complete. Pure + idempotent —
 * replaying it is a no-op once both are recorded.
 */
export function completeTutorial(meta: MetaState): MetaState {
  return {
    ...markTutorialComplete(meta),
    achievementIds: union(meta.achievementIds, [FIRST_CONVERGENCE_ACHIEVEMENT_ID]),
  };
}

export function recordRunOutcome(meta: MetaState, outcome: RunOutcome): MetaState {
  const l = meta.lifetime;
  const shardsEarned = shardsForRun({
    vein: outcome.veinEarned ?? 0,
    firstRunToday: outcome.firstRunToday ?? false,
    achievementsUnlocked: outcome.shardAchievements ?? 0,
  });
  return {
    ...meta,
    codexEntryIds: union(meta.codexEntryIds, outcome.codexFound ?? []),
    achievementIds: union(meta.achievementIds, outcome.achievementsEarned ?? []),
    shardCrystals: meta.shardCrystals + shardsEarned,
    // Persist this run's mood (or the carried-over one), drifted a step toward neutral.
    laceMood: driftPressure(outcome.laceMoodPressure ?? meta.laceMood),
    lifetime: {
      runs: l.runs + 1,
      wins: l.wins + (outcome.won ? 1 : 0),
      deepestFloor: Math.max(l.deepestFloor, outcome.floorReached),
      enemiesKilled: l.enemiesKilled + Math.max(0, outcome.enemiesKilled),
      totalPlaytimeMs: l.totalPlaytimeMs + Math.max(0, outcome.playtimeMs),
    },
  };
}
