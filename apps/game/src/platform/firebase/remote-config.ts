import { fetchAndActivate, getRemoteConfig, getValue } from 'firebase/remote-config';
import { getFirebaseApp, isBrowser } from './app';

/**
 * Remote Config kill-switches — T-40 (TDD §11.6).
 *
 * Every backend-dependent feature is gated by a Remote Config flag that
 * **defaults to `false` in the shipped binary**, so a Remote Config outage (or
 * the moments before the first fetch completes) can never make the game depend
 * on a backend that isn't answering. The Director flips a flag ON in the console
 * to launch a feature, and back OFF in ~60s if it starts costing money.
 *
 * Reads are safe everywhere: outside a browser, before activation, or on any SDK
 * failure, `featureEnabled` returns the hard-coded `false` default.
 */

/** The backend features guarded by a kill-switch (TDD §11.6). */
export type FeatureFlag =
  | 'feature.sigma_echoes'
  | 'feature.daily_signal'
  | 'feature.weekly_challenge'
  | 'feature.cloud_sync'
  | 'feature.leaderboards';

/** In-binary defaults — all OFF. The single source of truth for safe fallback. */
export const FEATURE_DEFAULTS: Readonly<Record<FeatureFlag, boolean>> = {
  'feature.sigma_echoes': false,
  'feature.daily_signal': false,
  'feature.weekly_challenge': false,
  'feature.cloud_sync': false,
  'feature.leaderboards': false,
};

/** 1 hour between fetches in production (RC free-tier friendly, TDD §11.4). */
const MIN_FETCH_INTERVAL_MS = 60 * 60 * 1000;

type RemoteConfig = ReturnType<typeof getRemoteConfig>;
let rc: RemoteConfig | null | undefined;

/** Lazily builds the RC instance with all-false defaults; null outside a browser. */
function getRc(): RemoteConfig | null {
  if (rc !== undefined) return rc;
  const app = getFirebaseApp();
  if (app === null) {
    rc = null;
    return null;
  }
  try {
    const instance = getRemoteConfig(app);
    instance.settings.minimumFetchIntervalMillis = MIN_FETCH_INTERVAL_MS;
    instance.defaultConfig = { ...FEATURE_DEFAULTS };
    rc = instance;
  } catch {
    rc = null;
  }
  return rc;
}

/**
 * Fetches and activates the latest Remote Config. Best-effort and non-blocking:
 * resolves `false` if RC is unavailable or the fetch fails (defaults remain in
 * force), never rejects. Call once at boot.
 */
export async function initRemoteConfig(): Promise<boolean> {
  if (!isBrowser()) return false;
  const instance = getRc();
  if (instance === null) return false;
  try {
    return await fetchAndActivate(instance);
  } catch {
    return false; // keep the in-binary OFF defaults
  }
}

/**
 * Reads a feature flag. Returns the activated Remote Config value if available,
 * otherwise the hard `false` default (non-browser, pre-activation, or error).
 */
export function featureEnabled(flag: FeatureFlag): boolean {
  const instance = getRc();
  if (instance === null) return FEATURE_DEFAULTS[flag];
  try {
    return getValue(instance, flag).asBoolean();
  } catch {
    return FEATURE_DEFAULTS[flag];
  }
}

/** Test-only: drop the cached RC instance. */
export function _resetRemoteConfigForTests(): void {
  rc = undefined;
}
