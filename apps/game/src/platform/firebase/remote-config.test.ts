import { describe, it, expect, beforeEach } from 'vitest';
import {
  featureEnabled,
  initRemoteConfig,
  FEATURE_DEFAULTS,
  _resetRemoteConfigForTests,
  type FeatureFlag,
} from './remote-config';
import { _resetFirebaseAppForTests } from './app';

/**
 * Node env (no browser): Remote Config can't initialise, so these verify the
 * fail-safe contract — every flag reads as its hard `false` default and the
 * fetch resolves false instead of throwing. This is the property that keeps a
 * Remote Config outage from breaking the game (TDD §11.6).
 */
describe('Remote Config kill-switches — T-40', () => {
  beforeEach(() => {
    _resetFirebaseAppForTests();
    _resetRemoteConfigForTests();
  });

  const flags: FeatureFlag[] = [
    'feature.sigma_echoes',
    'feature.daily_signal',
    'feature.weekly_challenge',
    'feature.cloud_sync',
    'feature.leaderboards',
  ];

  it('every feature defaults to OFF in the binary', () => {
    for (const flag of flags) {
      expect(FEATURE_DEFAULTS[flag]).toBe(false);
    }
  });

  it('featureEnabled returns false for every flag without a browser', () => {
    for (const flag of flags) {
      expect(featureEnabled(flag)).toBe(false);
    }
  });

  it('initRemoteConfig resolves false (no activation) instead of throwing', async () => {
    await expect(initRemoteConfig()).resolves.toBe(false);
  });

  it('flags stay off after a failed/again no-op init', async () => {
    await initRemoteConfig();
    expect(featureEnabled('feature.cloud_sync')).toBe(false);
  });
});
