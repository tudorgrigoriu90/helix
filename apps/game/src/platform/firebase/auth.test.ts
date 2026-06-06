import { describe, it, expect, beforeEach } from 'vitest';
import { getFirebaseApp, isBrowser, _resetFirebaseAppForTests } from './app';
import { ensureAnonymousAuth, currentUid, onUid, _resetAuthForTests } from './auth';

/**
 * These run in the node test environment (no `window`), so they verify the
 * browser-guard degradation path: every Firebase entry point must resolve to a
 * safe no-op rather than throwing, keeping the game playable offline / in tests.
 */
describe('firebase platform guards (non-browser env) — T-127', () => {
  beforeEach(() => {
    _resetFirebaseAppForTests();
    _resetAuthForTests();
  });

  it('reports a non-browser environment', () => {
    expect(isBrowser()).toBe(false);
  });

  it('getFirebaseApp returns null without a browser', () => {
    expect(getFirebaseApp()).toBeNull();
  });

  it('ensureAnonymousAuth resolves to null instead of throwing', async () => {
    await expect(ensureAnonymousAuth()).resolves.toBeNull();
  });

  it('memoises the sign-in attempt (same promise for concurrent callers)', () => {
    const a = ensureAnonymousAuth();
    const b = ensureAnonymousAuth();
    expect(a).toBe(b);
  });

  it('currentUid is null with no auth instance', () => {
    expect(currentUid()).toBeNull();
  });

  it('onUid returns a no-op unsubscribe outside a browser', () => {
    const unsub = onUid(() => { throw new Error('callback should not fire'); });
    expect(typeof unsub).toBe('function');
    expect(() => unsub()).not.toThrow();
  });
});
