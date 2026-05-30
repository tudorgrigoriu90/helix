import { describe, it, expect } from 'vitest';
import type { FloorTemplate } from '@shared-types/floor-template';
import type { EnemyDef } from '@shared-types/enemy';
import type { EnemyState, PlayerState, RunState } from '@shared-types/run-state';
import { bfsDistances } from '../floor-gen';
import { RunSession } from './run-session';
import { buildEnemyRegistry, type EnemyRegistry } from './encounter';
import { newRunPlayer } from './start-player';
import { xpForKill, levelForTotalXp } from '../economy';

// ── Fixtures ────────────────────────────────────────────────────────────────

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

function newSession(seed = 7): RunSession {
  return new RunSession({ seed, template: template(), registry, finalFloor: 20 });
}

function nextTowardBoss(s: RunSession, target: string): string {
  const adj = s.adjacentRooms();
  if (adj.includes(target)) return target;
  const dist = bfsDistances(target, s.floor.rooms, s.floor.edges);
  let best = adj[0]!;
  let bestD = Infinity;
  for (const r of adj) {
    const d = dist.get(r) ?? Infinity;
    if (d < bestD) { bestD = d; best = r; }
  }
  return best;
}

/** Enter combat (status → in_combat) so a terminal result can be applied. */
function enterCombat(s: RunSession): void {
  let guard = 0;
  const target = s.floor.bossRoomId;
  while (guard++ < 100) {
    if (s.needsCombat() && s.beginEncounter() !== null) return;
    s.moveTo(nextTowardBoss(s, target));
  }
  throw new Error('enterCombat: never reached combat');
}

function deadGrunt(i: number): EnemyState {
  return {
    id: `g${i}`, enemyDefId: 'filterer', pos: { x: 0, y: 0 },
    hp: 0, maxHp: 16, stats: { str: 6, res: 2, agi: 5, int: 2 }, statuses: [], telegraph: null,
  };
}

/** A terminal floor_complete state where `n` grunts fell, carrying `player`. */
function clearedWith(n: number, player: PlayerState): RunState {
  return {
    schemaVersion: 1, seed: 1, floorNumber: 1, phase: 'floor_complete', turn: 5,
    grid: { width: 7, height: 7, tiles: new Array(49).fill('open') },
    player,
    enemies: Array.from({ length: n }, (_, i) => deadGrunt(i)),
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────

describe('In-run XP & leveling — T-111 (run-loop wiring, GDD §4.3)', () => {
  it('accrues XP per kill without leveling below the threshold', () => {
    const s = newSession();
    enterCombat(s);
    s.endEncounter(clearedWith(5, newRunPlayer())); // 5 × 12 = 60 < 100

    const snap = s.snapshot;
    expect(snap.xp).toBe(5 * xpForKill('grunt'));
    expect(snap.level).toBe(1);
    expect(snap.pendingStatPoints).toBe(0);
  });

  it('levels up at the curve threshold: +10 HP and one stat point', () => {
    const s = newSession();
    const base = newRunPlayer();
    enterCombat(s);
    s.endEncounter(clearedWith(10, base)); // 10 × 12 = 120 → level 2

    const snap = s.snapshot;
    expect(snap.xp).toBe(120);
    expect(snap.level).toBe(2);
    expect(snap.pendingStatPoints).toBe(1);
    expect(snap.player.maxHp).toBe(base.maxHp + 10);
    expect(snap.player.hp).toBe(base.hp + 10);
  });

  it('grants one stat point and +10 HP per level crossed in a single award', () => {
    const s = newSession();
    enterCombat(s);
    s.endEncounter(clearedWith(20, newRunPlayer())); // 240 XP → level 3 (cum. 215)

    const snap = s.snapshot;
    expect(snap.level).toBe(levelForTotalXp(20 * xpForKill('grunt')));
    expect(snap.level).toBe(3);
    expect(snap.pendingStatPoints).toBe(2);
  });

  it('allocateStatPoint spends a point and raises the chosen stat', () => {
    const s = newSession();
    const base = newRunPlayer();
    enterCombat(s);
    s.endEncounter(clearedWith(10, base)); // → 1 pending point

    s.allocateStatPoint('str');
    expect(s.snapshot.player.stats.str).toBe(base.stats.str + 1);
    expect(s.snapshot.pendingStatPoints).toBe(0);
  });

  it('allocateStatPoint throws when no points are pending', () => {
    const s = newSession();
    expect(() => s.allocateStatPoint('agi')).toThrow(/no pending stat points/);
  });

  it('XP and pending points survive save/restore; level re-derives', () => {
    const s = newSession();
    enterCombat(s);
    s.endEncounter(clearedWith(10, newRunPlayer()));
    const { xp, level, pendingStatPoints } = s.snapshot;

    const restored = new RunSession({ seed: 7, template: template(), registry, finalFloor: 20 });
    restored.applySave(s.toSave());
    expect(restored.snapshot.xp).toBe(xp);
    expect(restored.snapshot.level).toBe(level);
    expect(restored.snapshot.pendingStatPoints).toBe(pendingStatPoints);
  });
});
