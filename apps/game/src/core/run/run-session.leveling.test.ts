import { describe, it, expect } from 'vitest';
import type { FloorTemplate } from '@shared-types/floor-template';
import type { EnemyDef } from '@shared-types/enemy';
import type { EnemyState, RunState } from '@shared-types/run-state';
import { RunSession } from './run-session';
import type { EnemyRegistry } from './encounter';
import { xpForKill, levelForTotalXp } from '../economy';

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
  return new RunSession({ seed: 7, template: TEMPLATE, registry: REGISTRY });
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

function deadGrunt(i: number): EnemyState {
  return {
    id: `g${i}`,
    enemyDefId: GRUNT.id,
    pos: { x: 0, y: 0 },
    hp: 0,
    maxHp: GRUNT.maxHp,
    stats: GRUNT.stats,
    statuses: [],
    telegraph: null,
  };
}

/** A terminal combat state where `n` grunts have fallen. */
function clearedWith(combat: RunState, n: number): RunState {
  return {
    ...combat,
    enemies: Array.from({ length: n }, (_, i) => deadGrunt(i)),
    phase: 'floor_complete',
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────

describe('In-run XP & leveling — T-111 (run-loop wiring, GDD §4.3)', () => {
  it('accrues XP per kill without leveling below the threshold', () => {
    const session = newSession();
    const combat = reachCombat(session);
    session.endEncounter(clearedWith(combat, 5)); // 5 × 12 = 60 XP < 100

    const snap = session.snapshot;
    expect(snap.xp).toBe(60);
    expect(snap.level).toBe(1);
    expect(snap.pendingStatPoints).toBe(0);
  });

  it('levels up at the curve threshold, granting +10 HP and a stat point', () => {
    const session = newSession();
    const hp0 = session.snapshot.player.hp;
    const max0 = session.snapshot.player.maxHp;

    const combat = reachCombat(session);
    session.endEncounter(clearedWith(combat, 10)); // 10 × 12 = 120 XP → level 2

    const snap = session.snapshot;
    expect(snap.xp).toBe(120);
    expect(snap.level).toBe(2);
    expect(snap.pendingStatPoints).toBe(1);
    expect(snap.player.maxHp).toBe(max0 + 10);
    expect(snap.player.hp).toBe(hp0 + 10);
  });

  it('grants one stat point and +10 HP per level crossed in a single award', () => {
    const session = newSession();
    const combat = reachCombat(session);
    // 20 grunts = 240 XP → past cumulative level-3 threshold (215) = 2 levels.
    session.endEncounter(clearedWith(combat, 20));

    const snap = session.snapshot;
    expect(snap.level).toBe(levelForTotalXp(20 * xpForKill('grunt')));
    expect(snap.level).toBe(3);
    expect(snap.pendingStatPoints).toBe(2);
  });

  it('allocateStatPoint spends a point and raises the chosen stat', () => {
    const session = newSession();
    const combat = reachCombat(session);
    session.endEncounter(clearedWith(combat, 10)); // → 1 pending point
    const str0 = session.snapshot.player.stats.str;

    session.allocateStatPoint('str');
    expect(session.snapshot.player.stats.str).toBe(str0 + 1);
    expect(session.snapshot.pendingStatPoints).toBe(0);
  });

  it('allocateStatPoint throws when no points are pending', () => {
    const session = newSession();
    expect(() => session.allocateStatPoint('agi')).toThrow(/no pending stat points/);
  });

  it('XP and pending points survive save/restore; level re-derives', () => {
    const session = newSession();
    const combat = reachCombat(session);
    session.endEncounter(clearedWith(combat, 10));
    const { xp, level, pendingStatPoints } = session.snapshot;

    const restored = new RunSession({ seed: 7, template: TEMPLATE, registry: REGISTRY });
    restored.applySave(session.toSave());
    expect(restored.snapshot.xp).toBe(xp);
    expect(restored.snapshot.level).toBe(level);
    expect(restored.snapshot.pendingStatPoints).toBe(pendingStatPoints);
  });
});
