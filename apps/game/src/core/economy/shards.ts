/**
 * Shard Crystal (hard currency, "SC") earn rates — T-107 (GDD §15.5,
 * Economy.xlsx "Currencies").
 *
 * Shards are earned *slowly* and persist across runs (unlike VEIN). Sources:
 *   - **Run completion** — a trickle proportional to the run's VEIN income, at
 *     the workbook's `shard_per_vein_conversion = 0.005` (so a ~4,800-VEIN full
 *     run yields ~24 shards, matching the sheet's full-run total).
 *   - **Daily run** — a flat bonus for the first completed run each day.
 *   - **Achievements** — a flat bonus per milestone unlocked.
 *
 * The conversion rate is the workbook value; the flat daily/achievement amounts
 * aren't enumerated in the sheet, so they're authored here (and flagged) at
 * sensible defaults. Shards accrue fractionally from VEIN and are floored only
 * when displayed/spent — so {@link shardsForRun} returns the raw fractional gain
 * and {@link floorShards} does the flooring.
 */

/** Workbook driver: Shard Crystals earned per VEIN of run income. */
export const SHARD_PER_VEIN = 0.005;
/** Authored: flat shards for the first completed run of the day (GDD §15.5 "daily runs"). */
export const SHARD_DAILY_RUN = 5;
/** Authored: flat shards per achievement milestone unlocked (GDD §15.5 "achievements"). */
export const SHARD_ACHIEVEMENT = 10;
/** Revive cost in shards (GDD §15.5) — the canonical hard-currency sink. */
export const SHARD_REVIVE_COST = 75;

export interface RunShardSources {
  /** Total VEIN earned during the run. */
  readonly vein: number;
  /** Whether this is the player's first completed run today. */
  readonly firstRunToday: boolean;
  /** Number of achievement milestones unlocked by this run. */
  readonly achievementsUnlocked: number;
}

/** Fractional shards from a run's VEIN income alone (`vein × 0.005`). */
export function shardsFromRunVein(vein: number): number {
  return Math.max(0, vein) * SHARD_PER_VEIN;
}

/**
 * Total (fractional) shards earned from completing a run: the VEIN trickle plus
 * the daily-run bonus (if first today) plus per-achievement bonuses. Caller
 * accumulates this onto the persistent shard balance.
 */
export function shardsForRun(sources: RunShardSources): number {
  return (
    shardsFromRunVein(sources.vein) +
    (sources.firstRunToday ? SHARD_DAILY_RUN : 0) +
    Math.max(0, sources.achievementsUnlocked) * SHARD_ACHIEVEMENT
  );
}

/** Spendable (whole) shards from a fractional accrued balance. */
export function floorShards(accrued: number): number {
  return Math.floor(Math.max(0, accrued));
}
