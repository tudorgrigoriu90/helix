/**
 * T-252: Dev-mode console-logging analytics adapter.
 *
 * Logs every event to `console.debug` in a structured format so
 * developers can verify events fire correctly without a Firebase project.
 *
 * Install at app start via `setAnalyticsAdapter(consoleAnalytics)` when
 * running in dev mode.
 *
 * Pure — no Phaser, no Firebase.
 */

import type { AnalyticsAdapter, EventSchema } from '../core/platform/analytics-adapter';

export const consoleAnalytics: AnalyticsAdapter = {
  logEvent<K extends keyof EventSchema>(name: K, params: EventSchema[K]): void {
    // eslint-disable-next-line no-console
    console.debug(`[analytics] ${String(name)}`, params);
  },
  setUserProperty(key: string, value: string): void {
    // eslint-disable-next-line no-console
    console.debug(`[analytics:prop] ${key} = ${value}`);
  },
};
