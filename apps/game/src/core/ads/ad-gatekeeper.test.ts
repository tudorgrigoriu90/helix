import { describe, it, expect } from 'vitest';
import {
  MAX_ADS_PER_RUN,
  AD_COOLDOWN_MS,
  newAdGateState,
  canShowAd,
  recordAdAttempt,
  isAdCapReached,
} from './ad-gatekeeper';

describe('AdGatekeeper — T-238/T-239', () => {
  it('allows the first ad immediately', () => {
    expect(canShowAd(newAdGateState(), 0)).toEqual({ allowed: true });
  });

  it('blocks within the cooldown window after an attempt', () => {
    const s = recordAdAttempt(newAdGateState(), 1000, 'completed');
    const d = canShowAd(s, 1000 + AD_COOLDOWN_MS - 1);
    expect(d.allowed).toBe(false);
    if (!d.allowed) {
      expect(d.reason).toBe('cooling_down');
      expect(d.retryAfterMs).toBe(1);
    }
  });

  it('allows again exactly at the cooldown boundary', () => {
    const s = recordAdAttempt(newAdGateState(), 1000, 'completed');
    expect(canShowAd(s, 1000 + AD_COOLDOWN_MS)).toEqual({ allowed: true });
  });

  it('starts the cooldown even on a failed attempt (no retry)', () => {
    const s = recordAdAttempt(newAdGateState(), 500, 'dismissed');
    const d = canShowAd(s, 500 + 100);
    expect(d.allowed).toBe(false);
    if (!d.allowed) expect(d.reason).toBe('cooling_down');
  });

  it('only completed attempts advance the per-run cap', () => {
    let s = newAdGateState();
    s = recordAdAttempt(s, 0, 'dismissed');
    s = recordAdAttempt(s, 0, 'timed_out');
    s = recordAdAttempt(s, 0, 'error');
    expect(s.completedThisRun).toBe(0);
    s = recordAdAttempt(s, 0, 'completed');
    expect(s.completedThisRun).toBe(1);
  });

  it('hard-caps at 3 completed ads per run, past the cooldown', () => {
    let s = newAdGateState();
    let t = 0;
    for (let i = 0; i < MAX_ADS_PER_RUN; i++) {
      expect(canShowAd(s, t).allowed).toBe(true);
      s = recordAdAttempt(s, t, 'completed');
      t += AD_COOLDOWN_MS; // skip past cooldown each time
    }
    expect(isAdCapReached(s)).toBe(true);
    const d = canShowAd(s, t);
    expect(d.allowed).toBe(false);
    if (!d.allowed) expect(d.reason).toBe('cap_reached');
  });

  it('cap takes precedence over cooldown in the decision', () => {
    let s = newAdGateState();
    for (let i = 0; i < MAX_ADS_PER_RUN; i++) s = recordAdAttempt(s, i * AD_COOLDOWN_MS, 'completed');
    // Immediately after the last attempt: both cap and cooldown would block;
    // the reason should be cap_reached.
    const d = canShowAd(s, (MAX_ADS_PER_RUN - 1) * AD_COOLDOWN_MS);
    expect(d.allowed).toBe(false);
    if (!d.allowed) expect(d.reason).toBe('cap_reached');
  });
});
