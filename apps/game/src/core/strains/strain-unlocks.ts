import type { MetaState } from '@shared-types/meta-state';
import type { SigmaStrainDef, StrainUnlock } from '@shared-types/sigma-strain';

/**
 * Sigma Strain unlock evaluation — T-306 (GDD §11.2 / §11.3).
 *
 * Pure: checks every strain's milestone against the profile's lifetime
 * counters and returns the ids that are newly satisfied. Called by
 * `recordRunOutcome` after the run's tallies have been folded in, so the run
 * that crosses a threshold is the run that unlocks the strain.
 */

function satisfied(unlock: StrainUnlock, meta: MetaState): boolean {
  switch (unlock.kind) {
    case 'runsCompleted':
      return meta.lifetime.runs >= unlock.count;
    case 'wins':
      return meta.lifetime.wins >= unlock.count;
    case 'reachFloor':
      return meta.lifetime.deepestFloor >= unlock.floor;
    case 'enemiesKilled':
      return meta.lifetime.enemiesKilled >= unlock.count;
    case 'killsOfType':
      return (meta.killsByType[unlock.damageType] ?? 0) >= unlock.count;
    case 'runsWithFamily':
      return (meta.runsByFamily[unlock.family] ?? 0) >= unlock.count;
    case 'deathsToType':
      return (meta.deathsByType[unlock.damageType] ?? 0) >= unlock.count;
  }
}

/** Strain ids whose milestone `meta` now satisfies but that are not yet unlocked. */
export function evaluateStrainUnlocks(
  pool: readonly SigmaStrainDef[],
  meta: MetaState,
): string[] {
  const owned = new Set(meta.sigmaStrainIds);
  return pool.filter((s) => !owned.has(s.id) && satisfied(s.unlock, meta)).map((s) => s.id);
}
