import { describe, it, expect, vi } from 'vitest';
import { CapacitorAnalyticsAdapter, type FirebaseAnalyticsPluginLike } from './analytics-capacitor';

/** Minimal fake plugin, returning each mock fn directly so assertions stay bound. */
function fakePlugin(overrides: Partial<FirebaseAnalyticsPluginLike> = {}) {
  const logEvent = overrides.logEvent ?? vi.fn((): Promise<void> => Promise.resolve());
  const setUserId = overrides.setUserId ?? vi.fn((): Promise<void> => Promise.resolve());
  const setUserProperty = overrides.setUserProperty ?? vi.fn((): Promise<void> => Promise.resolve());
  const setCollectionEnabled =
    overrides.setCollectionEnabled ?? vi.fn((): Promise<void> => Promise.resolve());
  const plugin: FirebaseAnalyticsPluginLike = {
    logEvent,
    setUserId,
    setUserProperty,
    setCollectionEnabled,
  };
  return { plugin, logEvent, setUserId, setUserProperty };
}

describe('CapacitorAnalyticsAdapter — T-251', () => {
  it('forwards a typed event name + params to the native SDK unchanged', () => {
    const { plugin, logEvent } = fakePlugin();
    const a = new CapacitorAnalyticsAdapter(plugin);
    a.logEvent('run_start', { seed: 7, originId: 'drift', floorCount: 20, isTutorial: false });
    expect(logEvent).toHaveBeenCalledWith({
      name: 'run_start',
      params: { seed: 7, originId: 'drift', floorCount: 20, isTutorial: false },
    });
  });

  it('omits the params field for an event with no params (native rejects {})', () => {
    const { plugin, logEvent } = fakePlugin();
    const a = new CapacitorAnalyticsAdapter(plugin);
    a.logEvent('tutorial_complete', {});
    expect(logEvent).toHaveBeenCalledWith({ name: 'tutorial_complete' });
  });

  it('maps the uid user-property to the native user-id', () => {
    const { plugin, setUserId, setUserProperty } = fakePlugin();
    const a = new CapacitorAnalyticsAdapter(plugin);
    a.setUserProperty('uid', 'abc123');
    expect(setUserId).toHaveBeenCalledWith({ userId: 'abc123' });
    expect(setUserProperty).not.toHaveBeenCalled();
  });

  it('routes any other key to a native user property', () => {
    const { plugin, setUserId, setUserProperty } = fakePlugin();
    const a = new CapacitorAnalyticsAdapter(plugin);
    a.setUserProperty('cohort', 'm6');
    expect(setUserProperty).toHaveBeenCalledWith({ name: 'cohort', value: 'm6' });
    expect(setUserId).not.toHaveBeenCalled();
  });

  it('swallows a rejected native call — a dropped event never throws', () => {
    const { plugin } = fakePlugin({ logEvent: vi.fn(() => Promise.reject(new Error('bridge down'))) });
    const a = new CapacitorAnalyticsAdapter(plugin);
    expect(() => a.logEvent('strand_reroll', { floorNumber: 3 })).not.toThrow();
  });

  it('swallows a rejected setUserProperty', () => {
    const { plugin } = fakePlugin({ setUserId: vi.fn(() => Promise.reject(new Error('no consent'))) });
    const a = new CapacitorAnalyticsAdapter(plugin);
    expect(() => a.setUserProperty('uid', 'x')).not.toThrow();
  });
});
