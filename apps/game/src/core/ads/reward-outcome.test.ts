import { describe, it, expect } from 'vitest';
import { classifyRewardOutcome } from './reward-outcome';
import type { RewardOutcome } from './ad-service';

describe('classifyRewardOutcome — T-241 (E030 ad-failed mapping)', () => {
  it('grants on a completed ad', () => {
    const o: RewardOutcome = { granted: true, result: 'completed' };
    expect(classifyRewardOutcome(o)).toBe('grant');
  });

  it('maps an ad-load timeout to the S135 ad-failed modal (E030)', () => {
    const o: RewardOutcome = { granted: false, result: 'timed_out' };
    expect(classifyRewardOutcome(o)).toBe('ad_failed');
  });

  it('maps a no-fill (unavailable) result to ad_failed', () => {
    const o: RewardOutcome = { granted: false, result: 'unavailable' };
    expect(classifyRewardOutcome(o)).toBe('ad_failed');
  });

  it('maps a generic error to ad_failed', () => {
    const o: RewardOutcome = { granted: false, result: 'error' };
    expect(classifyRewardOutcome(o)).toBe('ad_failed');
  });

  it('maps a cap-reached block to capped (E032)', () => {
    const o: RewardOutcome = { granted: false, result: 'blocked', blockReason: 'cap_reached' };
    expect(classifyRewardOutcome(o)).toBe('capped');
  });
});
