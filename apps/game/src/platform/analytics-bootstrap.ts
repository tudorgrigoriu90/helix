import { setAnalyticsAdapter } from '../core/platform/analytics-adapter';
import { consoleAnalytics } from './analytics-console';
import { createFirebaseAnalytics } from './analytics-firebase';
import { onUid } from './firebase/auth';

/**
 * Analytics adapter selection — T-250.
 *
 * One place that decides *which* analytics transport to install once consent is
 * resolved, so the boot scene doesn't repeat the policy at each call site:
 *
 *  - Production web build → Firebase Analytics (GA4), when the SDK initialises.
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

export function installAnalytics(): void {
  const firebase = isProdBuild() ? createFirebaseAnalytics() : null;
  const adapter = firebase ?? consoleAnalytics;
  setAnalyticsAdapter(adapter);

  // Tie GA4 segmentation to the anonymous install identity (T-127) once it
  // resolves. No-op on the console adapter / outside a browser.
  if (adapter.setUserProperty !== undefined) {
    onUid((uid) => {
      if (uid !== null) adapter.setUserProperty?.('uid', uid);
    });
  }
}
