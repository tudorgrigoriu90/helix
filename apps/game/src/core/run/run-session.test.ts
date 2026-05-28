import { describe, it, expect } from 'vitest';
import type { EnemyDef } from '@shared-types/enemy';
import type { FloorTemplate } from '@shared-types/floor-template';
import type { Action } from '@shared-types/action';
import type { RunState } from '@shared-types/run-state';
import { makeRng } from '../rng/mulberry32';
import { TurnEngine, chebyshev } from '../turn-engine';
import { bfsDistances } from '../floor-gen';
import { RunSession } from './run-session';
import { buildEnemyRegistry } from './encounter';
import { newRunPlayer } from './start-player';

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

const registry = buildEnemyRegistry([
  def('filterer', 'grunt', 16),
  def('cave_crawler', 'grunt', 18),
  def('pressure_warden', 'boss', 60),
]);

function session(seed: number, over: Partial<FloorTemplate> = {}, finalFloor = 20): RunSession {
  return new RunSession({ seed, template: template(over), registry, finalFloor });
}

/** A terminal RunState in the given phase, used to drive endEncounter directly. */
function terminal(phase: RunState['phase'], hp = 50): RunState {
  return {
    schemaVersion: 1, seed: 1, floorNumber: 1, phase, turn: 5,
    grid: { width: 7, height: 7, tiles: new Array(49).fill('open') },
    player: { ...newRunPlayer(), hp },
    enemies: [],
  };
}

describe('RunSession', () => {
  it('starts on floor 1 at the start room, exploring, with the start room cleared (it is safe)', () => {
    const s = session(1);
    const snap = s.snapshot;
    expect(snap.floorNumber).toBe(1);
    expect(snap.status).toBe('exploring');
    expect(snap.currentRoomId).toBe(s.floor.startRoomId);
    expect(snap.clearedRoomIds).toContain(s.floor.startRoomId);
  });

  it('exposes adjacent rooms and rejects a non-adjacent move', () => {
    const s = session(2);
    const adj = s.adjacentRooms();
    expect(adj.length).toBeGreaterThan(0);
    expect(() => s.moveTo('definitely-not-a-room')).toThrow(/not adjacent/);
    expect(() => s.moveTo(adj[0]!)).not.toThrow();
  });

  it('returns null from beginEncounter for a room with no enemies', () => {
    const s = session(3);
    // The start room is safe → no fight.
    expect(s.beginEncounter()).toBeNull();
  });

  it('carries the player and clears the room on a won encounter', () => {
    const s = session(4);
    forceIntoCombat(s); // walks toward the boss until a fight, then begins it
    expect(s.snapshot.status).toBe('in_combat');
    const room = s.snapshot.currentRoomId;
    s.endEncounter(terminal('floor_complete', 33));
    const isBoss = room === s.floor.bossRoomId;
    expect(s.snapshot.status).toBe(isBoss ? 'floor_complete' : 'exploring');
    expect(s.snapshot.player.hp).toBe(33);
    expect(s.snapshot.clearedRoomIds).toContain(room);
  });

  it('ends the run on a defeat', () => {
    const s = session(5);
    forceIntoCombat(s);
    s.endEncounter(terminal('defeat', 0));
    expect(s.snapshot.status).toBe('defeat');
  });

  it('is deterministic: same seed → identical floor layout', () => {
    const a = session(1234).floor;
    const b = session(1234).floor;
    expect(b).toEqual(a);
  });

  it('different seeds produce different floors', () => {
    const layout = (seed: number): string =>
      session(seed).floor.rooms.map((r) => `${r.id}:${r.type}`).join('|');
    expect(layout(1)).not.toBe(layout(2));
  });

  it('descends to the next floor only after the boss is cleared', () => {
    const s = session(7);
    expect(() => s.descend()).toThrow(/not complete/);
    autoplayFloor(s);
    expect(s.snapshot.status).toBe('floor_complete');
    s.descend();
    expect(s.snapshot.floorNumber).toBe(2);
    expect(s.snapshot.status).toBe('exploring');
  });

  it('wins the run when the final floor boss falls', () => {
    const s = session(8, {}, 1); // floor 1 is the final floor
    autoplayFloor(s);
    expect(s.snapshot.status).toBe('victory');
  });

  it('plays a whole floor end-to-end through the real TurnEngine', () => {
    // Overpowered player so the descent always reaches and clears the boss.
    const hero = { ...newRunPlayer(), hp: 9999, maxHp: 9999, stats: { str: 99, res: 99, agi: 50, int: 10 } };
    const s = new RunSession({ seed: 42, template: template(), registry, player: hero, finalFloor: 1 });
    autoplayFloor(s);
    expect(s.snapshot.status).toBe('victory');
    expect(s.snapshot.clearedRoomIds).toContain(s.floor.bossRoomId);
  });
});

// ── Test helpers ──────────────────────────────────────────────────────────

/** Steps into the first reachable combat room (for the defeat test). */
function forceIntoCombat(s: RunSession): void {
  for (let i = 0; i < 50 && s.snapshot.status === 'exploring'; i++) {
    if (s.needsCombat()) {
      s.beginEncounter();
      return;
    }
    const next = stepTowardBoss(s);
    if (next === undefined) break;
    s.moveTo(next);
  }
  if (s.needsCombat()) s.beginEncounter();
}

/** Greedily picks the adjacent room closest to the boss along the graph. */
function stepTowardBoss(s: RunSession): string | undefined {
  const dist = bfsDistances(s.floor.bossRoomId, s.floor.rooms, s.floor.edges);
  let best: string | undefined;
  let bestD = Infinity;
  for (const id of s.adjacentRooms()) {
    const d = dist.get(id) ?? Infinity;
    if (d < bestD) { bestD = d; best = id; }
  }
  return best;
}

/** Drives a full floor: fight when needed, otherwise step toward the boss. */
function autoplayFloor(s: RunSession): void {
  for (let i = 0; i < 500 && s.snapshot.status === 'exploring'; i++) {
    if (s.needsCombat()) {
      const rs = s.beginEncounter();
      if (rs === null) continue;
      s.endEncounter(resolveCombat(rs));
    } else {
      const next = stepTowardBoss(s);
      if (next === undefined) break;
      s.moveTo(next);
    }
  }
}

/** Runs a combat to a terminal phase with a simple melee policy. */
function resolveCombat(initial: RunState): RunState {
  let state = initial;
  const rng = makeRng(initial.seed, 'combat');
  for (let i = 0; i < 2000 && state.phase === 'player'; i++) {
    let result = TurnEngine.apply(state, chooseAction(state), rng);
    if (result.errors.length > 0) result = TurnEngine.apply(state, { type: 'endTurn' }, rng);
    state = result.state;
  }
  return state;
}

function chooseAction(state: RunState): Action {
  const { player } = state;
  const living = state.enemies.filter((e) => e.hp > 0);
  if (living.length === 0 || player.ap <= 0) return { type: 'endTurn' };
  const adjacent = living.find((e) => chebyshev(player.pos, e.pos) <= 1);
  if (adjacent) return { type: 'attack', targetId: adjacent.id };
  const target = living[0]!;
  return {
    type: 'move',
    targetPos: {
      x: player.pos.x + Math.sign(target.pos.x - player.pos.x),
      y: player.pos.y + Math.sign(target.pos.y - player.pos.y),
    },
  };
}
