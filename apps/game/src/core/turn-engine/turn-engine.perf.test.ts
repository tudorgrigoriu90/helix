import { describe, it, expect } from 'vitest';
import type {
  ActiveStatus,
  EnemyState,
  EntityStats,
  GridState,
  RunState,
  TileType,
} from '@shared-types/run-state';
import type { AbilityDef, AbilitySlot } from '@shared-types/ability';
import type { ItemDef } from '@shared-types/item';
import type {
  Action,
  AttackAction,
  EndTurnAction,
  MoveAction,
  Position,
  UseAbilityAction,
  UseItemAction,
  WaitAction,
} from '@shared-types/action';
import { Mulberry32 } from '../rng/mulberry32';
import { TurnEngine } from './turn-engine';

/**
 * T-69 — Turn engine performance harness.
 *
 * **TDD §5.7 budget (per-turn resolution):**
 *   - Target: <8 ms on a 2018-era Android mid-tier or iPhone X (A11)
 *   - Hard cap: <16 ms (one frame at 60 fps)
 *
 * **Why this test asserts dev-machine numbers instead of iPhone-X numbers.**
 * CI runners and dev workstations are typically 4–8× faster than A11 for
 * single-threaded JS. We can't measure on a phone from CI, so we measure on the
 * machine we have and apply a conservative speedup factor to back out a
 * meaningful regression guard. With a 4× factor:
 *
 *   - Hard cap 16 ms iPhone-X ≈ **4 ms dev**
 *   - Target  8 ms iPhone-X  ≈ **2 ms dev**
 *
 * We assert per-action **median < {@link HARD_CAP_DEV_MS} ms** as the
 * regression guard. p50/p95/max are logged on every run so a perf regression is
 * visible even if it doesn't cross the gate. If a CI runner happens to be
 * slower than our factor assumes, the threshold can be raised here — but a 4×
 * margin against the actual budget should be roomy.
 *
 * **What we measure.** Each action type is exercised against a realistic
 * mid-floor RunState (7×7 grid, 5 enemies, abilities + items + active
 * statuses). The full `endTurn` cycle — the hottest path, because it resolves
 * the enemy phase, ticks statuses, and runs outcome detection — gets its own
 * budget.
 */

// ── Tunables ─────────────────────────────────────────────────────────────────

/**
 * Hard cap for median per-action latency on a dev machine, derived from the
 * 16 ms iPhone-X budget divided by a conservative 4× dev-to-A11 speedup.
 * Raise if CI runners false-positive; lower if local headroom suggests we can.
 */
const HARD_CAP_DEV_MS = 4;

/** Samples per action — large enough for stable percentiles, small enough to keep the suite snappy. */
const ITERATIONS = 200;

// ── Helpers ──────────────────────────────────────────────────────────────────

interface PerfStats {
  readonly p50: number;
  readonly p95: number;
  readonly max: number;
  readonly mean: number;
}

function measure(fn: () => void, iterations = ITERATIONS): PerfStats {
  // Warm-up — discard first ~20 samples so V8 has time to JIT.
  for (let i = 0; i < 20; i++) fn();

  const samples = new Array<number>(iterations);
  for (let i = 0; i < iterations; i++) {
    const t0 = performance.now();
    fn();
    samples[i] = performance.now() - t0;
  }
  samples.sort((a, b) => a - b);
  const sum = samples.reduce((acc, n) => acc + n, 0);
  return {
    p50: samples[Math.floor(iterations * 0.5)]!,
    p95: samples[Math.floor(iterations * 0.95)]!,
    max: samples[iterations - 1]!,
    mean: sum / iterations,
  };
}

function fmt(stats: PerfStats): string {
  return `p50=${stats.p50.toFixed(3)}ms p95=${stats.p95.toFixed(3)}ms max=${stats.max.toFixed(3)}ms mean=${stats.mean.toFixed(3)}ms`;
}

// ── Fixtures: a realistic mid-floor RunState ─────────────────────────────────

const PLAYER_STATS: EntityStats = { str: 12, res: 8, agi: 10, int: 14 };
const ENEMY_STATS: EntityStats = { str: 8, res: 4, agi: 7, int: 5 };

function gridWithHazards(width = 7, height = 7): GridState {
  const tiles = new Array<TileType>(width * height).fill('open' as TileType);
  // A few hazards + walls + a cover tile, mirroring a typical combat room.
  tiles[0 * width + 0] = 'wall';
  tiles[1 * width + 1] = 'hazard';
  tiles[2 * width + 4] = 'cover';
  tiles[5 * width + 5] = 'hazard';
  return { width, height, tiles };
}

function enemy(id: string, pos: Position, hp = 25): EnemyState {
  return {
    id,
    enemyDefId: 'mid_floor_enemy',
    pos,
    hp,
    maxHp: 25,
    stats: ENEMY_STATS,
    statuses: [],
    telegraph: null,
  };
}

function ability(over: Partial<AbilityDef> = {}): AbilityDef {
  return {
    id: 'pressure_bolt',
    apCost: 2,
    cooldown: 3,
    range: 3,
    targetType: 'enemy',
    baseDamage: 15,
    damageType: 'pressure',
    intScaling: 0.5,
    aoeRadius: 1,
    appliesStatus: 'crushed',
    statusDuration: 2,
    ...over,
  };
}

function slot(def: AbilityDef, cooldownRemaining = 0): AbilitySlot {
  return { def, cooldownRemaining };
}

function healingPotion(): ItemDef {
  return {
    id: 'vein_serum',
    name: 'Vein Serum',
    rarity: 'common',
    category: 'consumable',
    effect: { kind: 'heal', amount: 20 },
  };
}

