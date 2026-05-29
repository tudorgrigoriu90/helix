import { describe, it, expect } from 'vitest';
import type { RunState } from '@shared-types/run-state';
import { MemoryStorageAdapter } from '../platform/storage-adapter';
import { SaveManager } from './save-manager';

function runState(seed: number): RunState {
  return {
    schemaVersion: 1,
    seed,
    floorNumber: 1,
    phase: 'player',
    turn: 1,
    grid: { width: 2, height: 1, tiles: ['open', 'open'] },
    player: {
      id: 'player', pos: { x: 0, y: 0 }, hp: 80, maxHp: 80, ap: 3, maxAp: 3,
      stats: { str: 10, res: 6, agi: 8, int: 8 }, statuses: [], abilities: [], items: [], mutations: [],
    },
    enemies: [],
  };
}

describe('SaveManager — T-112/T-113', () => {
  it('returns null when there is no save', async () => {
    const m = new SaveManager(new MemoryStorageAdapter());
    expect(await m.loadRun()).toBeNull();
    expect(await m.hasRun()).toBe(false);
  });

  it('saves and loads the newest run', async () => {
    const m = new SaveManager(new MemoryStorageAdapter());
    await m.saveRun(runState(111));
    await m.saveRun(runState(222));
    const res = await m.loadRun();
    expect(res?.ok).toBe(true);
    if (res?.ok) expect(res.state.seed).toBe(222);
    expect(await m.hasRun()).toBe(true);
  });

  it('rotates through 3 generations (4th save overwrites the oldest)', async () => {
    const adapter = new MemoryStorageAdapter();
    const m = new SaveManager(adapter);
    for (const seed of [1, 2, 3, 4]) await m.saveRun(runState(seed));
    const res = await m.loadRun();
    if (res?.ok) expect(res.state.seed).toBe(4); // head follows the latest commit
    // Only the 3 generation slots + head exist — not a slot per save.
    expect((await adapter.keys()).length).toBe(4);
  });

  it('falls back to the previous generation when the newest is corrupt', async () => {
    const adapter = new MemoryStorageAdapter();
    const m = new SaveManager(adapter);
    await m.saveRun(runState(100)); // gen0
    await m.saveRun(runState(200)); // gen1 (newest)
    await adapter.set('helix.run.gen1', 'CORRUPTED');
    const res = await m.loadRun();
    expect(res?.ok).toBe(true);
    if (res?.ok) expect(res.state.seed).toBe(100); // recovered the previous generation
  });

  it('a half-written generation (no commit) does not change what loads', async () => {
    const adapter = new MemoryStorageAdapter();
    const m = new SaveManager(adapter);
    await m.saveRun(runState(7)); // committed: head → gen0
    // Simulate an interrupted write to the next slot without a head commit.
    await adapter.set('helix.run.gen1', 'PARTIAL-GARBAGE');
    const res = await m.loadRun();
    expect(res?.ok).toBe(true);
    if (res?.ok) expect(res.state.seed).toBe(7); // head still points at the intact gen0
  });

  it('clearRun wipes everything', async () => {
    const adapter = new MemoryStorageAdapter();
    const m = new SaveManager(adapter);
    await m.saveRun(runState(1));
    await m.clearRun();
    expect(await m.loadRun()).toBeNull();
    expect((await adapter.keys()).length).toBe(0);
  });
});
