import { describe, it, expect, vi } from 'vitest';
import { CapacitorAdsAdapter, type AdMobPluginLike } from './ads-capacitor';
import { TEST_AD_IDS } from './ad-config';

/** Minimal fake plugin recording init options and scripting show behaviour. */
function fakePlugin(overrides: Partial<AdMobPluginLike> = {}) {
  const initOpts = { value: undefined as unknown };
  const initialize = vi.fn((opts: Parameters<AdMobPluginLike['initialize']>[0]): Promise<void> => {
    initOpts.value = opts;
    return Promise.resolve();
  });
  const plugin: AdMobPluginLike = {
    initialize,
    prepareRewardVideoAd: vi.fn((): Promise<unknown> => Promise.resolve()),
    showRewardVideoAd: vi.fn((): Promise<unknown> => Promise.resolve({ type: 'reward', amount: 1 })),
    ...overrides,
  };
  return { plugin, initOpts, initialize };
}

describe('CapacitorAdsAdapter — T-237', () => {
  it('passes COPPA flags (both false) and testing mode on initialize', async () => {
    const { plugin, initOpts } = fakePlugin();
    const a = new CapacitorAdsAdapter(plugin, TEST_AD_IDS.android, { testing: true });
    await a.initialize();
    expect(initOpts.value).toEqual({
      initializeForTesting: true,
      tagForChildDirectedTreatment: false,
      tagForUnderAgeOfConsent: false,
    });
  });

  it('initialises only once', async () => {
    const { plugin, initialize } = fakePlugin();
    const a = new CapacitorAdsAdapter(plugin, TEST_AD_IDS.ios, { testing: true });
    await a.initialize();
    await a.initialize();
    expect(initialize).toHaveBeenCalledTimes(1);
  });

  it('maps a resolved show to completed', async () => {
    const { plugin } = fakePlugin();
    const a = new CapacitorAdsAdapter(plugin, TEST_AD_IDS.android, { testing: true });
    expect(await a.showRewarded('revive')).toBe('completed');
  });

  it('maps a rejected show to dismissed (no reward)', async () => {
    const { plugin } = fakePlugin({ showRewardVideoAd: vi.fn(() => Promise.reject(new Error('closed early'))) });
    const a = new CapacitorAdsAdapter(plugin, TEST_AD_IDS.android, { testing: true });
    expect(await a.showRewarded('merchant_refresh')).toBe('dismissed');
  });

  it('lazily initialises before showing if not already initialised', async () => {
    const { plugin, initialize } = fakePlugin();
    const a = new CapacitorAdsAdapter(plugin, TEST_AD_IDS.ios, { testing: true });
    await a.showRewarded('revive');
    expect(initialize).toHaveBeenCalledTimes(1);
  });

  it('swallows pre-load errors in loadRewarded', async () => {
    const { plugin } = fakePlugin({ prepareRewardVideoAd: vi.fn(() => Promise.reject(new Error('no fill'))) });
    const a = new CapacitorAdsAdapter(plugin, TEST_AD_IDS.android, { testing: true });
    await expect(a.loadRewarded('revive')).resolves.toBeUndefined();
  });
});
