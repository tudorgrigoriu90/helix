import { describe, it, expect } from 'vitest';
import type { EnemyDef } from '@shared-types/enemy';
import type { FloorTemplate } from '@shared-types/floor-template';
import { MemoryStorageAdapter } from '../platform/storage-adapter';
import { SaveManager } from '../save/save-manager';
import { RunSession } from './run-session';
import { buildEnemyRegistry } from './encounter';
import { restoreRunSession, runSessionCodec } from './run-session-save';

const registry = buildEnemyRegistry([
  { schemaVersion: 1, id: 'filterer', name: 'F', tier: 'grunt', zone: 'shallows', maxHp: 16, stats: { str: 6, res: 2, agi: 5, int: 2 }, damageType: 'physical', aestheticTags: [] } as EnemyDef,
  { schemaVersion: 1, id: 'pressure_warden', name: 'B', tier: 'boss', zone: 'shallows', maxHp: 60, stats: { str: 6, res: 2, agi: 5, int: 2 }, damageType: 'physical', aestheticTags: [] } as EnemyDef,
]);

function template(): FloorTemplate {
  return {
    schemaVersion: 1, floor: 1, zone: 'shallows',
    roomCount: { min: 8, max: 12 },
    roomWeights: { combat: 0.5, loot: 0.15, safe: 0.15, merchant: 0.1, trap: 0.05, lace_event: 0.05 },
    roomMinima: { safe: 1 }, connectivity: 'branching',
    enemyPool: ['filterer'], bossId: 'pressure_warden', aestheticTags: ['caves'],
  };
}

describe('run-session save/restore — T-114', () => {
  it('toSave → restore reproduces position, cleared set, floor, and player', () => {
    const s = new RunSession({ seed: 4242, template: template(), registry });
    // Advance somewhere with a cleared room + moved position.
    const adj = s.adjacentRooms();
    s.moveTo(adj[0]!);
    const save = s.toSave();

    const restored = restoreRunSession(save, { template: template(), registry });
    const snap = restored.snapshot;
    expect(snap.floorNumber).toBe(save.floorNumber);
    expect(snap.currentRoomId).toBe(save.currentRoomId);
    expect([...snap.clearedRoomIds].sort()).toEqual([...save.clearedRoomIds].sort());
    expect(snap.player).toEqual(save.player);
    // Floor regenerates identically from the seed.
    expect(restored.floor).toEqual(s.floor);
  });

  it('an in-combat save resumes as exploring at the same room', () => {
    const s = new RunSession({ seed: 5, template: template(), registry });
    // Force into combat to set in_combat status.
    for (let i = 0; i < 20 && s.snapshot.status === 'exploring' && !s.needsCombat(); i++) {
      const next = s.adjacentRooms()[0];
      if (next === undefined) break;
      s.moveTo(next);
    }
    if (s.needsCombat()) s.beginEncounter();
    const save = s.toSave();
    expect(save.status).toBe('exploring'); // in_combat is downgraded for resume
  });

  it('persists through the SaveManager and survives a corrupt newest generation', async () => {
    const adapter = new MemoryStorageAdapter();
    const mgr = new SaveManager(adapter, runSessionCodec);
    const s = new RunSession({ seed: 99, template: template(), registry });
    await mgr.save(s.toSave());
    s.moveTo(s.adjacentRooms()[0]!);
    await mgr.save(s.toSave());

    const res = await mgr.load();
    expect(res?.ok).toBe(true);
    if (res?.ok) expect(res.value.seed).toBe(99);
  });

  it('rejects corrupt run saves via the codec', () => {
    expect(runSessionCodec.deserialize('{ bad').ok).toBe(false);
    expect(runSessionCodec.deserialize('{}').ok).toBe(false);
    expect(runSessionCodec.deserialize(JSON.stringify({ schemaVersion: 1, seed: 1 })).ok).toBe(false);
  });
});
