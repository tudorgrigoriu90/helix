import type { MetaState } from '@shared-types/meta-state';

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
}

function union(a: readonly string[], b: readonly string[]): string[] {
  return [...new Set([...a, ...b])];
}

export function recordRunOutcome(meta: MetaState, outcome: RunOutcome): MetaState {
  const l = meta.lifetime;
  return {
    ...meta,
    codexEntryIds: union(meta.codexEntryIds, outcome.codexFound ?? []),
    achievementIds: union(meta.achievementIds, outcome.achievementsEarned ?? []),
    lifetime: {
      runs: l.runs + 1,
      wins: l.wins + (outcome.won ? 1 : 0),
      deepestFloor: Math.max(l.deepestFloor, outcome.floorReached),
      enemiesKilled: l.enemiesKilled + Math.max(0, outcome.enemiesKilled),
      totalPlaytimeMs: l.totalPlaytimeMs + Math.max(0, outcome.playtimeMs),
    },
  };
}
