import { describe, it, expect } from 'vitest';
import { WebStorageAdapter } from './storage-web';

/** Minimal Map-backed Storage for testing without a DOM. */
function fakeStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() { return map.size; },
    clear: () => map.clear(),
    getItem: (k: string) => (map.has(k) ? map.get(k)! : null),
    setItem: (k: string, v: string) => { map.set(k, v); },
    removeItem: (k: string) => { map.delete(k); },
    key: (i: number) => [...map.keys()][i] ?? null,
  };
}

describe('WebStorageAdapter — T-223', () => {
  it('round-trips set → get', async () => {
    const s = new WebStorageAdapter(fakeStorage());
    await s.set('run.head', '{"gen":0}');
    expect(await s.get('run.head')).toBe('{"gen":0}');
  });

  it('namespaces keys under the helix prefix in the backing store', async () => {
    const backing = fakeStorage();
    const s = new WebStorageAdapter(backing);
    await s.set('foo', 'bar');
    expect(backing.getItem('helix:foo')).toBe('bar');
    expect(backing.getItem('foo')).toBeNull();
  });

  it('keys() returns un-prefixed keys, ignoring foreign entries', async () => {
    const backing = fakeStorage();
    backing.setItem('other-app:x', 'no'); // not ours
    const s = new WebStorageAdapter(backing);
    await s.set('a', '1');
    await s.set('b', '2');
    expect([...(await s.keys())].sort()).toEqual(['a', 'b']);
  });

  it('removes keys', async () => {
    const s = new WebStorageAdapter(fakeStorage());
    await s.set('k', 'v');
    await s.remove('k');
    expect(await s.get('k')).toBeNull();
  });
});
