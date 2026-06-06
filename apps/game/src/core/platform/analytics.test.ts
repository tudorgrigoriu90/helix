import { describe, it, expect, beforeEach } from 'vitest';
import { recordDebugEvent, getEventLog, clearEventLog } from './analytics-debug-log';
import { logEvent, setAnalyticsAdapter } from './analytics-adapter';
import type { AnalyticsAdapter } from './analytics-adapter';

describe('analytics-debug-log', () => {
  beforeEach(() => clearEventLog());

  it('starts empty', () => {
    expect(getEventLog()).toHaveLength(0);
  });

  it('records an event with the correct name', () => {
    recordDebugEvent('session_start', { hasActiveRun: false, lifetimeRuns: 0, consentGranted: true });
    const log = getEventLog();
    expect(log).toHaveLength(1);
    expect(log[0]!.name).toBe('session_start');
  });

  it('clears the log', () => {
    recordDebugEvent('session_start', { hasActiveRun: false, lifetimeRuns: 0, consentGranted: true });
    clearEventLog();
    expect(getEventLog()).toHaveLength(0);
  });

  it('caps at 200 entries (circular buffer)', () => {
    for (let i = 0; i < 210; i++) {
      recordDebugEvent('room_enter', { roomType: 'combat', floorNumber: i });
    }
    expect(getEventLog()).toHaveLength(200);
  });

  it('timestamps each entry', () => {
    const before = Date.now();
    recordDebugEvent('tutorial_complete', {});
    const entry = getEventLog()[0]!;
    expect(entry.ts).toBeGreaterThanOrEqual(before);
    expect(entry.ts).toBeLessThanOrEqual(Date.now());
  });

  it('records multiple event types', () => {
    recordDebugEvent('tutorial_complete', {});
    recordDebugEvent('consent_decision', { decision: 'granted' });
    const log = getEventLog();
    expect(log).toHaveLength(2);
    expect(log[0]!.name).toBe('tutorial_complete');
    expect(log[1]!.name).toBe('consent_decision');
  });
});

describe('analytics-adapter — logEvent', () => {
  beforeEach(() => clearEventLog());

  it('records in debug log even without a forwarding adapter', () => {
    logEvent('tutorial_complete', {});
    expect(getEventLog()).toHaveLength(1);
    expect(getEventLog()[0]!.name).toBe('tutorial_complete');
  });

  it('forwards to installed adapter AND records in debug log', () => {
    const received: Array<{ name: string; params: unknown }> = [];
    const adapter: AnalyticsAdapter = {
      logEvent(name, params) { received.push({ name, params }); },
    };
    setAnalyticsAdapter(adapter);

    logEvent('tutorial_complete', {});

    // Forwarded to adapter
    expect(received).toHaveLength(1);
    expect(received[0]!.name).toBe('tutorial_complete');
    // Also in debug log
    expect(getEventLog()).toHaveLength(1);
  });

  it('passes correct params to adapter', () => {
    const received: Array<unknown> = [];
    const adapter: AnalyticsAdapter = {
      logEvent(_name, params) { received.push(params); },
    };
    setAnalyticsAdapter(adapter);

    logEvent('consent_decision', { decision: 'declined' });

    expect(received[0]).toEqual({ decision: 'declined' });
  });
});
