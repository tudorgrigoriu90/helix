import { describe, it, expect } from 'vitest';
import type { AdResult } from '../platform/ads-adapter';
import { withAdTimeout } from './ad-timeout';

/** A schedule fn that fires the timeout immediately — simulates "deadline hit first". */
const fireNow = (cb: () => void): void => { cb(); };
/** A schedule fn that never fires — simulates "ad resolves before the deadline". */
const neverFire = (): void => { /* no-op */ };

describe('withAdTimeout — T-240', () => {
  it('resolves the ad result when the ad settles before the deadline', async () => {
    const r = await withAdTimeout(Promise.resolve<AdResult>('completed'), 10_000, neverFire);
    expect(r).toBe('completed');
  });

  it('resolves timed_out when the deadline fires first', async () => {
    // An ad that never settles, with the timeout firing immediately.
    const r = await withAdTimeout(new Promise<AdResult>(() => { /* pending */ }), 10_000, fireNow);
    expect(r).toBe('timed_out');
  });

  it('maps a rejected ad promise to error', async () => {
    const r = await withAdTimeout(Promise.reject(new Error('sdk boom')), 10_000, neverFire);
    expect(r).toBe('error');
  });

  it('ignores a late ad result after timing out', async () => {
    let resolveAd!: (v: AdResult) => void;
    const ad = new Promise<AdResult>((res) => { resolveAd = res; });
    const raced = withAdTimeout(ad, 10_000, fireNow);
    resolveAd('completed'); // arrives after the race already resolved timed_out
    expect(await raced).toBe('timed_out');
  });

  it('passes a non-completed result through unchanged', async () => {
    const r = await withAdTimeout(Promise.resolve<AdResult>('dismissed'), 10_000, neverFire);
    expect(r).toBe('dismissed');
  });
});
