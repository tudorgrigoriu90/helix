import { describe, it, expect } from 'vitest';
import type { ActiveStatus, EntityStats, RunState } from '@shared-types/run-state';
import { Mulberry32 } from '../rng/mulberry32';
import { TurnEngine } from './turn-engine';
import {
  damageTakenMultiplier,
  damageTo,
  effectiveMaxAp,
  effectiveRes,
  hasDominantTrait,
  isImmobilized,
} from './effective-stats';

const stats: EntityStats = { str: 10, res: 6, agi: 8, int: 8 };
const st = (effect: ActiveStatus['effect']): ActiveStatus => ({ effect, turnsRemaining: 2 });

describe('effective-stats — modifier layer (T-65 deferred half)', () => {
  it('Infected drops effective RES by 5 (floored at 0)', () => {
    expect(effectiveRes({ stats, statuses: [] })).toBe(6);
    expect(effectiveRes({ stats, statuses: [st('infected')] })).toBe(1);
    expect(effectiveRes({ stats: { ...stats, res: 3 }, statuses: [st('infected')] })).toBe(0);
  });

  it('Fractured multiplies incoming damage by 1.2', () => {
    expect(damageTakenMultiplier({ stats, statuses: [] })).toBe(1);
    expect(damageTakenMultiplier({ stats, statuses: [st('fractured')] })).toBe(1.2);
  });

  it('Stagger drops effective max AP by 1 (floored at 0)', () => {
    expect(effectiveMaxAp({ maxAp: 3, statuses: [] })).toBe(3);
    expect(effectiveMaxAp({ maxAp: 3, statuses: [st('stagger')] })).toBe(2);
    expect(effectiveMaxAp({ maxAp: 0, statuses: [st('stagger')] })).toBe(0);
  });

  it('Rooted and Crushed both immobilise', () => {
    expect(isImmobilized({ stats, statuses: [] })).toBe(false);
    expect(isImmobilized({ stats, statuses: [st('rooted')] })).toBe(true);
    expect(isImmobilized({ stats, statuses: [st('crushed')] })).toBe(true);
  });

  it('Fortress Form (Lithic dominant) adds +10 effective RES', () => {
    expect(effectiveRes({ stats, statuses: [], dominantTraits: ['lithic'] })).toBe(16); // 6 + 10
    expect(effectiveRes({ stats, statuses: [], dominantTraits: ['thermal'] })).toBe(6); // other family → no bonus
    // Stacks with the Infected penalty: 6 − 5 + 10 = 11.
    expect(effectiveRes({ stats, statuses: [st('infected')], dominantTraits: ['lithic'] })).toBe(11);
  });

  it('Combustion Engine (Thermal dominant) adds +2 effective max AP', () => {
    expect(effectiveMaxAp({ maxAp: 3, statuses: [], dominantTraits: ['thermal'] })).toBe(5);
    expect(effectiveMaxAp({ maxAp: 3, statuses: [], dominantTraits: ['lithic'] })).toBe(3);
    // Net with Stagger: 3 − 1 + 2 = 4.
    expect(effectiveMaxAp({ maxAp: 3, statuses: [st('stagger')], dominantTraits: ['thermal'] })).toBe(4);
  });

  it('hasDominantTrait reads the precomputed families (default none)', () => {
    expect(hasDominantTrait({ dominantTraits: ['lithic'] }, 'lithic')).toBe(true);
    expect(hasDominantTrait({ dominantTraits: ['lithic'] }, 'thermal')).toBe(false);
    expect(hasDominantTrait({}, 'lithic')).toBe(false);
  });

  it('damageTo composes effective RES then the fractured multiplier', () => {
    const plain = { stats, statuses: [] };
    expect(damageTo(plain, 20, 'physical')).toBe(14); // 20 - 6
    expect(damageTo({ stats, statuses: [st('infected')] }, 20, 'physical')).toBe(19); // 20 - 1
    expect(damageTo({ stats, statuses: [st('fractured')] }, 20, 'physical')).toBe(Math.floor(14 * 1.2)); // 16
    expect(damageTo(plain, 20, 'true')).toBe(20); // true ignores RES
    expect(damageTo(plain, 4, 'physical')).toBe(1); // RES (6) > 4, but the chip floor lands 1
    expect(damageTo(plain, 0, 'physical')).toBe(0); // a non-damaging call stays a no-op (no phantom chip)
  });

  it('typed resists stack additively across sources, capped at 100 (T-306/T-307)', () => {
    const stacked = {
      stats, statuses: [],
      resists: [
        { damageType: 'pressure' as const, percent: 15 }, // Origin
        { damageType: 'pressure' as const, percent: 10 }, // strain
      ],
    };
    // 26 raw − 6 RES = 20, then −25% = 15.
    expect(damageTo(stacked, 26, 'pressure')).toBe(15);
    // Other types are untouched by the pressure entries.
    expect(damageTo(stacked, 26, 'thermal')).toBe(20);
  });

  it('a summed 100% resist is full immunity — the one case the chip floor yields (T-307)', () => {
    const immune = {
      stats, statuses: [],
      resists: [{ damageType: 'thermal' as const, percent: 100, throughFloor: 5 }],
    };
    expect(damageTo(immune, 50, 'thermal')).toBe(0); // no chip damage through immunity
    expect(damageTo(immune, 50, 'physical')).toBe(44); // unrelated types unaffected
    expect(damageTo(immune, 50, 'true')).toBe(50); // 'true' stays beyond resists
  });
});

