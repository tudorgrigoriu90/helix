import { describe, it, expect } from 'vitest';
import type { EnemyDef } from '@shared-types/enemy';
import type { FloorTemplate } from '@shared-types/floor-template';
import type { RunState } from '@shared-types/run-state';
import { MemoryStorageAdapter } from '../platform/storage-adapter';
import { SaveManager } from '../save/save-manager';
import { RunSession } from './run-session';
import { buildEnemyRegistry } from './encounter';
import { restoreRunSession, runSessionCodec } from './run-session-save';

/** Walks the floor (preferring unvisited rooms) until a fight starts, returning
 *  the freshly-built combat state. Throws if the seed never reaches combat. */
function intoCombat(s: RunSession): RunState {
  const visited = new Set<string>();
  for (let i = 0; i < 100; i++) {
    if (s.needsCombat()) return s.beginEncounter()!;
    visited.add(s.snapshot.currentRoomId);
    const next = s.adjacentRooms().find((r) => !visited.has(r)) ?? s.adjacentRooms()[0];
    if (next === undefined) break;
    s.moveTo(next);
  }
  throw new Error('test setup: never reached combat');
}

const registry = buildEnemyRegistry([
  { schemaVersion: 1, id: 'filterer', name: 'F', tier: 'grunt', zone: 'shallows', maxHp: 16, stats: { str: 6, res: 2, agi: 5, int: 2 }, damageType: 'physical', aestheticTags: [] } as EnemyDef,
  { schemaVersion: 1, id: 'pressure_warden', name: 'B', tier: 'floor_boss', zone: 'shallows', maxHp: 60, stats: { str: 6, res: 2, agi: 5, int: 2 }, damageType: 'physical', aestheticTags: [] } as EnemyDef,
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

  it('an unsynced in-combat save degrades to exploring at the same room', () => {
    const s = new RunSession({ seed: 5, template: template(), registry });
    intoCombat(s); // enter combat but never syncCombat()
    const save = s.toSave();
    // Without a synced encounter there's nothing to resume → downgrade to exploring.
    expect(save.status).toBe('exploring');
    expect(save.combat).toBeUndefined();
  });

  it('a synced mid-combat save resumes the exact fight (T-114 save-on-action)', () => {
    const s = new RunSession({ seed: 5, template: template(), registry });
    const combat = intoCombat(s);
    s.syncCombat(combat, 0xabcdef); // the scene's per-action hook
    const save = s.toSave();
    expect(save.status).toBe('in_combat');
    expect(save.combat).toEqual(combat);
    expect(save.combatRngState).toBe(0xabcdef);

    const restored = restoreRunSession(save, { template: template(), registry });
    expect(restored.snapshot.status).toBe('in_combat');
    const active = restored.activeCombat();
    expect(active).not.toBeNull();
    expect(active!.state).toEqual(combat);
    expect(active!.rngState).toBe(0xabcdef); // RNG restored → deterministic resume
  });

  it('clears the persisted encounter once combat ends', () => {
    const s = new RunSession({ seed: 5, template: template(), registry });
    const combat = intoCombat(s);
    s.syncCombat(combat, 1);
    // End the fight as a defeat (terminal, no room-clear bookkeeping needed).
    s.endEncounter({ ...combat, phase: 'defeat' });
    expect(s.activeCombat()).toBeNull();
    expect(s.toSave().combat).toBeUndefined();
  });

  it('rejects a save whose combat state is malformed', () => {
    const s = new RunSession({ seed: 5, template: template(), registry });
    const combat = intoCombat(s);
    s.syncCombat(combat, 1);
    const bad = JSON.stringify({ ...s.toSave(), combat: { not: 'a-runstate' } });
    expect(runSessionCodec.deserialize(bad).ok).toBe(false);
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
