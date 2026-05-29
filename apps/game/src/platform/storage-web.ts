import type { StorageAdapter } from '../core/platform/storage-adapter';
import { MemoryStorageAdapter } from '../core/platform/storage-adapter';

/**
 * Web storage adapter (T-223). Backs the {@link StorageAdapter} with a
 * `Storage` (localStorage), namespacing keys so it shares the origin cleanly.
 * Saves are small, so synchronous localStorage is plenty for the prototype;
 * swapping to IndexedDB via `idb-keyval` later is a drop-in behind this seam.
 *
 * Takes the `Storage` by constructor so it's testable without a DOM; use
 * {@link createWebStorageAdapter} to wire the real localStorage (falling back to
 * in-memory when none exists, e.g. SSR/tests).
 */

const PREFIX = 'helix:';

export class WebStorageAdapter implements StorageAdapter {
  constructor(private readonly store: Storage) {}

  get(key: string): Promise<string | null> {
    return Promise.resolve(this.store.getItem(PREFIX + key));
  }

  set(key: string, value: string): Promise<void> {
    this.store.setItem(PREFIX + key, value);
    return Promise.resolve();
  }

  remove(key: string): Promise<void> {
    this.store.removeItem(PREFIX + key);
    return Promise.resolve();
  }

  keys(): Promise<readonly string[]> {
    const out: string[] = [];
    for (let i = 0; i < this.store.length; i++) {
      const k = this.store.key(i);
      if (k !== null && k.startsWith(PREFIX)) out.push(k.slice(PREFIX.length));
    }
    return Promise.resolve(out);
  }
}

/** Real localStorage adapter, or an in-memory fallback when storage is unavailable. */
export function createWebStorageAdapter(): StorageAdapter {
  const g = globalThis as unknown as { localStorage?: Storage };
  return g.localStorage !== undefined ? new WebStorageAdapter(g.localStorage) : new MemoryStorageAdapter();
}
