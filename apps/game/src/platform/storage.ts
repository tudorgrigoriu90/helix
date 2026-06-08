import { Capacitor } from '@capacitor/core';
import type { StorageAdapter } from '../core/platform/storage-adapter';
import { createWebStorageAdapter } from './storage-web';
import { createCapacitorStorageAdapter } from './storage-capacitor';

/**
 * Platform storage selector (T-224). Picks the right {@link StorageAdapter} for
 * the runtime: the Capacitor native adapter (Preferences + Filesystem) on
 * iOS / Android, the localStorage-backed web adapter everywhere else.
 *
 * The native adapter needs a dynamic import (async), so the app resolves it
 * once at boot via {@link initStorageAdapter} (GameBootScene already boots
 * async) and caches it; later scenes read the resolved adapter synchronously
 * via {@link getStorageAdapter}.
 */

let cached: StorageAdapter | null = null;

/**
 * Resolves and caches the platform adapter. Called once at boot, before any
 * scene needs storage. Native → Capacitor; web → localStorage.
 */
export async function initStorageAdapter(): Promise<StorageAdapter> {
  if (cached !== null) return cached;
  cached = Capacitor.isNativePlatform()
    ? await createCapacitorStorageAdapter()
    : createWebStorageAdapter();
  return cached;
}

/**
 * Returns the adapter resolved at boot. Falls back to the (always-synchronous)
 * web adapter if called before {@link initStorageAdapter} — which shouldn't
 * happen, since the boot scene initialises it first.
 */
export function getStorageAdapter(): StorageAdapter {
  if (cached === null) cached = createWebStorageAdapter();
  return cached;
}

/** Test hook: clears the cached adapter so the next init re-selects. */
export function resetStorageAdapterForTest(): void {
  cached = null;
}
