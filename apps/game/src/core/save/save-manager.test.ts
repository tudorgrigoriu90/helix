import { describe, it, expect } from 'vitest';
import { MemoryStorageAdapter } from '../platform/storage-adapter';
import { SaveManager, type SaveCodec } from './save-manager';

interface Payload {
  readonly schemaVersion: number;
  readonly seed: number;
}

// A minimal codec: JSON with a structural guard, in the LoadResult shape.
const codec: SaveCodec<Payload> = {
  serialize: (v) => JSON.stringify(v),
  deserialize: (json) => {
    try {
      const p: unknown = JSON.parse(json);
      if (typeof p === 'object' && p !== null && typeof (p as Payload).seed === 'number') {
        return { ok: true, value: p as Payload };
      }
    } catch {
      // fall through
    }
    return { ok: false, error: { code: 'CORRUPT', message: 'bad payload' } };
  },
};

const make = (): SaveManager<Payload> => new SaveManager(new MemoryStorageAdapter(), codec);
const payload = (seed: number): Payload => ({ schemaVersion: 1, seed });

describe('SaveManager — T-112/T-113', () => {
  it('returns null when there is no save', async () => {
    const m = make();
    expect(await m.load()).toBeNull();
    expect(await m.has()).toBe(false);
  });

  it('saves and loads the newest payload', async () => {
    const m = make();
    await m.save(payload(111));
    await m.save(payload(222));
    const res = await m.load();
    expect(res?.ok).toBe(true);
    if (res?.ok) expect(res.value.seed).toBe(222);
    expect(await m.has()).toBe(true);
  });

  it('rotates through 3 generations (4th save overwrites the oldest)', async () => {
    const adapter = new MemoryStorageAdapter();
    const m = new SaveManager(adapter, codec);
    for (const seed of [1, 2, 3, 4]) await m.save(payload(seed));
    const res = await m.load();
    if (res?.ok) expect(res.value.seed).toBe(4);
    expect((await adapter.keys()).length).toBe(4); // 3 slots + head, not one per save
  });

  it('falls back to the previous generation when the newest is corrupt', async () => {
    const adapter = new MemoryStorageAdapter();
    const m = new SaveManager(adapter, codec);
    await m.save(payload(100)); // gen0
    await m.save(payload(200)); // gen1 (newest)
    await adapter.set('helix.run.gen1', 'CORRUPTED');
    const res = await m.load();
    expect(res?.ok).toBe(true);
    if (res?.ok) expect(res.value.seed).toBe(100); // recovered the previous generation
  });

  it('a half-written generation (no commit) does not change what loads', async () => {
    const adapter = new MemoryStorageAdapter();
    const m = new SaveManager(adapter, codec);
    await m.save(payload(7)); // committed: head → gen0
    await adapter.set('helix.run.gen1', 'PARTIAL-GARBAGE'); // interrupted write, no commit
    const res = await m.load();
    expect(res?.ok).toBe(true);
    if (res?.ok) expect(res.value.seed).toBe(7);
  });

  it('clear wipes everything', async () => {
    const adapter = new MemoryStorageAdapter();
    const m = new SaveManager(adapter, codec);
    await m.save(payload(1));
    await m.clear();
    expect(await m.load()).toBeNull();
    expect((await adapter.keys()).length).toBe(0);
  });

  it('namespaces slots so independent managers do not collide', async () => {
    const adapter = new MemoryStorageAdapter();
    const runs = new SaveManager(adapter, codec, 'helix.run');
    const metas = new SaveManager(adapter, codec, 'helix.meta');
    await runs.save(payload(1));
    await metas.save(payload(2));
    const r = await runs.load();
    const me = await metas.load();
    if (r?.ok) expect(r.value.seed).toBe(1);
    if (me?.ok) expect(me.value.seed).toBe(2);
  });
});
