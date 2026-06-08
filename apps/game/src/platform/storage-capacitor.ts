import type { StorageAdapter } from '../core/platform/storage-adapter';

/**
 * Capacitor native storage adapter (T-224, TDD §10.1).
 *
 * Backs the {@link StorageAdapter} seam on iOS / Android with two native stores,
 * picked per value size:
 *
 *   - **small** values → `@capacitor/preferences` (UserDefaults / SharedPreferences).
 *     Fast key/value storage, but not meant for large blobs.
 *   - **large** values → `@capacitor/filesystem` (a file under the app Data dir).
 *     Run snapshots can grow past the comfortable Preferences size, so anything
 *     over {@link DEFAULT_LARGE_VALUE_THRESHOLD} bytes is written as a file.
 *
 * A key lives in exactly one store at a time: `set` writes the appropriate store
 * and best-effort clears the other, so a value that grows across saves migrates
 * cleanly and `get`/`keys` never see a stale duplicate.
 *
 * The two plugins are injected (narrow `*Like` slices) so this is unit-testable
 * without a native bridge — same approach as the Capacitor ads adapter (T-237).
 */

/** Values at or above this many UTF-8 bytes go to the filesystem, not Preferences. */
export const DEFAULT_LARGE_VALUE_THRESHOLD = 8192;

/** Preferences keys are namespaced under this prefix so we share the store cleanly. */
const PREFIX = 'helix:';

/** The slice of `@capacitor/preferences` this adapter depends on. */
export interface PreferencesLike {
  get(options: { key: string }): Promise<{ value: string | null }>;
  set(options: { key: string; value: string }): Promise<void>;
  remove(options: { key: string }): Promise<void>;
  keys(): Promise<{ keys: string[] }>;
}

/** The slice of `@capacitor/filesystem` this adapter depends on. */
export interface FilesystemLike {
  readFile(options: { path: string; directory?: unknown; encoding?: unknown }): Promise<{ data: string | Blob }>;
  writeFile(options: {
    path: string; data: string; directory?: unknown; encoding?: unknown; recursive?: boolean;
  }): Promise<unknown>;
  deleteFile(options: { path: string; directory?: unknown }): Promise<void>;
  readdir(options: { path: string; directory?: unknown }): Promise<{ files: { name: string }[] }>;
  mkdir(options: { path: string; directory?: unknown; recursive?: boolean }): Promise<void>;
}

export interface CapacitorStorageConfig {
  /** Filesystem `Directory` enum value to store under (e.g. `Directory.Data`). */
  readonly directory: unknown;
  /** Filesystem `Encoding` enum value for string I/O (e.g. `Encoding.UTF8`). */
  readonly encoding: unknown;
  /** Subdirectory for large-value files (default `helix`). */
  readonly subdir?: string;
  /** Byte threshold for routing to the filesystem (default {@link DEFAULT_LARGE_VALUE_THRESHOLD}). */
  readonly largeValueThreshold?: number;
}

const encoder = new TextEncoder();
const byteLength = (s: string): number => encoder.encode(s).length;

/** Filesystem-safe filename for a key: percent-encoded so dots/colons survive. */
const fileName = (key: string): string => `${encodeURIComponent(key)}.json`;
const keyFromFile = (name: string): string => decodeURIComponent(name.replace(/\.json$/, ''));

export class CapacitorStorageAdapter implements StorageAdapter {
  private readonly subdir: string;
  private readonly threshold: number;
  private dirEnsured = false;

  constructor(
    private readonly prefs: PreferencesLike,
    private readonly fs: FilesystemLike,
    private readonly config: CapacitorStorageConfig,
  ) {
    this.subdir = config.subdir ?? 'helix';
    this.threshold = config.largeValueThreshold ?? DEFAULT_LARGE_VALUE_THRESHOLD;
  }

  private filePath(key: string): string {
    return `${this.subdir}/${fileName(key)}`;
  }

  async get(key: string): Promise<string | null> {
    const fromPrefs = await this.prefs.get({ key: PREFIX + key });
    if (fromPrefs.value !== null) return fromPrefs.value;
    try {
      const file = await this.fs.readFile({
        path: this.filePath(key), directory: this.config.directory, encoding: this.config.encoding,
      });
      return typeof file.data === 'string' ? file.data : null;
    } catch {
      return null; // not present in either store
    }
  }

  async set(key: string, value: string): Promise<void> {
    if (byteLength(value) >= this.threshold) {
      await this.ensureDir();
      await this.fs.writeFile({
        path: this.filePath(key), data: value,
        directory: this.config.directory, encoding: this.config.encoding, recursive: true,
      });
      await this.removeFromPrefs(key); // migrated out of Preferences
    } else {
      await this.prefs.set({ key: PREFIX + key, value });
      await this.removeFile(key); // migrated out of the filesystem
    }
  }

  async remove(key: string): Promise<void> {
    await this.removeFromPrefs(key);
    await this.removeFile(key);
  }

  async keys(): Promise<readonly string[]> {
    const out = new Set<string>();
    const { keys } = await this.prefs.keys();
    for (const k of keys) {
      if (k.startsWith(PREFIX)) out.add(k.slice(PREFIX.length));
    }
    try {
      const { files } = await this.fs.readdir({ path: this.subdir, directory: this.config.directory });
      for (const f of files) out.add(keyFromFile(f.name));
    } catch {
      // directory not created yet → no large-value keys
    }
    return [...out];
  }

  private async ensureDir(): Promise<void> {
    if (this.dirEnsured) return;
    try {
      await this.fs.mkdir({ path: this.subdir, directory: this.config.directory, recursive: true });
    } catch {
      // already exists (or will be created by writeFile recursive) — non-fatal
    }
    this.dirEnsured = true;
  }

  private async removeFromPrefs(key: string): Promise<void> {
    await this.prefs.remove({ key: PREFIX + key });
  }

  private async removeFile(key: string): Promise<void> {
    try {
      await this.fs.deleteFile({ path: this.filePath(key), directory: this.config.directory });
    } catch {
      // no file to remove — non-fatal
    }
  }
}

/**
 * Wires the real Capacitor plugins into a {@link CapacitorStorageAdapter}.
 * Dynamically imports the native plugins so the web bundle never loads them
 * (mirrors the ads bootstrap, T-237) — only ever called on a native platform.
 */
export async function createCapacitorStorageAdapter(): Promise<StorageAdapter> {
  const { Preferences } = await import('@capacitor/preferences');
  const { Filesystem, Directory, Encoding } = await import('@capacitor/filesystem');
  return new CapacitorStorageAdapter(Preferences, Filesystem as FilesystemLike, {
    directory: Directory.Data,
    encoding: Encoding.UTF8,
  });
}
