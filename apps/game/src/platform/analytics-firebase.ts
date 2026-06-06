import { getAnalytics, logEvent as fbLogEvent, setUserId, setUserProperties } from 'firebase/analytics';
import type { AnalyticsAdapter, EventSchema } from '../core/platform/analytics-adapter';
import { getFirebaseApp } from './firebase/app';

/**
 * Firebase Analytics web adapter — T-250 (TDD §10.4 / §13).
 *
 * Implements the engine's transport-agnostic {@link AnalyticsAdapter} on top of
 * the Firebase Analytics (GA4) web SDK. The engine fires typed events through
 * `core/platform/analytics-adapter`; this forwards them to GA4 with the same
 * name + params. Installed only after a consent decision (GameBootScene) — never
 * at import time — so it respects the GDPR/CCPA gate (NFR P6).
 *
 * `getAnalytics` needs a browser with `indexedDB` and a valid `measurementId`;
 * it throws otherwise. {@link createFirebaseAnalytics} therefore returns `null`
 * on any failure (non-browser, unsupported, blocked) so the caller falls back to
 * the console adapter instead of crashing the boot.
 */
export function createFirebaseAnalytics(): AnalyticsAdapter | null {
  const app = getFirebaseApp();
  if (app === null) return null;

  let analytics: ReturnType<typeof getAnalytics>;
  try {
    analytics = getAnalytics(app);
  } catch {
    return null; // analytics unsupported in this environment
  }

  return {
    logEvent<K extends keyof EventSchema>(name: K, params: EventSchema[K]): void {
      // GA4 accepts any string event name + a flat params object; our schema
      // values are already flat scalars, so they pass through unchanged.
      fbLogEvent(analytics, String(name), params as Record<string, unknown>);
    },
    setUserProperty(key: string, value: string): void {
      // The anonymous UID is set as the GA4 user-id; everything else is a
      // user property. Keeps run-level segmentation tied to the install.
      if (key === 'uid') {
        setUserId(analytics, value);
      } else {
        setUserProperties(analytics, { [key]: value });
      }
    },
  };
}
