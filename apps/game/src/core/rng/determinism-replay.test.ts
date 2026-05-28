import { describe, it, expect } from 'vitest';
import type { AbilityDef, AbilitySlot } from '@shared-types/ability';
import type { Action } from '@shared-types/action';
import type { ConnectivityRule, FloorTemplate } from '@shared-types/floor-template';
import type { FloorGraph } from '@shared-types/floor-graph';
import type { ItemDef } from '@shared-types/item';
import type {
  EntityStats,
  EnemyState,
  GridState,
  RunState,
  TileType,
} from '@shared-types/run-state';
import { makeRng, type RngLabel } from './mulberry32';
import { TurnEngine, chebyshev } from '../turn-engine';
import { parseFloorTemplate, placeRooms } from '../floor-gen';

// 100 fixed seeds spread across the 32-bit space.
const FIXED_SEEDS: number[] = Array.from(
  { length: 100 },
  (_, i) => ((i * 131_071 + 0xdead_beef) >>> 0), // 131071 is prime
);

// ── Canonical fingerprinting ─────────────────────────────────────────────────
// A determinism gate is only as strong as its fingerprint. We serialise with
// sorted keys so the digest depends on *values*, never on object key insertion
// order, then fold the string into a compact u32 hash (djb2 variant — same
// family as the RNG label hash, kept local so this test has no hidden coupling).

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const obj = value as Record<string, unknown>;
  const body = Object.keys(obj)
    .sort()
    .map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`)
    .join(',');
  return `{${body}}`;
}

function hashString(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = (Math.imul(h, 33) ^ s.charCodeAt(i)) >>> 0;
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

// ── Tier 1: raw RNG sub-generators (original T-30 gate) ───────────────────────

const LABELS: RngLabel[] = ['combat', 'loot', 'floorgen', 'mutationdraw', 'events'];

/** XOR-folds 2,000 draws from every sub-generator into one hex fingerprint. */
function rngFingerprint(rootSeed: number): string {
  let acc = 0;
  for (const label of LABELS) {
    const rng = makeRng(rootSeed, label);
    for (let i = 0; i < 2_000; i++) {
      acc = (acc ^ (rng.next() * 0xffff_ffff)) >>> 0;
    }
  }
  return acc.toString(16).padStart(8, '0');
}

// ── Tier 2: TurnEngine — a full headless combat run ───────────────────────────
// The RNG being deterministic is necessary but not sufficient: the property that
// actually matters for save/resume, daily seeds, and replay is that the *engine*
// consumes that RNG identically every time. We drive a real combat to a terminal
// state with a fixed, state-derived policy and fingerprint the whole trajectory
// (every action's effects + the resulting state), so a divergence anywhere in
// the run — not just the final board — trips the gate.

const PLAYER_STATS: EntityStats = { str: 12, res: 6, agi: 10, int: 14 };
const ENEMY_STATS: EntityStats = { str: 7, res: 3, agi: 7, int: 5 };

function openGrid(width = 7, height = 7): GridState {
  return { width, height, tiles: new Array<TileType>(width * height).fill('open') };
}

function ability(): AbilityDef {
  return {
    id: 'pressure_bolt',
    apCost: 2,
    cooldown: 2,
    range: 3,
    targetType: 'enemy',
    baseDamage: 10,
    damageType: 'pressure',
    intScaling: 0.5,
    aoeRadius: 1,
    appliesStatus: 'crushed',
    statusDuration: 2,
  };
}

function slot(def: AbilityDef): AbilitySlot {
  return { def, cooldownRemaining: 0 };
}

function healingSerum(): ItemDef {
  return { id: 'vein_serum', name: 'Vein Serum', rarity: 'common', category: 'consumable', effect: { kind: 'heal', amount: 25 } };
}

function combatEnemy(id: string, x: number, y: number): EnemyState {
  return {
    id,
    enemyDefId: 'replay_enemy',
    pos: { x, y },
    hp: 20,
    maxHp: 20,
    stats: ENEMY_STATS,
    statuses: [],
    telegraph: null,
  };
}

function combatFixture(rootSeed: number): RunState {
  return {
    schemaVersion: 1,
    seed: rootSeed,
    floorNumber: 3,
    phase: 'player',
    turn: 1,
    grid: openGrid(),
    player: {
      id: 'player',
      pos: { x: 3, y: 3 },
      hp: 70,
      maxHp: 70,
      ap: 3,
      maxAp: 3,
      stats: PLAYER_STATS,
      statuses: [],
      abilities: [slot(ability())],
      items: [healingSerum()],
      mutations: [],
    },
    enemies: [
      combatEnemy('e1', 0, 0),
      combatEnemy('e2', 6, 1),
      combatEnemy('e3', 1, 6),
      combatEnemy('e4', 5, 5),
    ],
  };
}

/** Lowest-id living enemy, ascending — a deterministic, state-only tie-break. */
function byId(a: EnemyState, b: EnemyState): number {
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/**
 * A fixed greedy policy: heal when low, strike an adjacent enemy, else nuke with
 * the ability if one is in range, else step toward the nearest enemy, else end
 * the turn. Purely a function of state — it adds no randomness of its own, so
 * the only entropy in the run is the engine's own RNG consumption.
 */
function chooseAction(state: RunState): Action {
  const { player } = state;
  const living = state.enemies.filter((e) => e.hp > 0).slice().sort(byId);
  if (living.length === 0 || player.ap <= 0) return { type: 'endTurn' };

  if (player.hp < 30 && player.items.some((it) => it.id === 'vein_serum')) {
    return { type: 'useItem', itemId: 'vein_serum' };
  }

  const adjacent = living.find((e) => chebyshev(player.pos, e.pos) <= 1);
  if (adjacent) return { type: 'attack', targetId: adjacent.id };

  const slot0 = player.abilities[0];
  if (slot0 && slot0.cooldownRemaining === 0 && player.ap >= slot0.def.apCost) {
    const inRange = living.find((e) => chebyshev(player.pos, e.pos) <= slot0.def.range);
    if (inRange) {
      return { type: 'useAbility', abilityId: slot0.def.id, targetId: inRange.id };
    }
  }

  const target = living[0]!;
  return {
    type: 'move',
    targetPos: {
      x: player.pos.x + Math.sign(target.pos.x - player.pos.x),
      y: player.pos.y + Math.sign(target.pos.y - player.pos.y),
    },
  };
}

/** Runs combat to a terminal phase and returns a trajectory fingerprint. */
function combatFingerprint(rootSeed: number): string {
  let state = combatFixture(rootSeed);
  const rng = makeRng(rootSeed, 'combat');
  let acc = hashString(stableStringify(state));

  // Cap guarantees termination even if the policy stalls; real runs end far
  // sooner via floor_complete or defeat.
  const MAX_ACTIONS = 2_000;
  for (let i = 0; i < MAX_ACTIONS && state.phase === 'player'; i++) {
    let result = TurnEngine.apply(state, chooseAction(state), rng);
    // A blocked/illegal policy choice (e.g. a move into an occupied tile) leaves
    // state untouched — fall back to ending the turn so the run always advances.
    if (result.errors.length > 0) {
      result = TurnEngine.apply(state, { type: 'endTurn' }, rng);
    }
    state = result.state;
    acc = hashString(`${acc}|${stableStringify(result.effects)}#${stableStringify(state)}`);
  }
  return acc;
}

