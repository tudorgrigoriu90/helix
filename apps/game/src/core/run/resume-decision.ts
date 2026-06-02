import type { LoadResult } from '../save/save-manager';
import type { RunSessionSave, RunStatus } from './run-session';

/**
 * Resume Run? trigger logic — T-117 (UFD S100, edge case E011).
 *
 * On cold launch the boot flow loads the run save and asks this pure function
 * what to do: if a *resumable* run exists, prompt the "Resume Run?" modal
 * (S100 → Resume jumps to the FloorScene, New run goes to the Hub); otherwise
 * proceed straight to the first-launch / Hub flow. The modal *presentation* is
 * T-136 — this module owns only the decision and the summary the modal renders.
 *
 * Robust by design (E011 — "app killed by OS"): a missing save, or one that
 * failed to load/migrate, is treated as "nothing to resume" rather than
 * stranding the player on a broken prompt. Terminal runs (victory/defeat) — which
 * the run loop clears on completion — are likewise not offered for resume.
 */

/** A run already finished can't be resumed; only live runs prompt S100. */
const TERMINAL_STATUSES: ReadonlySet<RunStatus> = new Set<RunStatus>(['victory', 'defeat']);

/** What the S100 modal shows about the run waiting to be resumed. */
export interface ResumeSummary {
  readonly floorNumber: number;
  readonly status: RunStatus;
  /** True when the run was saved mid-fight (resumes straight into combat, T-114). */
  readonly inCombat: boolean;
}

export type ResumeDecision =
  /** Show the S100 "Resume Run?" modal with this summary. */
  | { readonly kind: 'prompt'; readonly summary: ResumeSummary }
  /** No resumable run — go to the normal first-launch / Hub flow. */
  | { readonly kind: 'fresh' };

/**
 * Decides whether to surface the S100 modal from a loaded run save.
 * `null` = no save on disk; `{ ok: false }` = a save that wouldn't load/migrate.
 */
export function decideResume(loaded: LoadResult<RunSessionSave> | null): ResumeDecision {
  if (loaded === null || !loaded.ok) return { kind: 'fresh' };

  const save = loaded.value;
  if (TERMINAL_STATUSES.has(save.status)) return { kind: 'fresh' };

  return {
    kind: 'prompt',
    summary: {
      floorNumber: save.floorNumber,
      status: save.status,
      inCombat: save.status === 'in_combat' && save.combat !== undefined,
    },
  };
}
