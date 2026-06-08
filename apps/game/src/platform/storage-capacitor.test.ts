import { describe, it, expect } from 'vitest';
import {
  CapacitorStorageAdapter,
  DEFAULT_LARGE_VALUE_THRESHOLD,
  type PreferencesLike,
  type FilesystemLike,
} from './storage-capacitor';

/** Map-backed fake of the Preferences slice. */
function fakePrefs(): PreferencesLike & { store: Map<string, string> } {
  const store = new Map<string, string>();
  return {
    store,
    get: ({ key }) => Promise.resolve({ value: store.has(key) ? store.get(key)! : null }),
    set: ({ key, value }) => { store.set(key, value); return Promise.resolve(); },
    remove: ({ key }) => { store.delete(key); return Promise.resolve(); },
    keys: () => Promise.resolve({ keys: [...store.keys()] }),
  };
}

/** Map-backed fake of the Filesystem slice (path → data); dir tracked separately. */
function fakeFs(): FilesystemLike & { files: Map<string, string>; dirs: Set<string> } {
  const files = new Map<string, string>();
  const dirs = new Set<string>();
  return {
    files,
    dirs,
    readFile: ({ path }) => {
      if (!files.has(path)) return Promise.reject(new Error('not found'));
      return Promise.resolve({ data: files.get(path)! });
    },
    writeFile: ({ path, data }) => { files.set(path, data); return Promise.resolve({ uri: path }); },
    deleteFile: ({ path }) => {
      if (!files.has(path)) return Promise.reject(new Error('not found'));
      files.delete(path);
      return Promise.resolve();
    },
    readdir: ({ path }) => {
      if (!dirs.has(path)) return Promise.reject(new Error('dir missing'));
      const prefix = `${path}/`;
      const names = [...files.keys()]
        .filter((p) => p.startsWith(prefix))
        .map((p) => p.slice(prefix.length));
      return Promise.resolve({ files: names.map((name) => ({ name })) });
    },
    mkdir: ({ path }) => { dirs.add(path); return Promise.resolve(); },
  };
}

const config = { directory: 'DATA', encoding: 'utf8' } as const;
const big = (): string => 'x'.repeat(DEFAULT_LARGE_VALUE_THRESHOLD + 1);

describe('CapacitorStorageAdapter — T-224', () => {
  it('round-trips a small value through Preferences', async () => {
    const prefs = fakePrefs();
    const fs = fakeFs();
    const s = new CapacitorStorageAdapter(prefs, fs, config);
    await s.set('run.head', '{"gen":0}');
    expect(await s.get('run.head')).toBe('{"gen":0}');
    expect(prefs.store.has('helix:run.head')).toBe(true);
    expect(fs.files.size).toBe(0);
  });

  it('routes a large value to the filesystem, not Preferences', async () => {
    const prefs = fakePrefs();
    const fs = fakeFs();
    const s = new CapacitorStorageAdapter(prefs, fs, config);
    const value = big();
    await s.set('run.snapshot', value);
    expect(await s.get('run.snapshot')).toBe(value);
    expect(prefs.store.size).toBe(0);
    expect(fs.files.size).toBe(1);
  });

  it('namespaces Preferences keys and percent-encodes file names', async () => {
    const prefs = fakePrefs();
    const fs = fakeFs();
    const s = new CapacitorStorageAdapter(prefs, fs, config);
    await s.set('helix.meta', 'small');
    await s.set('a/b:c', big());
    expect([...prefs.store.keys()]).toEqual(['helix:helix.meta']);
    expect([...fs.files.keys()]).toEqual(['helix/a%2Fb%3Ac.json']);
  });

  it('migrates a key between stores when its size crosses the threshold', async () => {
    const prefs = fakePrefs();
    const fs = fakeFs();
    const s = new CapacitorStorageAdapter(prefs, fs, config);
    // small → Preferences
    await s.set('k', 'small');
    expect(prefs.store.size).toBe(1);
    // grows large → moves to filesystem, leaves Preferences
    await s.set('k', big());
    expect(prefs.store.size).toBe(0);
    expect(fs.files.size).toBe(1);
    // shrinks again → moves back to Preferences, file removed
    await s.set('k', 'small-again');
    expect(prefs.store.size).toBe(1);
    expect(fs.files.size).toBe(0);
    expect(await s.get('k')).toBe('small-again');
  });

  it('keys() unions both stores; remove() clears both', async () => {
    const prefs = fakePrefs();
    const fs = fakeFs();
    const s = new CapacitorStorageAdapter(prefs, fs, config);
    await s.set('small', 'v');
    await s.set('large', big());
    expect([...(await s.keys())].sort()).toEqual(['large', 'small']);
    await s.remove('small');
    await s.remove('large');
    expect(await s.keys()).toEqual([]);
    expect(prefs.store.size).toBe(0);
    expect(fs.files.size).toBe(0);
  });

  it('get() returns null for an absent key (no file, no pref)', async () => {
    const s = new CapacitorStorageAdapter(fakePrefs(), fakeFs(), config);
    expect(await s.get('nope')).toBeNull();
  });

  it('keys() tolerates a never-created filesystem directory', async () => {
    const prefs = fakePrefs();
    const fs = fakeFs();
    const s = new CapacitorStorageAdapter(prefs, fs, config);
    await s.set('only-small', 'v');
    expect(await s.keys()).toEqual(['only-small']); // readdir rejects → ignored
  });
});