// ── Tier 3: FloorGen — room placement ────────────────────────────────────────

const TOPOLOGIES: ConnectivityRule[] = ['linear', 'branching', 'loop'];

function templateFor(connectivity: ConnectivityRule): FloorTemplate {
  return {
    schemaVersion: 1,
    floor: 1,
    zone: 'shallows',
    roomCount: { min: 8, max: 14 },
    roomWeights: {
      combat: 0.4, loot: 0.2, safe: 0.15, merchant: 0.1, trap: 0.1, lace_event: 0.05,
    },
    roomMinima: { safe: 1 },
    connectivity,
    enemyPool: ['filterer', 'cave_crawler'],
    bossId: 'pressure_warden',
    aestheticTags: ['caves'],
  };
}

function floorGraphFingerprint(template: FloorTemplate, rootSeed: number): string {
  const rng = makeRng(rootSeed, 'floorgen');
  const graph: FloorGraph = placeRooms(template, rng);
  return hashString(stableStringify(graph));
}

// ─────────────────────────────────────────────────────────────────────────────

describe('determinism replay gate — 100 fixed seeds (T-30)', () => {
  it('RNG sub-generators: identical output on repeated runs', () => {
    expect(FIXED_SEEDS.map(rngFingerprint)).toEqual(FIXED_SEEDS.map(rngFingerprint));
  });

  it('RNG sub-generators: output is independent of evaluation order', () => {
    const forward = FIXED_SEEDS.map(rngFingerprint);
    const reversed = [...FIXED_SEEDS].reverse().map(rngFingerprint).reverse();
    expect(reversed).toEqual(forward);
  });
});

