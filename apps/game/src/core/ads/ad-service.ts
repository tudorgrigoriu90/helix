import type { AdsAdapter, AdPlacement, AdResult } from '../platform/ads-adapter';
import type { AdGateState, AdGateDecision } from './ad-gatekeeper';
import { newAdGateState, canShowAd, recordAdAttempt, isAdCapReached } from './ad-gatekeeper';
import { withAdTimeout, AD_TIMEOUT_MS } from './ad-timeout';

/**
 * Ad service — the single entry point the game uses to request a rewarded ad.
 *
 * Composes the three concerns built separately: the platform {@link AdsAdapter}
 * (how an ad is shown), the {@link AdGateState} policy (3/run cap + 60s
 * cooldown), and the {@link withAdTimeout} budget (10s graceful degradation).
 * Scenes call {@link requestReward} and act only on `granted`.
 *
 * The gate state lives here and is per-run: call {@link reset} when a new run
 * starts. `now` and the timeout scheduler are injectable so the whole flow is
 * deterministically testable.
 */

export interface RewardOutcome {
  /** True only when the player earned the reward (ad watched to completion). */
  readonly granted: boolean;
  /** The raw ad result, or `blocked` when policy refused before showing. */
  readonly result: AdResult | 'blocked';
  /** Present when `result === 'blocked'`: why the gate refused. */
  readonly blockReason?: 'cap_reached' | 'cooling_down';
}

export interface AdServiceOptions {
  readonly timeoutMs?: number;
  readonly now?: () => number;
  readonly schedule?: (cb: () => void, ms: number) => void;
}

export class AdService {
  private gate: AdGateState = newAdGateState();
  private readonly timeoutMs: number;
  private readonly now: () => number;
  private readonly schedule?: (cb: () => void, ms: number) => void;

  constructor(private readonly adapter: AdsAdapter, opts: AdServiceOptions = {}) {
    this.timeoutMs = opts.timeoutMs ?? AD_TIMEOUT_MS;
    this.now = opts.now ?? (() => Date.now());
    this.schedule = opts.schedule;
  }

  /** Resets the per-run cap + cooldown. Call at the start of every run. */
  reset(): void {
    this.gate = newAdGateState();
  }

  initialize(): Promise<void> {
    return this.adapter.initialize();
  }

  /** Whether an ad may be offered right now (drives showing/hiding ad buttons). */
  canOffer(): AdGateDecision {
    return canShowAd(this.gate, this.now());
  }

  /** True once this run's ad cap is spent (show the SC alternative, UFD E032). */
  get capReached(): boolean {
    return isAdCapReached(this.gate);
  }

  /**
   * Requests a rewarded ad for `placement`. Honours the gate first (returns
   * `blocked` without touching the adapter), then shows under the timeout
   * budget, then folds the outcome into the cap/cooldown state.
   */
  async requestReward(placement: AdPlacement): Promise<RewardOutcome> {
    const decision = canShowAd(this.gate, this.now());
    if (!decision.allowed) {
      return { granted: false, result: 'blocked', blockReason: decision.reason };
    }

    const show = this.adapter.showRewarded(placement);
    const result = this.schedule !== undefined
      ? await withAdTimeout(show, this.timeoutMs, this.schedule)
      : await withAdTimeout(show, this.timeoutMs);

    this.gate = recordAdAttempt(this.gate, this.now(), result);
    return { granted: result === 'completed', result };
  }
}