// ── Integration through the real TurnEngine ──────────────────────────────────

function combatState(over: Partial<RunState> = {}): RunState {
  return {
    schemaVersion: 1,
    seed: 1,
    floorNumber: 1,
    phase: 'player',
    turn: 1,
    grid: { width: 7, height: 7, tiles: new Array(49).fill('open') },
    player: {
      id: 'player', pos: { x: 3, y: 3 }, hp: 80, maxHp: 80, ap: 3, maxAp: 3,
      stats: { str: 10, res: 6, agi: 8, int: 8 }, statuses: [], abilities: [], items: [], mutations: [],
    },
    enemies: [
      { id: 'e1', enemyDefId: 'grunt', pos: { x: 3, y: 2 }, hp: 50, maxHp: 50, stats: { str: 12, res: 6, agi: 4, int: 2 }, statuses: [], telegraph: null },
    ],
    ...over,
  };
}

describe('effective-stats — TurnEngine integration', () => {
  it('an infected enemy takes more from a basic attack', () => {
    const base = combatState();
    const infected = combatState({
      enemies: [{ ...combatState().enemies[0]!, statuses: [st('infected')] }],
    });
    const rng = (): Mulberry32 => new Mulberry32(0xabc); // same seed → same crit roll
    const a = TurnEngine.apply(base, { type: 'attack', targetId: 'e1' }, rng());
    const b = TurnEngine.apply(infected, { type: 'attack', targetId: 'e1' }, rng());
    expect(b.state.enemies[0]!.hp).toBeLessThan(a.state.enemies[0]!.hp);
  });

  it('a staggered player refreshes to one fewer AP after ending the turn', () => {
    const staggered = combatState({
      player: { ...combatState().player, statuses: [st('stagger')], ap: 0 },
    });
    const res = TurnEngine.apply(staggered, { type: 'endTurn' }, new Mulberry32(1));
    // After the cycle the player is back on their turn with maxAp-1 (stagger still active).
    if (res.state.phase === 'player') expect(res.state.player.ap).toBe(2);
  });

  it('a crushed player cannot move', () => {
    const crushed = combatState({
      player: { ...combatState().player, statuses: [st('crushed')] },
    });
    const res = TurnEngine.apply(crushed, { type: 'move', targetPos: { x: 4, y: 3 } }, new Mulberry32(1));
    expect(res.errors[0]?.code).toBe('ROOTED');
  });
});

describe('Origin damage resists — T-301', () => {
  const base = { stats: { str: 10, res: 10, agi: 10, int: 10 }, statuses: [] };

  it('cuts the matching damage type by the percent, after flat RES', () => {
    const diver = { ...base, resists: [{ damageType: 'pressure' as const, percent: 15 }] };
    // raw 30 − res 10 = 20 mitigated, ×0.85 → 17
    expect(damageTo(diver, 30, 'pressure')).toBe(17);
    // other types unaffected
    expect(damageTo(diver, 30, 'thermal')).toBe(20);
  });

  it("never touches 'true' damage and respects the chip floor below full immunity", () => {
    const diver = { ...base, resists: [{ damageType: 'true' as const, percent: 90 }] };
    expect(damageTo(diver, 30, 'true')).toBe(30); // true ignores RES and resists
    // Below 100% the chip floor still lands a connecting hit (99% of 20 → 0 → chip 1)…
    const thickWall = { ...base, resists: [{ damageType: 'physical' as const, percent: 99 }] };
    expect(damageTo(thickWall, 30, 'physical')).toBe(1);
    // …at a summed 100% the hit is fully immune and lands nothing (T-307 revision:
    // pre-T-307 the chip floor pierced even total resist; immunity now wins).
    const wall = { ...base, resists: [{ damageType: 'physical' as const, percent: 100 }] };
    expect(damageTo(wall, 30, 'physical')).toBe(0);
  });
});
