import type { AdsAdapter, AdPlacement, AdResult } from '../core/platform/ads-adapter';
import type { AdPlatformIds } from './ad-config';
import { COPPA_FLAGS } from './ad-config';

/**
 * Capacitor AdMob adapter (T-237) — rewarded ads on iOS/Android via the
 * `@capacitor-community/admob` plugin.
 *
 * The plugin is **injected** rather than statically imported, for two reasons:
 *  1. it's a native module with no web build, so importing it would break the
 *     web bundle and the headless test run; and
 *  2. it lets us unit-test the result mapping with a fake plugin.
 *
 * Final native wiring is a one-liner at the platform bootstrap:
 *
 * ```ts
 * import { AdMob } from '@capacitor-community/admob';
 * const adapter = new CapacitorAdsAdapter(AdMob, ids, { testing: !isProd });
 * ```
 *
 * Until then the rest of the game targets the `AdsAdapter` interface and runs on
 * {@link WebAdsAdapter}.
 */

/** The slice of the `@capacitor-community/admob` API this adapter depends on. */
export interface AdMobPluginLike {
  initialize(options: {
    initializeForTesting?: boolean;
    tagForChildDirectedTreatment?: boolean;
    tagForUnderAgeOfConsent?: boolean;
  }): Promise<void>;
  prepareRewardVideoAd(options: { adId: string }): Promise<unknown>;
  /** Resolves with a reward item when the user earned it; rejects if dismissed early. */
  showRewardVideoAd(): Promise<unknown>;
}

export interface CapacitorAdsOptions {
  /** True in dev/non-release: initialises the SDK in test mode. */
  readonly testing: boolean;
}

export class CapacitorAdsAdapter implements AdsAdapter {
  private initialized = false;

  constructor(
    private readonly plugin: AdMobPluginLike,
    private readonly ids: AdPlatformIds,
    private readonly options: CapacitorAdsOptions,
  ) {}

  async initialize(): Promise<void> {
    if (this.initialized) return;
    await this.plugin.initialize({
      initializeForTesting: this.options.testing,
      ...COPPA_FLAGS,
    });
    this.initialized = true;
  }

  async loadRewarded(_placement: AdPlacement): Promise<void> {
    // Best-effort pre-load; swallow load errors so showRewarded can report them
    // as a clean result code rather than this throwing.
    try {
      await this.plugin.prepareRewardVideoAd({ adId: this.ids.rewardedUnitId });
    } catch {
      /* no-op: a failed pre-load surfaces as 'unavailable' on show */
    }
  }

  async showRewarded(_placement: AdPlacement): Promise<AdResult> {
    if (!this.initialized) await this.initialize();
    try {
      await this.plugin.prepareRewardVideoAd({ adId: this.ids.rewardedUnitId });
      await this.plugin.showRewardVideoAd();
      // A resolved show means the reward threshold was reached.
      return 'completed';
    } catch {
      // The plugin rejects when the user dismisses early or no ad is available.
      // We can't always distinguish them, so report the conservative 'dismissed'
      // (no reward either way); the timeout wrapper handles true hangs.
      return 'dismissed';
    }
  }
}
