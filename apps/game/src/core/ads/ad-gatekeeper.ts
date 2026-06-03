import type { AdResult } from '../platform/ads-adapter';

/**
 * Ad gatekeeper — the pure policy that rate-limits rewarded ads (T-238/T-239).
 *
 * Two limits, per GDD §15.2:
 *  - a **hard cap of 3 completed ads per run** — once reached, ad offers hide
 *    and the SC alternative is shown (UFD E032);
 *  - a **60-second cooldown** between attempts — this also enforces the "no
 *    retry" rule (UFD E030/E031): a failed/cancelled ad starts the cooldown, so
 *    the player can't immediately re-roll the ad.
 *
 * Pure and serialisable: the state is a plain object carried in the run session,
 * decisions are a function of `(state, now)`. No timers, no I/O — fully testable.
 */

/** Hard cap on completed rewarded ads in a single run (GDD §15.2). */
export const MAX_ADS_PER_RUN = 3;
/** Minimum gap between ad attempts, in milliseconds (GDD §15.2). */
export const AD_COOLDOWN_MS = 60_000;

export interface AdGateState {
  /** Count of ads watched to completion this run (only `completed` increments). */
  readonly completedThisRun: number;
  /** Timestamp of the last ad *attempt* (any result), or null if none yet. */
  readonly lastAttemptAtMs: number | null;
}

export type AdGateDecision =
  | { readonly allowed: true }
  | {
      readonly allowed: false;
      readonly reason: 'cap_reached' | 'cooling_down';
      /** For `cooling_down`: ms remaining until an attempt is allowed again. */
      readonly retryAfterMs: number;
    };

export function newAdGateState(): AdGateState {
  return { completedThisRun: 0, lastAttemptAtMs: null };
}

/** Whether a rewarded ad may be *offered/attempted* right now. */
export function canShowAd(state: AdGateState, nowMs: number): AdGateDecision {
  if (state.completedThisRun >= MAX_ADS_PER_RUN) {
    return { allowed: false, reason: 'cap_reached', retryAfterMs: 0 };
  }
  if (state.lastAttemptAtMs !== null) {
    const elapsed = nowMs - state.lastAttemptAtMs;
    if (elapsed < AD_COOLDOWN_MS) {
      return { allowed: false, reason: 'cooling_down', retryAfterMs: AD_COOLDOWN_MS - elapsed };
    }
  }
  return { allowed: true };
}

/**
 * Folds an attempt's outcome into the gate state: the cooldown timer resets on
 * every attempt (enforcing no-retry), and the per-run cap advances only when the
 * ad was actually `completed`.
 */
export function recordAdAttempt(state: AdGateState, nowMs: number, result: AdResult): AdGateState {
  return {
    completedThisRun: state.completedThisRun + (result === 'completed' ? 1 : 0),
    lastAttemptAtMs: nowMs,
  };
}

/** True once the per-run cap is exhausted — drives hiding ad buttons (UFD E032). */
export function isAdCapReached(state: AdGateState): boolean {
  return state.completedThisRun >= MAX_ADS_PER_RUN;
}
