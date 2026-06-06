import { type FirebaseApp, getApps, initializeApp } from 'firebase/app';
import { firebaseConfig } from './config';

/**
 * Firebase app singleton — T-127 / T-250.
 *
 * `initializeApp` itself does no network I/O — it just registers the config — so
 * it's cheap and safe to call at boot. The guard below keeps it from running in
 * a non-browser context (node unit tests, any SSR step), where the Firebase web
 * SDK has no `window`/`indexedDB` to attach to. Returns `null` there so callers
 * degrade gracefully rather than throw: the game is fully playable offline with
 * no backend (TDD §11.6 — every backend feature is kill-switched off anyway).
 */

let cached: FirebaseApp | null | undefined;

/** True only in a real browser environment with the globals the SDK needs. */
export function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof window.document !== 'undefined';
}

/**
 * Returns the initialised Firebase app, or `null` when running outside a browser.
 * Idempotent: re-uses an already-initialised app (so HMR / repeated calls don't
 * register the project twice).
 */
export function getFirebaseApp(): FirebaseApp | null {
  if (cached !== undefined) return cached;
  if (!isBrowser()) {
    cached = null;
    return null;
  }
  cached = getApps()[0] ?? initializeApp(firebaseConfig);
  return cached;
}

/** Test-only: drop the cached app so a fresh environment check can run. */
export function _resetFirebaseAppForTests(): void {
  cached = undefined;
}
