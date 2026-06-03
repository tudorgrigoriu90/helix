/**
 * AdMob configuration (T-237 / T-341).
 *
 * Ad unit IDs and COPPA flags for the rewarded-ads integration. Ships with
 * Google's **public test ad unit IDs** so the build runs end-to-end without a
 * real AdMob account; the production IDs (from `admob.google.com` → app → ad
 * unit) drop into {@link PROD_AD_IDS} at store-submission time.
 *
 * COPPA posture (docs/Legal Compliance Notes §T-19): the app is 12+ with no age
 * verification, so both flags are `false` — we do not direct content at, or
 * knowingly serve, under-13 users. These are passed to AdMob.initialize().
 */

export interface AdPlatformIds {
  /** AdMob application id, `ca-app-pub-XXXX~YYYY`. */
  readonly appId: string;
  /** Rewarded ad unit id, `ca-app-pub-XXXX/ZZZZ`. */
  readonly rewardedUnitId: string;
}

export interface AdIds {
  readonly android: AdPlatformIds;
  readonly ios: AdPlatformIds;
}

/**
 * Google's documented test IDs (developers.google.com/admob). Safe to ship in
 * dev — they always fill and never count toward policy. NEVER click real ads in
 * a debug build; that risks an account strike, which is why dev uses these.
 */
export const TEST_AD_IDS: AdIds = {
  android: {
    appId: 'ca-app-pub-3940256099942544~3347511713',
    rewardedUnitId: 'ca-app-pub-3940256099942544/5224354917',
  },
  ios: {
    appId: 'ca-app-pub-3940256099942544~1458002511',
    rewardedUnitId: 'ca-app-pub-3940256099942544/1712485313',
  },
};

/**
 * Production IDs — replace the empty strings with the real values from AdMob
 * when the account exists. Left blank intentionally so a misconfigured prod
 * build fails loudly (see {@link resolveAdIds}) rather than silently serving
 * test ads with no revenue.
 */
export const PROD_AD_IDS: AdIds = {
  android: { appId: '', rewardedUnitId: '' },
  ios: { appId: '', rewardedUnitId: '' },
};

/** COPPA flags applied at SDK init (docs/Legal Compliance Notes §T-19). */
export const COPPA_FLAGS = {
  tagForChildDirectedTreatment: false,
  tagForUnderAgeOfConsent: false,
} as const;

/**
 * Picks the right ID set. `useTesting` (dev / non-release) returns the Google
 * test IDs; production returns {@link PROD_AD_IDS} and throws if they're still
 * blank, turning a config mistake into an early, obvious failure.
 */
export function resolveAdIds(useTesting: boolean): AdIds {
  if (useTesting) return TEST_AD_IDS;
  if (PROD_AD_IDS.android.rewardedUnitId === '' || PROD_AD_IDS.ios.rewardedUnitId === '') {
    throw new Error('resolveAdIds: production AdMob IDs are not configured (PROD_AD_IDS is blank)');
  }
  return PROD_AD_IDS;
}
