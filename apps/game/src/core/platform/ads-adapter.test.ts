import { describe, it, expect } from 'vitest';
import { WebAdsAdapter, MemoryAdsAdapter } from './ads-adapter';

describe('WebAdsAdapter — T-236', () => {
  it('reports completed by default (reward granted in dev)', async () => {
    const a = new WebAdsAdapter();
    expect(await a.showRewarded('revive')).toBe('completed');
  });

  it('can be scripted to a failure result', async () => {
    const a = new WebAdsAdapter('unavailable');
    expect(await a.showRewarded('merchant_refresh')).toBe('unavailable');
  });

  it('initialize and loadRewarded resolve cleanly', async () => {
    const a = new WebAdsAdapter();
    await expect(a.initialize()).resolves.toBeUndefined();
    await expect(a.loadRewarded('revive')).resolves.toBeUndefined();
  });
});

describe('MemoryAdsAdapter — test double', () => {
  it('returns completed once, then repeats the last scripted result', async () => {
    const a = new MemoryAdsAdapter(['completed', 'dismissed']);
    expect(await a.showRewarded('revive')).toBe('completed');
    expect(await a.showRewarded('revive')).toBe('dismissed');
    expect(await a.showRewarded('revive')).toBe('dismissed'); // last repeats
  });

  it('records placements shown and loaded in order', async () => {
    const a = new MemoryAdsAdapter();
    await a.loadRewarded('merchant_refresh');
    await a.showRewarded('revive');
    await a.showRewarded('merchant_refresh');
    expect(a.loaded).toEqual(['merchant_refresh']);
    expect(a.shown).toEqual(['revive', 'merchant_refresh']);
  });

  it('counts initialize calls', async () => {
    const a = new MemoryAdsAdapter();
    await a.initialize();
    await a.initialize();
    expect(a.initialized).toBe(2);
  });

  it('defaults to completed when given an empty script', async () => {
    const a = new MemoryAdsAdapter([]);
    expect(await a.showRewarded('revive')).toBe('completed');
  });
});
