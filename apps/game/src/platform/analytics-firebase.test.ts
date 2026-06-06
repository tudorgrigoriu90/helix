import { describe, it, expect, beforeEach } from 'vitest';
import { createFirebaseAnalytics } from './analytics-firebase';
import { installAnalytics } from './analytics-bootstrap';
import { logEvent } from '../core/platform/analytics-adapter';
import { getEventLog, clearEventLog } from '../core/platform/analytics-debug-log';
import { _resetFirebaseAppForTests } from './firebase/app';

/**
 * Node test environment (no browser), so Firebase Analytics can't initialise.
 * These verify the graceful-degradation contract: the adapter factory returns
 * null and the bootstrap falls back to the console adapter, so analytics never
 * crashes the boot.
 */
describe('Firebase analytics — T-250 (non-browser fallback)', () => {
  beforeEach(() => {
    _resetFirebaseAppForTests();
    clearEventLog();
  });

  it('createFirebaseAnalytics returns null without a browser', () => {
    expect(createFirebaseAnalytics()).toBeNull();
  });

  it('installAnalytics falls back to the console adapter and still records events', () => {
    installAnalytics(); // no throw despite no browser
    logEvent('tutorial_complete', {});
    // The console adapter doesn't forward anywhere observable, but logEvent
    // always records in the debug log — proves an adapter is wired and live.
    expect(getEventLog()).toHaveLength(1);
    expect(getEventLog()[0]!.name).toBe('tutorial_complete');
  });
});