describe('determinism replay gate — TurnEngine headless run', () => {
  it('a full combat run replays bit-identical from the same seed', () => {
    expect(FIXED_SEEDS.map(combatFingerprint)).toEqual(FIXED_SEEDS.map(combatFingerprint));
  });

  it('combat fingerprints do not depend on evaluation order (no cross-run state leak)', () => {
    const forward = FIXED_SEEDS.map(combatFingerprint);
    const reversed = [...FIXED_SEEDS].reverse().map(combatFingerprint).reverse();
    expect(reversed).toEqual(forward);
  });

  it('different seeds produce different runs (the fixture is not RNG-blind)', () => {
    // Sanity guard: if the engine ignored its RNG, every seed would collapse to
    // one fingerprint and the gate above would pass vacuously. Demand spread.
    const distinct = new Set(FIXED_SEEDS.map(combatFingerprint));
    expect(distinct.size).toBeGreaterThan(1);
  });

  it('replaying a captured action log reproduces the exact final state', () => {
    // The save/resume contract: seed + action log → identical RunState. Capture a
    // run, then replay the recorded actions through a fresh engine + fresh RNG.
    const seed = 0x1234_5678;
    const capture = (): { actions: Action[]; finalHash: string } => {
      let state = combatFixture(seed);
      const rng = makeRng(seed, 'combat');
      const actions: Action[] = [];
      for (let i = 0; i < 2_000 && state.phase === 'player'; i++) {
        const action = chooseAction(state);
        let result = TurnEngine.apply(state, action, rng);
        const applied: Action = result.errors.length > 0 ? { type: 'endTurn' } : action;
        if (result.errors.length > 0) result = TurnEngine.apply(state, applied, rng);
        actions.push(applied);
        state = result.state;
      }
      return { actions, finalHash: hashString(stableStringify(state)) };
    };

    const { actions, finalHash } = capture();

    let state = combatFixture(seed);
    const rng = makeRng(seed, 'combat');
    for (const action of actions) {
      state = TurnEngine.apply(state, action, rng).state;
    }
    expect(hashString(stableStringify(state))).toBe(finalHash);
  });
});

describe('determinism replay gate — FloorGen room placement', () => {
  it('every (seed, topology) places an identical graph on repeat', () => {
    const run = (): string[] =>
      FIXED_SEEDS.flatMap((seed) =>
        TOPOLOGIES.map((topo) => floorGraphFingerprint(templateFor(topo), seed)),
      );
    expect(run()).toEqual(run());
  });

  it('floor placement is independent of evaluation order', () => {
    const forward = FIXED_SEEDS.map((seed) => floorGraphFingerprint(templateFor('branching'), seed));
    const reversed = [...FIXED_SEEDS]
      .reverse()
      .map((seed) => floorGraphFingerprint(templateFor('branching'), seed))
      .reverse();
    expect(reversed).toEqual(forward);
  });

  it('different seeds branch differently (placement actually consumes RNG)', () => {
    const distinct = new Set(
      FIXED_SEEDS.map((seed) => floorGraphFingerprint(templateFor('branching'), seed)),
    );
    expect(distinct.size).toBeGreaterThan(1);
  });

  it('the shipped Floor 1 fixture places deterministically', () => {
    const parsed = parseFloorTemplate(templateFor('branching') as unknown as Record<string, unknown>);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const run = (): string[] =>
      FIXED_SEEDS.map((seed) => floorGraphFingerprint(parsed.template, seed));
    expect(run()).toEqual(run());
  });
});
