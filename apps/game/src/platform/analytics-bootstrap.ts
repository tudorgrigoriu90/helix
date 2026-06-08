import { Capacitor } from '@capacitor/core';
import { type AnalyticsAdapter, setAnalyticsAdapter } from '../core/platform/analytics-adapter';
import { consoleAnalytics } from './analytics-console';
import { createFirebaseAnalytics } from './analytics-firebase';
import { createCapacitorAnalytics } from './analytics-capacitor';
import { onUid } from './firebase/auth';

/**
 * Analytics adapter selection — T-250 / T-251.
 *
 * One place that decides *which* analytics transport to install once consent is
 * resolved, so the boot scene doesn't repeat the policy at each call site:
 *
 *  - Native iOS / Android → Firebase Analytics native SDK (T-251), loaded via the
 *    `@capacitor-community/firebase-analytics` plugin.
 *  - Production web build → Firebase Analytics (GA4) web SDK (T-250).
 *  - Dev / unsupported / non-browser → console adapter (events still visible in
 *    the dev console; no GA4 noise from local runs).
 *
 * Call exactly once, only after the player has granted (or implied) consent.
 */

/** True in a Vite production build; false in dev / node tests. */
function isProdBuild(): boolean {
  try {
    const meta = import.meta as unknown as { env?: { PROD?: boolean } };
    return meta.env?.PROD === true;
  } catch {
    return false;
  }
}

/**
 * Tie GA4 / native segmentation to the anonymous install identity (T-127) once it
 * resolves. No-op on the console adapter / outside a browser (native runs inside a
 * webview, so `onUid` resolves there too).
 */
function wireUid(adapter: AnalyticsAdapter): void {
  if (adapter.setUserProperty === undefined) return;
  onUid((uid) => {
    if (uid !== null) adapter.setUserProperty?.('uid', uid);
  });
}

export function installAnalytics(): void {
  // Native platform: load the Firebase Analytics native SDK. The plugin import is
  // async, so install the console adapter synchronously first — events fired while
  // the plugin loads are still captured (debug log + console) and never lost — then
  // hot-swap to the native adapter once it's ready. Keeps the console fallback if
  // the plugin fails to load.
  if (Capacitor.isNativePlatform()) {
    setAnalyticsAdapter(consoleAnalytics);
    void createCapacitorAnalytics().then((adapter) => {
      if (adapter === null) return;
      setAnalyticsAdapter(adapter);
      wireUid(adapter);
    });
    return;
  }

  const firebase = isProdBuild() ? createFirebaseAnalytics() : null;
  const adapter = firebase ?? consoleAnalytics;
  setAnalyticsAdapter(adapter);
  wireUid(adapter);
}
