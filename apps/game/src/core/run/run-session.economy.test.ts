import { describe, it, expect } from 'vitest';
import type { FloorTemplate } from '@shared-types/floor-template';
import type { EnemyDef } from '@shared-types/enemy';
import type { RunState } from '@shared-types/run-state';
import { RunSession } from './run-session';
import type { EnemyRegistry } from './encounter';
import { veinForKill, FLOOR_VEIN_CONSTANT } from '../economy';

// ── Fixtures ────────────────────────────────────────────────────────────────

const GRUNT: EnemyDef = {
  id: 'enemy.grunt',
  tier: 'grunt',
  archetype: 'swarmer',
  name: 'Grunt',
  maxHp: 10,
  stats: { str: 5, res: 0, agi: 0, int: 0 },
  abilities: [],
};

const REGISTRY: EnemyRegistry = {
  get: (id) => (id === GRUNT.id ? GRUNT : undefined),
};

const TEMPLATE: FloorTemplate = {
  seed: 1,
  floor: 1,
  zone: 1,
  roomCount: 6,
  enemyTiers: ['grunt'],
  itemPool: [],
  hazardDensity: 0,
};

function newSession(): RunSession {
  return new RunSession({ seed: 42, template: TEMPLATE, registry: REGISTRY });
}

/** Marks every enemy dead and hands a terminal floor_complete state back. */
function killAll(combat: RunState): RunState {
  return {
    ...combat,
    enemies: combat.enemies.map((e) => ({ ...e, hp: 0 })),
    phase: 'floor_complete',
  };
}

/** Walks to the first room that needs a fight; returns its combat state. */
function reachCombat(session: RunSession): RunState {
  let guard = 0;
  while (guard++ < 50) {
    if (session.needsCombat()) {
      const combat = session.beginEncounter();
      if (combat !== null) return combat;
    }
    const next = session.adjacentRooms().find((r) => !session.snapshot.clearedRoomIds.includes(r))
      ?? session.adjacentRooms()[0];
    if (next === undefined) break;
    session.moveTo(next);
  }
  throw new Error('reachCombat: no combat room found');
}

// ── Tests ─────────────────────────────────────────────────────────────────

describe('VEIN on combat clear — T-110 (run-loop wiring)', () => {
  it('clearing a room banks VEIN per defeated grunt', () => {
    const session = newSession();
    const combat = reachCombat(session);
    const n = combat.enemies.length;
    expect(n).toBeGreaterThan(0);

    session.endEncounter(killAll(combat));
    expect(session.snapshot.veinCrystals).toBe(n * veinForKill('grunt'));
  });

  it('does not bank the floor loot constant for a non-boss room', () => {
    const session = newSession();
    const combat = reachCombat(session);
    // A non-boss combat room: VEIN is exactly the kill payout, no +50 loot constant.
    if (session.currentRoom().id !== session.floor.bossRoomId) {
      session.endEncounter(killAll(combat));
      expect(session.snapshot.veinCrystals).toBe(combat.enemies.length * veinForKill('grunt'));
    }
  });

  it('a full floor clear banks kills + the per-floor loot constant', () => {
    const session = newSession();
    let expectedKillVein = 0;
    let guard = 0;
    while (guard++ < 200) {
      const snap = session.snapshot;
      if (snap.status === 'floor_complete' || snap.status === 'victory' || snap.status === 'strand_event') break;
      if (snap.status !== 'exploring') break;
      if (session.needsCombat()) {
        const combat = session.beginEncounter()!;
        expectedKillVein += combat.enemies.length * veinForKill('grunt');
        session.endEncounter(killAll(combat));
      } else {
        const next = session.adjacentRooms().find((r) => !session.snapshot.clearedRoomIds.includes(r))
          ?? session.adjacentRooms()[0];
        if (next === undefined) break;
        session.moveTo(next);
      }
    }
    expect(session.snapshot.veinCrystals).toBe(expectedKillVein + FLOOR_VEIN_CONSTANT);
  });

  it('a defeat banks no VEIN', () => {
    const session = newSession();
    const combat = reachCombat(session);
    session.endEncounter({ ...combat, phase: 'defeat' });
    expect(session.snapshot.veinCrystals).toBe(0);
    expect(session.snapshot.status).toBe('defeat');
  });

  it('banked VEIN survives save/restore', () => {
    const session = newSession();
    const combat = reachCombat(session);
    session.endEncounter(killAll(combat));
    const banked = session.snapshot.veinCrystals;

    const restored = new RunSession({ seed: 42, template: TEMPLATE, registry: REGISTRY });
    restored.applySave(session.toSave());
    expect(restored.snapshot.veinCrystals).toBe(banked);
  });
});
