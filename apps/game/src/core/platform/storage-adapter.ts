/**
 * Storage adapter — the platform-agnostic key→string persistence seam (T-222,
 * TDD §10). The save layer (SaveManager) talks only to this interface, so the
 * same save logic runs against IndexedDB/localStorage on web, Capacitor
 * Preferences/Filesystem on native (T-223/T-224), and an in-memory map in tests.
 *
 * Values are strings (serialised JSON) — the adapter is dumb storage; schema and
 * rotation live above it. All methods are async so native backends fit.
 */
export interface StorageAdapter {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  remove(key: string): Promise<void>;
  /** All keys currently present, in unspecified order. */
  keys(): Promise<readonly string[]>;
}

/**
 * In-memory adapter — the test double (T-225) and a safe default when no
 * persistent backend is available. Deterministic and synchronous under the hood.
 */
export class MemoryStorageAdapter implements StorageAdapter {
  private readonly store = new Map<string, string>();

  get(key: string): Promise<string | null> {
    return Promise.resolve(this.store.has(key) ? this.store.get(key)! : null);
  }

  set(key: string, value: string): Promise<void> {
    this.store.set(key, value);
    return Promise.resolve();
  }

  remove(key: string): Promise<void> {
    this.store.delete(key);
    return Promise.resolve();
  }

  keys(): Promise<readonly string[]> {
    return Promise.resolve([...this.store.keys()]);
  }

  /** Test helper: current entry count. */
  get size(): number {
    return this.store.size;
  }
}
