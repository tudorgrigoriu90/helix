import type { MetaState } from '@shared-types/meta-state';
import type { LaceMoodPressure } from '@shared-types/lace-line';
import type { MutationFamily } from '@shared-types/mutation';
import type { DamageType } from '@shared-types/run-state';
import type { SigmaStrainDef } from '@shared-types/sigma-strain';
import { shardsForRun } from '../economy';
import { driftPressure } from '../lace';
import { aggregateStrainFx, evaluateStrainUnlocks } from '../strains';

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
  // ── Sigma Strain achievement tallies (T-306, GDD §11.2) ───────────────────
  /** Kills this run per enemy basic-attack damage type. */
  readonly killsByType?: Readonly<Partial<Record<DamageType, number>>>;
  /** Damage type of the killing blow (deaths only; omit on wins/surrender). */
  readonly deathDamageType?: DamageType;
  /** The build's most-stacked mutation family at run end (omit if no mutations). */
  readonly dominantFamily?: MutationFamily;
  /** The mutation ids the run ended with (feeds Convergence Echo's carry). */
  readonly mutationIds?: readonly string[];
}

function union(a: readonly string[], b: readonly string[]): string[] {
  return [...new Set([...a, ...b])];
}

function addCounts<K extends string>(
  base: Readonly<Partial<Record<K, number>>>,
  add: Readonly<Partial<Record<K, number>>>,
): Partial<Record<K, number>> {
  const next: Partial<Record<K, number>> = { ...base };
  for (const key of Object.keys(add) as K[]) {
    const n = add[key] ?? 0;
    if (n > 0) next[key] = (next[key] ?? 0) + n;
  }
  return next;
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

/**
 * Folds a finished run into the profile. When the Sigma Strain pool (T-306) is
 * supplied, three more things happen here: already-unlocked shard-bonus strains
 * boost the run's Shard conversion, the run's typed tallies advance the
 * achievement counters, and any milestone the updated counters now satisfy
 * unlocks its strain — all in one pure step.
 */
export function recordRunOutcome(
  meta: MetaState,
  outcome: RunOutcome,
  strainPool: readonly SigmaStrainDef[] = [],
): MetaState {
  const l = meta.lifetime;
  const baseShards = shardsForRun({
    vein: outcome.veinEarned ?? 0,
    firstRunToday: outcome.firstRunToday ?? false,
    achievementsUnlocked: outcome.shardAchievements ?? 0,
  });
  // Shard bonus from strains unlocked *before* this run (GDD §11.2 [META]).
  const fx = aggregateStrainFx(strainPool, meta.sigmaStrainIds);
  const shardsEarned = baseShards * (1 + fx.shardBonusPercent / 100);
  const folded: MetaState = {
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
    killsByType: addCounts(meta.killsByType, outcome.killsByType ?? {}),
    deathsByType:
      !outcome.won && outcome.deathDamageType !== undefined
        ? addCounts(meta.deathsByType, { [outcome.deathDamageType]: 1 })
        : meta.deathsByType,
    runsByFamily:
      outcome.dominantFamily !== undefined
        ? addCounts(meta.runsByFamily, { [outcome.dominantFamily]: 1 })
        : meta.runsByFamily,
    lastRunMutationIds: [...(outcome.mutationIds ?? [])],
  };
  // Milestones crossed by this run's tallies unlock their strains now (§11.3).
  const newlyUnlocked = evaluateStrainUnlocks(strainPool, folded);
  return newlyUnlocked.length === 0
    ? folded
    : { ...folded, sigmaStrainIds: union(folded.sigmaStrainIds, newlyUnlocked) };
}