function midFloorState(): RunState {
  const burn: ActiveStatus = { effect: 'burn', turnsRemaining: 2 };
  const regen: ActiveStatus = { effect: 'regenerating', turnsRemaining: 2 };

  return {
    schemaVersion: 1,
    seed: 0xdeadbeef,
    floorNumber: 7,
    phase: 'player',
    turn: 12,
    grid: gridWithHazards(),
    player: {
      id: 'player',
      pos: { x: 3, y: 3 },
      hp: 60,
      maxHp: 100,
      ap: 3,
      maxAp: 3,
      stats: PLAYER_STATS,
      statuses: [regen],
      abilities: [
        slot(ability()),
        slot(ability({ id: 'spore_cloud', targetType: 'tile', aoeRadius: 2, appliesStatus: 'infected' })),
      ],
      items: [healingPotion()],
      mutations: ['abyssal_pressure_skin', 'mycelial_spore_cloud'],
    },
    enemies: [
      enemy('e1', { x: 3, y: 2 }), // adjacent — melee in reach
      enemy('e2', { x: 4, y: 3 }), // adjacent — melee in reach
      enemy('e3', { x: 5, y: 5 }, 18), // mid-range
      enemy('e4', { x: 6, y: 4 }, 30), // far
      { ...enemy('e5', { x: 2, y: 5 }), statuses: [burn] }, // already burning
    ],
  };
}

const fresh = (): { state: RunState; rng: Mulberry32 } => ({
  state: midFloorState(),
  rng: new Mulberry32(0xc0ffee),
});

function runOnce(action: Action): void {
  const { state, rng } = fresh();
  TurnEngine.apply(state, action, rng);
}

// ── Suite ────────────────────────────────────────────────────────────────────

describe(`TurnEngine perf — T-69 (TDD §5.7; dev hard cap ${HARD_CAP_DEV_MS}ms median)`, () => {
  it('move action stays inside the budget', () => {
    const move: MoveAction = { type: 'move', targetPos: { x: 3, y: 4 } };
    const stats = measure(() => runOnce(move));
    // eslint-disable-next-line no-console
    console.log(`  move:        ${fmt(stats)}`);
    expect(stats.p50).toBeLessThan(HARD_CAP_DEV_MS);
  });

  it('attack action stays inside the budget', () => {
    const attack: AttackAction = { type: 'attack', targetId: 'e1' };
    const stats = measure(() => runOnce(attack));
    // eslint-disable-next-line no-console
    console.log(`  attack:      ${fmt(stats)}`);
    expect(stats.p50).toBeLessThan(HARD_CAP_DEV_MS);
  });

  it('single-target ability stays inside the budget', () => {
    const useAbility: UseAbilityAction = {
      type: 'useAbility', abilityId: 'pressure_bolt', targetId: 'e1',
    };
    const stats = measure(() => runOnce(useAbility));
    // eslint-disable-next-line no-console
    console.log(`  ability:     ${fmt(stats)}`);
    expect(stats.p50).toBeLessThan(HARD_CAP_DEV_MS);
  });

  it('AoE tile-target ability stays inside the budget', () => {
    const useAbility: UseAbilityAction = {
      type: 'useAbility', abilityId: 'spore_cloud', targetPos: { x: 4, y: 4 },
    };
    const stats = measure(() => runOnce(useAbility));
    // eslint-disable-next-line no-console
    console.log(`  ability AoE: ${fmt(stats)}`);
    expect(stats.p50).toBeLessThan(HARD_CAP_DEV_MS);
  });

  it('useItem (heal) stays inside the budget', () => {
    const useItem: UseItemAction = { type: 'useItem', itemId: 'vein_serum' };
    const stats = measure(() => runOnce(useItem));
    // eslint-disable-next-line no-console
    console.log(`  useItem:     ${fmt(stats)}`);
    expect(stats.p50).toBeLessThan(HARD_CAP_DEV_MS);
  });

  it('wait stays inside the budget (includes full enemy phase)', () => {
    // wait defers to endPlayerTurn — same hot path as endTurn but worth measuring
    // independently to catch divergence regressions.
    const wait: WaitAction = { type: 'wait' };
    const stats = measure(() => runOnce(wait));
    // eslint-disable-next-line no-console
    console.log(`  wait:        ${fmt(stats)}`);
    expect(stats.p50).toBeLessThan(HARD_CAP_DEV_MS);
  });

  it('endTurn — the full cycle — stays inside the budget', () => {
    // Hot path: enemy phase (5 enemies decide-and-act) + status tick (burn, regen)
    // + outcome detection. If anything is going to bust the budget, this is it.
    const endTurn: EndTurnAction = { type: 'endTurn' };
    const stats = measure(() => runOnce(endTurn));
    // eslint-disable-next-line no-console
    console.log(`  endTurn:     ${fmt(stats)}`);
    expect(stats.p50).toBeLessThan(HARD_CAP_DEV_MS);
  });

  // ── Aggregate sanity guard ─────────────────────────────────────────────────
  // A single mixed-action turn round-trip (move → attack → endTurn) is the unit
  // a real player executes per turn. Asserting on this composite catches the
  // case where each action is individually fine but composing them drifts.

  it('a typical 3-action turn round-trip stays inside 3× the per-action budget', () => {
    const stats = measure(() => {
      const { state, rng } = fresh();
      const r1 = TurnEngine.apply(state, { type: 'move', targetPos: { x: 3, y: 4 } }, rng);
      const r2 = TurnEngine.apply(r1.state, { type: 'attack', targetId: 'e1' }, rng);
      TurnEngine.apply(r2.state, { type: 'endTurn' }, rng);
    });
    // eslint-disable-next-line no-console
    console.log(`  3-action turn: ${fmt(stats)}`);
    expect(stats.p50).toBeLessThan(HARD_CAP_DEV_MS * 3);
  });
});
