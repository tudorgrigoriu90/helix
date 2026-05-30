import { describe, it, expect } from 'vitest';
import type { EnemyDef } from '@shared-types/enemy';
import type { FloorTemplate } from '@shared-types/floor-template';
import type { Action } from '@shared-types/action';
import type { RunState, PlayerState } from '@shared-types/run-state';
import type { MutationDef, MutationFamily } from '@shared-types/mutation';
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

// ── Strand Events (GDD §5) ──────────────────────────────────────────────────

function mut(id: string, family: MutationFamily, sigBonus = 10): MutationDef {
  return {
    id, family, tier: 'minor', name: id, sigBonus,
    modifiers: [{ kind: 'stat', stat: 'str', delta: 1 }], grantsAbility: null, lace: 'x', tags: [],
  };
}

const POOL: MutationDef[] = [
  mut('m_ab1', 'abyssal'), mut('m_ab2', 'abyssal'), mut('m_my1', 'mycelial'),
  mut('m_li1', 'lithic'), mut('m_vo1', 'voidborn'), mut('m_th1', 'thermal'),
];

function hero(mutations: string[] = []): PlayerState {
  return { ...newRunPlayer(), hp: 9999, maxHp: 9999, stats: { str: 99, res: 99, agi: 50, int: 10 }, mutations };
}

/** A session whose every floor-boss clear opens a Strand Event. */
function strandSession(seed: number, owned: string[] = []): RunSession {
  return new RunSession({
    seed, template: template(), registry, player: hero(owned),
    finalFloor: 20, mutations: POOL, strandEventEveryNFloors: 1,
  });
}

describe('RunSession — Strand Events', () => {
  it('does NOT open a Strand Event when no mutation pool is supplied', () => {
    const s = new RunSession({ seed: 4, template: template(), registry, player: hero(), finalFloor: 20 });
    autoplayFloor(s);
    expect(s.snapshot.status).toBe('floor_complete'); // old behaviour preserved
  });

  it('opens a card-draw Strand Event after clearing a qualifying boss', () => {
    const s = strandSession(4);
    autoplayFloor(s);
    expect(s.snapshot.status).toBe('strand_event');
    expect(s.beginStrandEvent()).toEqual({ kind: 'draw' });
    expect(s.strandOffer).toHaveLength(3);
  });

  it('choosing a card applies the mutation, accrues SIG, and completes the floor', () => {
    const s = strandSession(4);
    autoplayFloor(s);
    s.beginStrandEvent();
    const pick = s.strandOffer[0]!.mutation;
    s.chooseStrandMutation(pick.id);
    expect(s.snapshot.player.mutations).toContain(pick.id);
    expect(s.snapshot.sig).toBe(pick.sigBonus); // +10 from the strand pick
    expect(s.snapshot.status).toBe('floor_complete');
    s.descend();
    expect(s.snapshot.floorNumber).toBe(2);
  });

  it('reroll changes a chosen card, deterministically per seed', () => {
    const run = (): string[] => {
      const s = strandSession(11);
      autoplayFloor(s);
      s.beginStrandEvent();
      s.rerollStrandCard(0);
      return s.strandOffer.map((c) => c.mutation.id);
    };
    const a = run();
    const s2 = strandSession(11);
    autoplayFloor(s2);
    s2.beginStrandEvent();
    const before = s2.strandOffer[0]!.mutation.id;
    s2.rerollStrandCard(0);
    expect(s2.strandOffer[0]!.mutation.id).not.toBe(before); // actually rerolled
    expect(run()).toEqual(a); // identical on replay
  });

  it('the offer is deterministic for a given seed', () => {
    const offer = (): string[] => {
      const s = strandSession(21);
      autoplayFloor(s);
      s.beginStrandEvent();
      return s.strandOffer.map((c) => c.mutation.id);
    };
    expect(offer()).toEqual(offer());
  });

  it('at the 4-mutation cap the Strand Event becomes a VEIN Intermission', () => {
    const s = strandSession(4, ['m_ab1', 'm_ab2', 'm_my1', 'm_li1']); // already at cap
    autoplayFloor(s);
    expect(s.snapshot.status).toBe('strand_event');
    expect(s.beginStrandEvent()).toEqual({ kind: 'intermission', veinCrystals: 100 });
    s.acceptIntermission();
    expect(s.snapshot.veinCrystals).toBe(100);
    expect(s.snapshot.status).toBe('floor_complete');
  });

  it('descend is blocked while a Strand Event is open', () => {
    const s = strandSession(4);
    autoplayFloor(s);
    expect(() => s.descend()).toThrow(/not complete/);
  });

  it('keeps dominantTraits empty after a single pick (no family at 3 yet)', () => {
    const s = strandSession(4);
    autoplayFloor(s);
    s.beginStrandEvent();
    s.chooseStrandMutation(s.strandOffer[0]!.mutation.id);
    expect(s.snapshot.player.dominantTraits).toEqual([]);
  });

  it('activates a Dominant Trait when a third same-family mutation is taken', () => {
    const abyssalOnly = [mut('a1', 'abyssal'), mut('a2', 'abyssal'), mut('a3', 'abyssal')];
    const s = new RunSession({
      seed: 4, template: template(), registry, player: hero(['a1', 'a2']),
      finalFloor: 20, mutations: abyssalOnly, strandEventEveryNFloors: 1,
    });
    autoplayFloor(s);
    expect(s.beginStrandEvent()).toEqual({ kind: 'draw' });
    expect(s.strandOffer.map((c) => c.mutation.id)).toEqual(['a3']); // only one left to offer
    s.chooseStrandMutation('a3');
    expect(s.snapshot.player.dominantTraits).toEqual(['abyssal']); // Leviathan Core unlocked
  });

  it('persists SIG + VEIN Crystals through save/restore', () => {
    const s = strandSession(4);
    autoplayFloor(s);
    s.beginStrandEvent();
    s.chooseStrandMutation(s.strandOffer[0]!.mutation.id);
    const save = s.toSave();
    expect(save.sig).toBeGreaterThan(0);
    expect(save.schemaVersion).toBe(4);

    const resumed = new RunSession({
      seed: 4, template: template(), registry, mutations: POOL, strandEventEveryNFloors: 1,
    });
    resumed.applySave(save);
    expect(resumed.snapshot.sig).toBe(save.sig);
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
