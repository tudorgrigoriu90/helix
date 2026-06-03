import { describe, it, expect } from 'vitest';
import { MemoryAdsAdapter } from '../platform/ads-adapter';
import { AdService } from './ad-service';
import { AD_COOLDOWN_MS, MAX_ADS_PER_RUN } from './ad-gatekeeper';

/** Builds a service with a controllable clock; schedule never fires (ads settle first). */
function make(adapter: MemoryAdsAdapter, startMs = 0): { svc: AdService; tick: (ms: number) => void } {
  let t = startMs;
  const svc = new AdService(adapter, {
    now: () => t,
    schedule: () => { /* never time out in these tests */ },
  });
  return { svc, tick: (ms: number) => { t += ms; } };
}

describe('AdService — integration of adapter + gate + timeout', () => {
  it('grants the reward on a completed ad', async () => {
    const { svc } = make(new MemoryAdsAdapter(['completed']));
    const out = await svc.requestReward('revive');
    expect(out).toEqual({ granted: true, result: 'completed' });
  });

  it('does not grant on a dismissed ad', async () => {
    const { svc } = make(new MemoryAdsAdapter(['dismissed']));
    const out = await svc.requestReward('merchant_refresh');
    expect(out.granted).toBe(false);
    expect(out.result).toBe('dismissed');
  });

  it('blocks a second request during the cooldown without touching the adapter', async () => {
    const adapter = new MemoryAdsAdapter(['completed', 'completed']);
    const { svc, tick } = make(adapter);
    await svc.requestReward('revive');
    tick(1000); // still inside the 60s cooldown
    const out = await svc.requestReward('revive');
    expect(out).toEqual({ granted: false, result: 'blocked', blockReason: 'cooling_down' });
    expect(adapter.shown).toEqual(['revive']); // adapter only called once
  });

  it('allows another ad once the cooldown elapses', async () => {
    const { svc, tick } = make(new MemoryAdsAdapter(['completed', 'completed']));
    await svc.requestReward('revive');
    tick(AD_COOLDOWN_MS);
    const out = await svc.requestReward('revive');
    expect(out.granted).toBe(true);
  });

  it('enforces the per-run cap and reports capReached', async () => {
    const { svc, tick } = make(new MemoryAdsAdapter(['completed']));
    for (let i = 0; i < MAX_ADS_PER_RUN; i++) {
      const out = await svc.requestReward('revive');
      expect(out.granted).toBe(true);
      tick(AD_COOLDOWN_MS);
    }
    expect(svc.capReached).toBe(true);
    const blocked = await svc.requestReward('revive');
    expect(blocked).toEqual({ granted: false, result: 'blocked', blockReason: 'cap_reached' });
  });

  it('failed attempts do not consume the cap', async () => {
    const { svc, tick } = make(new MemoryAdsAdapter(['dismissed', 'completed']));
    await svc.requestReward('revive');
    tick(AD_COOLDOWN_MS);
    await svc.requestReward('revive');
    expect(svc.capReached).toBe(false); // only one completed so far
  });

  it('reset clears cap and cooldown for a new run', async () => {
    const { svc, tick } = make(new MemoryAdsAdapter(['completed']));
    for (let i = 0; i < MAX_ADS_PER_RUN; i++) {
      await svc.requestReward('revive');
      tick(AD_COOLDOWN_MS);
    }
    expect(svc.capReached).toBe(true);
    svc.reset();
    expect(svc.capReached).toBe(false);
    expect((await svc.requestReward('revive')).granted).toBe(true);
  });

  it('times out when the ad never settles and the deadline fires', async () => {
    const adapter = new MemoryAdsAdapter();
    // Override showRewarded to hang; schedule fires immediately to hit the deadline.
    adapter.showRewarded = () => new Promise(() => { /* pending forever */ });
    const svc = new AdService(adapter, { now: () => 0, schedule: (cb) => { cb(); } });
    const out = await svc.requestReward('revive');
    expect(out).toEqual({ granted: false, result: 'timed_out' });
  });
});
