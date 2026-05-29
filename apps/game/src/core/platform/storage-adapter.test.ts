import { describe, it, expect } from 'vitest';
import { MemoryStorageAdapter } from './storage-adapter';

describe('MemoryStorageAdapter — T-225', () => {
  it('round-trips set → get', async () => {
    const s = new MemoryStorageAdapter();
    await s.set('a', 'hello');
    expect(await s.get('a')).toBe('hello');
  });

  it('returns null for a missing key', async () => {
    expect(await new MemoryStorageAdapter().get('nope')).toBeNull();
  });

  it('overwrites on repeated set', async () => {
    const s = new MemoryStorageAdapter();
    await s.set('k', '1');
    await s.set('k', '2');
    expect(await s.get('k')).toBe('2');
  });

  it('removes keys', async () => {
    const s = new MemoryStorageAdapter();
    await s.set('k', 'v');
    await s.remove('k');
    expect(await s.get('k')).toBeNull();
    expect(s.size).toBe(0);
  });

  it('lists all keys', async () => {
    const s = new MemoryStorageAdapter();
    await s.set('a', '1');
    await s.set('b', '2');
    expect([...(await s.keys())].sort()).toEqual(['a', 'b']);
  });
});
