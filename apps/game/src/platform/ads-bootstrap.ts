import { Capacitor } from '@capacitor/core';
import { WebAdsAdapter } from '../core/platform/ads-adapter';
import { AdService } from '../core/ads/ad-service';
import { CapacitorAdsAdapter } from './ads-capacitor';
import { resolveAdIds } from './ad-config';

/**
 * Creates the platform-appropriate AdsAdapter and wraps it in an AdService.
 *
 * On native (iOS / Android) the real @capacitor-community/admob plugin is
 * dynamically imported so the web bundle never touches native-only modules.
 * On web the WebAdsAdapter is used (no-op / configurable stub).
 */
async function buildAdService(): Promise<AdService> {
  const isNative = Capacitor.isNativePlatform();
  const useTesting = (import.meta.env as Record<string, unknown>)['DEV'] === true;

  if (isNative) {
    const { AdMob } = await import('@capacitor-community/admob');
    const ids = resolveAdIds(!useTesting);
    const platform = Capacitor.getPlatform() as 'ios' | 'android';
    const adapter = new CapacitorAdsAdapter(AdMob, ids[platform], { testing: useTesting });
    return new AdService(adapter);
  }

  return new AdService(new WebAdsAdapter());
}

// Singleton promise — resolved before any scene tries to show an ad.
// GameBootScene (or main.ts) awaits this; scenes import `adService` directly.
export const adServiceReady: Promise<AdService> = buildAdService();

/** Resolved AdService — safe to call once the app has booted. */
export let adService: AdService = new AdService(new WebAdsAdapter());

void adServiceReady.then((svc) => {
  adService = svc;
});
