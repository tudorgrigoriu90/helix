import type { MutationFamily } from './mutation.js';

/**
 * Ending — one of the five Convergence sequences (GDD §2.8).
 *
 * Floor 20 culminates in the Convergence; the run's mutations determine which
 * ending plays. One ending per mutation family, authored as one JSON file per
 * ending under `packages/content/endings/`. The lines are LACE speaking —
 * calmly explaining what it has been building toward — so every line runs
 * through the T-530 voice gate. Endings are not "good" or "bad": each is a
 * different answer to the question LACE has been asking the whole descent.
 */
export interface EndingDef {
  /** Bumped when the on-disk JSON shape changes; loader runs migrations. */
  readonly schemaVersion: number;
  /** Stable id (analytics `run_end.endingId`). */
  readonly id: string;
  /** The family whose build earns this ending. */
  readonly family: MutationFamily;
  /** Sequence title card (e.g. "The Ocean Remembers"). */
  readonly title: string;
  /** LACE's beats, revealed in order. 3–12 lines, voice-gated. */
  readonly lines: readonly string[];
}

/** Current ending-def schema version. Increment when the on-disk shape changes. */
export const CURRENT_ENDING_SCHEMA_VERSION = 1;
