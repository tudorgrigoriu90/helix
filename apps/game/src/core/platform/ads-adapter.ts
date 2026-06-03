/**
 * Ads adapter — the platform-agnostic rewarded-ad seam (T-235, TDD §10.2).
 *
 * Strand Descent shows **rewarded ads only** (GDD §15.2 / TDD §2.3): no banners,
 * no interstitials. The game code requests a reward through this interface and
 * receives a single {@link AdResult}; how the ad is loaded/shown is the
 * platform's concern (AdMob on native via the Capacitor plugin, a no-op stub on
 * web, an in-memory script in tests).
 *
 * Design rules baked into the contract:
 *  - `showRewarded` always resolves, never rejects — failures surface as a
 *    result code, so callers degrade gracefully (UFD E030/E031: a failed or
 *    cancelled ad grants no reward, with no retry and no goodwill grant).
 *  - The adapter is dumb: it knows nothing of the 3-ads/run cap or the 60s
 *    cooldown. That policy lives above it in the AdGatekeeper so it stays pure
 *    and testable.
 */

/** Where a rewarded ad was requested from — lets analytics/placements differ later. */
export type AdPlacement = 'revive' | 'merchant_refresh';

/**
 * The outcome of a rewarded-ad request. Only `completed` should grant a reward.
 *  - `completed`   — user watched to the reward threshold; grant the reward.
 *  - `dismissed`   — user closed the ad early (E031); no reward.
 *  - `unavailable` — no ad was loaded / no fill; no reward.
 *  - `timed_out`   — load/show exceeded the budget (E030, 10s); no reward.
 *  - `error`       — SDK/plugin error; no reward.
 */
export type AdResult = 'completed' | 'dismissed' | 'unavailable' | 'timed_out' | 'error';

export interface AdsAdapter {
  /** One-time SDK init (sets COPPA flags on native). Idempotent; resolves when ready. */
  initialize(): Promise<void>;
  /** Pre-loads a rewarded ad so the next {@link showRewarded} is instant. Optional best-effort. */
  loadRewarded(placement: AdPlacement): Promise<void>;
  /** Shows a rewarded ad. Always resolves with a result code — never rejects. */
  showRewarded(placement: AdPlacement): Promise<AdResult>;
}

/**
 * No-op web stub (T-236). There is no real ad inventory on web, so every request
 * reports `completed` — the web build is for development/playtesting where the
 * reward should simply be granted. Swap the result via the constructor to
 * exercise the failure paths in a browser.
 */
export class WebAdsAdapter implements AdsAdapter {
  constructor(private readonly result: AdResult = 'completed') {}

  initialize(): Promise<void> {
    return Promise.resolve();
  }

  loadRewarded(_placement: AdPlacement): Promise<void> {
    return Promise.resolve();
  }

  showRewarded(_placement: AdPlacement): Promise<AdResult> {
    return Promise.resolve(this.result);
  }
}

/**
 * In-memory adapter — the test double (mirrors MemoryStorageAdapter). Returns a
 * scripted sequence of results (looping on the last one) and records every
 * placement shown, so tests can assert on call order and degradation handling.
 */
export class MemoryAdsAdapter implements AdsAdapter {
  /** Placements passed to showRewarded, in call order. */
  readonly shown: AdPlacement[] = [];
  /** Placements passed to loadRewarded, in call order. */
  readonly loaded: AdPlacement[] = [];
  initialized = 0;

  private readonly script: readonly AdResult[];
  private cursor = 0;

  /** @param script results returned by successive showRewarded calls; the last repeats. */
  constructor(script: readonly AdResult[] = ['completed']) {
    this.script = script.length > 0 ? script : ['completed'];
  }

  initialize(): Promise<void> {
    this.initialized += 1;
    return Promise.resolve();
  }

  loadRewarded(placement: AdPlacement): Promise<void> {
    this.loaded.push(placement);
    return Promise.resolve();
  }

  showRewarded(placement: AdPlacement): Promise<AdResult> {
    this.shown.push(placement);
    const i = Math.min(this.cursor, this.script.length - 1);
    this.cursor += 1;
    return Promise.resolve(this.script[i]!);
  }
}
