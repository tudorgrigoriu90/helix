import { describe, it, expect } from 'vitest';
import type { EnemyDef } from '@shared-types/enemy';
import type { FloorTemplate } from '@shared-types/floor-template';
import type { RunState, PlayerState } from '@shared-types/run-state';
import type { MutationDef, MutationFamily } from '@shared-types/mutation';
import { makeRng } from '../rng/mulberry32';
import { TurnEngine, chebyshev } from '../turn-engine';
import { bfsDistances } from '../floor-gen';
import { RunSession, CURRENT_RUN_SESSION_SAVE_VERSION } from './run-session';
import { buildEnemyRegistry } from './encounter';
import { newRunPlayer } from './start-player';
import { decideResume } from './resume-decision';
import { SIG_CAP } from '../mutation';

/**
 * DR-009 descent structure — T-310 (checkpoints) + T-311 (Proto-Strand).
 *
 * Covers the act-based descent surface: S072 Descend/Rest after Strand
 * Events, checkpoint suspend/resume round-trips (save v7), the Floor 2
 * Proto-Strand reduced draw, and the shared bonus mutation slot + cap math.
 */

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
  def('pressure_warden', 'floor_boss', 60),
]);

function mut(id: string, family: MutationFamily, tier: MutationDef['tier'] = 'minor'): MutationDef {
  return {
    id, family, tier, name: id, sigBonus: 10,
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

function strandSession(seed: number, strandEvery = 1): RunSession {
  return new RunSession({
    seed, template: template(), registry, player: hero(),
    finalFloor: 20, mutations: POOL, strandEventEveryNFloors: strandEvery,
  });
}

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

function resolveCombat(initial: RunState): RunState {
  let state = initial;
  const rng = makeRng(initial.seed, 'combat');
  for (let i = 0; i < 2000 && state.phase === 'player'; i++) {
    const living = state.enemies.filter((e) => e.hp > 0);
    const adjacent = living.find((e) => chebyshev(state.player.pos, e.pos) <= 1);
    const action = living.length === 0 || state.player.ap <= 0
      ? { type: 'endTurn' as const }
      : adjacent !== undefined
        ? { type: 'attack' as const, targetId: adjacent.id }
        : {
            type: 'move' as const,
            targetPos: {
              x: state.player.pos.x + Math.sign(living[0]!.pos.x - state.player.pos.x),
              y: state.player.pos.y + Math.sign(living[0]!.pos.y - state.player.pos.y),
            },
          };
    let result = TurnEngine.apply(state, action, rng);
    if (result.errors.length > 0) result = TurnEngine.apply(state, { type: 'endTurn' }, rng);
    state = result.state;
  }
  return state;
}

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

describe('descent checkpoints — T-310 (DR-009, S072)', () => {
  function atCheckpoint(seed: number): RunSession {
    const s = strandSession(seed);
    autoplayFloor(s);
    expect(s.snapshot.status).toBe('strand_event');
    const outcome = s.beginStrandEvent();
    if (outcome.kind === 'draw') s.chooseStrandMutation(s.strandOffer[0]!.mutation.id);
    else s.acceptIntermission();
    return s;
  }

  it('every Strand Event resolution lands on the S072 checkpoint', () => {
    const s = atCheckpoint(4);
    expect(s.snapshot.status).toBe('descent_checkpoint');
  });

  it('Descend continues to the next floor', () => {
    const s = atCheckpoint(4);
    s.descend();
    expect(s.snapshot.floorNumber).toBe(2);
    expect(s.snapshot.status).toBe('exploring');
  });

  it('Rest suspends at the next floor entrance with the checkpoint marker (act + timestamp)', () => {
    const s = atCheckpoint(4);
    s.restAtCheckpoint(123_456);
    const save = s.toSave();
    expect(save.schemaVersion).toBe(CURRENT_RUN_SESSION_SAVE_VERSION);
    expect(save.floorNumber).toBe(2);
    expect(save.status).toBe('exploring'); // a fresh floor entrance, not a retry point
    expect(save.checkpoint).toEqual({ act: 1, restedAtMs: 123_456 });
  });

  it('Rest is rejected outside the checkpoint', () => {
    const s = strandSession(4);
    expect(() => s.restAtCheckpoint()).toThrow(/not at a checkpoint/);
  });

  it('resume consumes the checkpoint marker — the next save is an ordinary one', () => {
    const s = atCheckpoint(4);
    s.restAtCheckpoint(99);
    const suspended = s.toSave();

    const resumed = new RunSession({
      seed: suspended.seed, template: template(), registry,
      finalFloor: 20, mutations: POOL, strandEventEveryNFloors: 1,
    });
    resumed.applySave(suspended);
    expect(resumed.consumeCheckpointResume()).toEqual({ act: 1, restedAtMs: 99 });
    expect(resumed.consumeCheckpointResume()).toBeNull(); // consumed exactly once
    expect(resumed.toSave().checkpoint).toBeUndefined();
    expect(resumed.snapshot.floorNumber).toBe(2);
  });

  it('boot routing: checkpoint saves go to the Hub card, mid-floor saves to S100', () => {
    const s = atCheckpoint(4);
    s.restAtCheckpoint();
    expect(decideResume({ ok: true, value: s.toSave() })).toEqual({ kind: 'checkpoint' });

    const midFloor = strandSession(5);
    expect(decideResume({ ok: true, value: midFloor.toSave() }).kind).toBe('prompt');
  });

  it('snapshot exposes the act (1-based zone) for the Hub card and analytics', () => {
    const s = strandSession(7);
    expect(s.snapshot.act).toBe(1);
  });
});

describe('Proto-Strand — T-311 (DR-009b)', () => {
  /** Plays to the Floor 2 boss clear (strand cadence 5 → no Strand Event yet). */
  function toFloorTwoBossClear(seed: number): RunSession {
    const s = strandSession(seed, 5);
    autoplayFloor(s);
    expect(s.snapshot.status).toBe('floor_complete'); // floor 1: no proto, no strand
    s.descend();
    autoplayFloor(s);
    return s;
  }

  it('triggers after the Floor 2 boss clear with two Minor cards', () => {
    const s = toFloorTwoBossClear(11);
    expect(s.snapshot.status).toBe('proto_strand');
    const offer = s.beginProtoStrand();
    expect(offer).toHaveLength(2);
    for (const card of offer) {
      expect(card.mutation.tier).toBe('minor');
    }
    expect(new Set(offer.map((c) => c.mutation.id)).size).toBe(2); // distinct
  });

  it('the offer is deterministic per seed and survives a save/resume', () => {
    const s = toFloorTwoBossClear(11);
    const ids = s.beginProtoStrand().map((c) => c.mutation.id);

    const resumed = new RunSession({
      seed: s.toSave().seed, template: template(), registry,
      finalFloor: 20, mutations: POOL, strandEventEveryNFloors: 5,
    });
    resumed.applySave(s.toSave());
    expect(resumed.snapshot.status).toBe('proto_strand');
    expect(resumed.beginProtoStrand().map((c) => c.mutation.id)).toEqual(ids);
  });

  it('the pick grants +5 SIG (bonus-slot rate), fills the slot, and completes the floor — no S072', () => {
    const s = toFloorTwoBossClear(11);
    const pick = s.beginProtoStrand()[0]!.mutation;
    s.chooseProtoStrandMutation(pick.id);
    expect(s.snapshot.player.mutations).toContain(pick.id);
    expect(s.snapshot.sig).toBe(5); // flat bonus-slot rate, not the card's sigBonus
    expect(s.bonusMutationUsed).toBe(true);
    expect(s.snapshot.status).toBe('floor_complete'); // no checkpoint after the proto
  });

  it('does not trigger when the bonus slot is already spent (LACE event-room pick)', () => {
    const s = strandSession(11, 5);
    s.applyMutationChoice(POOL[0]!); // LACE event-room mutation takes the slot
    autoplayFloor(s);
    s.descend();
    autoplayFloor(s);
    expect(s.snapshot.status).toBe('floor_complete'); // proto suppressed
  });

  it('the tutorial pick does NOT consume the bonus slot', () => {
    const s = strandSession(11, 5);
    s.applyMutationChoice(POOL[0]!, 'tutorial');
    expect(s.bonusMutationUsed).toBe(false);
  });

  it('cap math: three Strand picks + the bonus slot total 35 SIG, inside the 40 cap', () => {
    // DR-007/DR-009b: 3 × +10 (strand) + 5 (bonus slot) = 35 ≤ SIG_CAP.
    const strandPicks = 3 * 10;
    const bonus = 5;
    expect(strandPicks + bonus).toBe(35);
    expect(strandPicks + bonus).toBeLessThanOrEqual(SIG_CAP);
  });

  it('a pre-v7 save (no checkpoint / bonus fields) loads with the slot free', () => {
    const s = strandSession(3, 5);
    const save = { ...s.toSave(), schemaVersion: 6 };
    const resumed = new RunSession({
      seed: save.seed, template: template(), registry,
      finalFloor: 20, mutations: POOL, strandEventEveryNFloors: 5,
    });
    resumed.applySave(save);
    expect(resumed.bonusMutationUsed).toBe(false);
    expect(resumed.consumeCheckpointResume()).toBeNull();
  });
});
