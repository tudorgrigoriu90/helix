import type { AnalyticsAdapter, EventSchema } from '../core/platform/analytics-adapter';

/**
 * Capacitor Firebase Analytics adapter — T-251 (TDD §10.4).
 *
 * Implements the engine's transport-agnostic {@link AnalyticsAdapter} on top of
 * the native Firebase Analytics SDK via `@capacitor-community/firebase-analytics`
 * (the iOS/Android counterpart to the GA4 web adapter, T-250). The engine fires
 * typed events through `core/platform/analytics-adapter`; this forwards them to
 * the native SDK with the same name + params.
 *
 * The plugin is **injected** (a narrow `*Like` slice) rather than statically
 * imported, for the same two reasons as the ads/storage Capacitor adapters
 * (T-237 / T-224):
 *  1. it's a native module with no web build, so a static import would pull a
 *     native-only module into the web bundle and the headless test run; and
 *  2. it lets us unit-test the name/param/uid mapping against a fake plugin.
 *
 * The interface's `logEvent` / `setUserProperty` are synchronous (`void`), but
 * the native plugin calls are async — so each is fire-and-forget with the
 * rejection swallowed. Analytics is best-effort instrumentation: a dropped event
 * must never surface to the player or break a frame (NFR P6). Real wiring happens
 * once, in {@link createCapacitorAnalytics}, off the platform bootstrap.
 */

/** The slice of the `@capacitor-community/firebase-analytics` API this adapter uses. */
export interface FirebaseAnalyticsPluginLike {
  logEvent(options: { name: string; params?: Record<string, unknown> }): Promise<void>;
  setUserId(options: { userId: string | null }): Promise<void>;
  setUserProperty(options: { name: string; value: string | null }): Promise<void>;
  setCollectionEnabled(options: { enabled: boolean }): Promise<void>;
}

export class CapacitorAnalyticsAdapter implements AnalyticsAdapter {
  constructor(private readonly plugin: FirebaseAnalyticsPluginLike) {}

  logEvent<K extends keyof EventSchema>(name: K, params: EventSchema[K]): void {
    // Native SDK takes a string event name + a flat params object; our schema
    // values are already flat scalars, so they pass through unchanged. Some
    // events carry no params (e.g. tutorial_complete) — omit the field then, as
    // the native bridge rejects an empty params object on some plugin versions.
    const flat = params as Record<string, unknown>;
    const hasParams = Object.keys(flat).length > 0;
    void this.plugin
      .logEvent(hasParams ? { name: String(name), params: flat } : { name: String(name) })
      .catch(() => {
        /* best-effort: a dropped analytics event must never break gameplay */
      });
  }

  setUserProperty(key: string, value: string): void {
    // The anonymous UID (T-127) is set as the native user-id; everything else is
    // a user property — mirrors the GA4 web adapter so segmentation matches.
    const call =
      key === 'uid'
        ? this.plugin.setUserId({ userId: value })
        : this.plugin.setUserProperty({ name: key, value });
    void call.catch(() => {
      /* best-effort */
    });
  }
}

/**
 * Wires the real native plugin into a {@link CapacitorAnalyticsAdapter}.
 * Dynamically imports `@capacitor-community/firebase-analytics` so the web bundle
 * never loads the native module (mirrors the ads/storage bootstraps) — only ever
 * called on a native platform, after consent is granted.
 *
 * Explicitly enables collection on init: collection is gated to the consent path
 * (the boot scene only reaches here after a grant, NFR P6), and the native plist/
 * manifest is configured to default collection **off** so a decline collects
 * nothing. Returns `null` if the plugin fails to load so the caller keeps the
 * console fallback rather than crashing the boot.
 */
export async function createCapacitorAnalytics(): Promise<AnalyticsAdapter | null> {
  try {
    const { FirebaseAnalytics } = await import('@capacitor-community/firebase-analytics');
    const plugin = FirebaseAnalytics as unknown as FirebaseAnalyticsPluginLike;
    await plugin.setCollectionEnabled({ enabled: true });
    return new CapacitorAnalyticsAdapter(plugin);
  } catch {
    return null;
  }
}
