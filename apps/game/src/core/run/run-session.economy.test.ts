import { describe, it, expect } from 'vitest';
import type { FloorTemplate } from '@shared-types/floor-template';
import type { EnemyDef } from '@shared-types/enemy';
import type { RunState } from '@shared-types/run-state';
import { bfsDistances } from '../floor-gen';
import { RunSession } from './run-session';
import { buildEnemyRegistry, type EnemyRegistry } from './encounter';
import { veinForKill, FLOOR_VEIN_CONSTANT } from '../economy';

// ── Fixtures (shapes mirror run-session.test.ts) ──────────────────────────────

function template(over: Partial<FloorTemplate> = {}): FloorTemplate {
  return {
    schemaVersion: 1,
    floor: 1,
    zone: 'shallows',
    roomCount: { min: 8, max: 12 },
    roomWeights: { combat: 0.5, loot: 0.15, safe: 0.15, merchant: 0.1, trap: 0.05, lace_event: 0.05 },
    roomMinima: { safe: 1 },
    connectivity: 'branching',
    enemyPool: ['filterer', 'cave_crawler'],
    bossId: 'pressure_warden',
    aestheticTags: ['caves'],
    ...over,
  };
}

function def(id: string, tier: EnemyDef['tier'], maxHp: number): EnemyDef {
  return {
    schemaVersion: 1, id, name: id, tier, zone: 'shallows', maxHp,
    stats: { str: 6, res: 2, agi: 5, int: 2 }, damageType: 'physical', aestheticTags: ['caves'],
  };
}

const registry: EnemyRegistry = buildEnemyRegistry([
  def('filterer', 'grunt', 16),
  def('cave_crawler', 'grunt', 18),
  def('pressure_warden', 'boss', 60),
]);

function newSession(seed = 42): RunSession {
  return new RunSession({ seed, template: template(), registry, finalFloor: 20 });
}

/** VEIN the engine should award for the fallen enemies in a combat state. */
function expectedKillVein(combat: RunState): number {
  return combat.enemies.reduce((sum, e) => sum + veinForKill(registry.get(e.enemyDefId)!.tier), 0);
}

function nextTowardBoss(s: RunSession, target: string): string {
  const adj = s.adjacentRooms();
  if (adj.includes(target)) return target;
  const dist = bfsDistances(s.floor.rooms, s.floor.edges, target);
  let best = adj[0]!;
  let bestD = Infinity;
  for (const r of adj) {
    const d = dist.get(r) ?? Infinity;
    if (d < bestD) { bestD = d; best = r; }
  }
  return best;
}

/** Walk toward the boss until a room needs a fight, then begin it; returns combat. */
function forceIntoCombat(s: RunSession): RunState {
  let guard = 0;
  const target = s.floor.bossRoomId;
  while (guard++ < 100) {
    if (s.needsCombat()) {
      const st = s.beginEncounter();
      if (st !== null) return st;
    }
    s.moveTo(nextTowardBoss(s, target));
  }
  throw new Error('forceIntoCombat: never reached combat');
}

/** Marks every enemy dead and returns a terminal floor_complete state. */
function killAll(combat: RunState): RunState {
  return { ...combat, enemies: combat.enemies.map((e) => ({ ...e, hp: 0 })), phase: 'floor_complete' };
}

// ── Tests ─────────────────────────────────────────────────────────────────

describe('VEIN on combat clear — T-110 (run-loop wiring)', () => {
  it('clearing a room banks VEIN per defeated enemy (+ floor loot on a boss room)', () => {
    const s = newSession();
    const combat = forceIntoCombat(s);
    expect(combat.enemies.length).toBeGreaterThan(0);
    const isBoss = s.snapshot.currentRoomId === s.floor.bossRoomId;

    s.endEncounter(killAll(combat));
    expect(s.snapshot.veinCrystals).toBe(expectedKillVein(combat) + (isBoss ? FLOOR_VEIN_CONSTANT : 0));
  });

  it('a defeat banks no VEIN', () => {
    const s = newSession();
    const combat = forceIntoCombat(s);
    s.endEncounter({ ...combat, phase: 'defeat' });
    expect(s.snapshot.veinCrystals).toBe(0);
    expect(s.snapshot.status).toBe('defeat');
  });

  it('a full floor run banks every kill plus exactly one floor loot constant', () => {
    const s = newSession(7);
    let expected = 0;
    let guard = 0;
    while (guard++ < 200) {
      const status = s.snapshot.status;
      if (status !== 'exploring') break;
      if (s.needsCombat()) {
        const combat = s.beginEncounter()!;
        expected += expectedKillVein(combat);
        s.endEncounter(killAll(combat));
      } else {
        s.moveTo(nextTowardBoss(s, s.floor.bossRoomId));
      }
    }
    // The boss clear adds the per-floor loot constant once.
    expect(s.snapshot.status).toBe('floor_complete');
    expect(s.snapshot.veinCrystals).toBe(expected + FLOOR_VEIN_CONSTANT);
  });

  it('banked VEIN survives save/restore', () => {
    const s = newSession();
    const combat = forceIntoCombat(s);
    s.endEncounter(killAll(combat));
    const banked = s.snapshot.veinCrystals;

    const restored = new RunSession({ seed: 42, template: template(), registry, finalFloor: 20 });
    restored.applySave(s.toSave());
    expect(restored.snapshot.veinCrystals).toBe(banked);
  });
});
