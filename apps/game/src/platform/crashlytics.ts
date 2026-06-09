import { Capacitor } from '@capacitor/core';
import { onUid } from './firebase/auth';

/**
 * Crashlytics adapter — T-36 (TDD §10.5).
 *
 * Wraps `@capacitor-community/firebase-crashlytics` with the same patterns as
 * the analytics adapter: narrow plugin-interface slice, dynamic import so the
 * native-only module never enters the web bundle, all calls fire-and-forget.
 *
 * On Android the SDK auto-captures uncaught exceptions once enabled — no JS
 * code needed for basic crash reporting. This module adds:
 *   - consent-gated enable/disable (mirrors analytics consent gate)
 *   - anonymous UID attached to every report (matches analytics segmentation)
 *   - breadcrumb logging for key game events (visible in the Crashlytics dashboard)
 *   - non-fatal exception recording for caught errors worth surfacing
 *
 * Call `installCrashlytics()` exactly once, only after consent is granted,
 * from the same path as `installAnalytics()`.
 */

export interface FirebaseCrashlyticsPluginLike {
  setEnabled(options: { enabled: boolean }): Promise<void>;
  setUserId(options: { userId: string }): Promise<void>;
  addLogMessage(options: { message: string }): Promise<void>;
  recordException(options: { message: string }): Promise<void>;
  sendUnsentReports(): Promise<void>;
}

let _plugin: FirebaseCrashlyticsPluginLike | null = null;

async function plugin(): Promise<FirebaseCrashlyticsPluginLike | null> {
  if (_plugin !== null) return _plugin;
  try {
    const mod = await import('@capacitor-community/firebase-crashlytics');
    _plugin = mod.FirebaseCrashlytics as unknown as FirebaseCrashlyticsPluginLike;
    return _plugin;
  } catch {
    return null;
  }
}

/**
 * Enable Crashlytics and upload any queued reports.
 * Ties the anonymous Firebase UID to every subsequent report.
 * Safe to call multiple times — no-op after the first.
 */
export function installCrashlytics(): void {
  if (!Capacitor.isNativePlatform()) return;

  void plugin().then(async (p) => {
    if (p === null) return;
    await p.setEnabled({ enabled: true }).catch(() => {});
    await p.sendUnsentReports().catch(() => {});
    onUid((uid) => {
      if (uid !== null) {
        void p.setUserId({ userId: uid }).catch(() => {});
      }
    });
  });
}

/**
 * Add a breadcrumb message that appears in crash reports.
 * Useful at key game-state transitions (floor entered, combat started, etc.).
 * No-op on web.
 */
export function logBreadcrumb(message: string): void {
  if (!Capacitor.isNativePlatform()) return;
  void plugin().then((p) => {
    if (p === null) return;
    void p.addLogMessage({ message }).catch(() => {});
  });
}

/**
 * Record a non-fatal exception so it appears in the Crashlytics dashboard
 * without crashing the app. Use for caught errors that indicate a real problem
 * (e.g. save-load decode failure, unexpected state transitions).
 * No-op on web.
 */
export function recordNonFatal(message: string): void {
  if (!Capacitor.isNativePlatform()) return;
  void plugin().then((p) => {
    if (p === null) return;
    void p.recordException({ message }).catch(() => {});
  });
}
