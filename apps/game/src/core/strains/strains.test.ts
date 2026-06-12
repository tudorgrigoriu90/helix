import { describe, it, expect } from 'vitest';
import type { MetaState } from '@shared-types/meta-state';
import type { SigmaStrainDef } from '@shared-types/sigma-strain';
import type { PlayerState } from '@shared-types/run-state';
import { newMetaState } from '../save/meta-save';
import { recordRunOutcome } from '../save/meta-progression';
import { evaluateStrainUnlocks } from './strain-unlocks';
import { aggregateStrainFx, applyStrainFxToPlayer, ZERO_STRAIN_FX } from './strain-effects';
import { newRunPlayer } from '../run/start-player';

/** T-306 — Sigma Strain unlock evaluation + effect aggregation. */

function strain(partial: Partial<SigmaStrainDef> & Pick<SigmaStrainDef, 'id' | 'unlock' | 'effect'>): SigmaStrainDef {
  return {
    schemaVersion: 1,
    name: partial.id,
    tagline: 't',
    blurb: 'b',
    ...partial,
  };
}

const POOL: readonly SigmaStrainDef[] = [
  strain({ id: 'hp', unlock: { kind: 'runsCompleted', count: 5 }, effect: { kind: 'maxHpPercent', percent: 5 } }),
  strain({ id: 'win1', unlock: { kind: 'wins', count: 1 }, effect: { kind: 'extraWildCard' } }),
  strain({ id: 'floor10', unlock: { kind: 'reachFloor', floor: 10 }, effect: { kind: 'firstCardMatchesLastFamily' } }),
  strain({ id: 'kills', unlock: { kind: 'enemiesKilled', count: 100 }, effect: { kind: 'veinBonusPercent', percent: 5 } }),
  strain({ id: 'thermal', unlock: { kind: 'killsOfType', damageType: 'thermal', count: 10 }, effect: { kind: 'damageResistPercent', damageType: 'thermal', percent: 10 } }),
  strain({ id: 'abyssal_runs', unlock: { kind: 'runsWithFamily', family: 'abyssal', count: 2 }, effect: { kind: 'shopFamilyBias', family: 'abyssal' } }),
  strain({ id: 'void_deaths', unlock: { kind: 'deathsToType', damageType: 'void', count: 2 }, effect: { kind: 'enemyIntentReveal', damageType: 'void' } }),
  strain({ id: 'shards', unlock: { kind: 'wins', count: 2 }, effect: { kind: 'shardBonusPercent', percent: 10 } }),
  strain({ id: 'cache', unlock: { kind: 'runsCompleted', count: 1 }, effect: { kind: 'startingVein', amount: 25 } }),
];

function meta(overrides: Partial<MetaState>): MetaState {
  return { ...newMetaState(), ...overrides };
}

describe('evaluateStrainUnlocks — T-306', () => {
  it('evaluates every milestone kind against the profile counters', () => {
    const m = meta({
      lifetime: { runs: 5, wins: 1, deepestFloor: 10, enemiesKilled: 100, totalPlaytimeMs: 0 },
      killsByType: { thermal: 10 },
      runsByFamily: { abyssal: 2 },
      deathsByType: { void: 2 },
    });
    expect(evaluateStrainUnlocks(POOL, m).sort()).toEqual(
      ['hp', 'win1', 'floor10', 'kills', 'thermal', 'abyssal_runs', 'void_deaths', 'cache'].sort(),
    );
  });

  it('thresholds are not crossed early, and owned strains never re-unlock', () => {
    const m = meta({
      lifetime: { runs: 0, wins: 0, deepestFloor: 9, enemiesKilled: 99, totalPlaytimeMs: 0 },
      killsByType: { thermal: 9 },
      runsByFamily: { abyssal: 1 },
      deathsByType: { void: 1 },
    });
    expect(evaluateStrainUnlocks(POOL, m)).toEqual([]);
    const owned = meta({
      lifetime: { runs: 5, wins: 0, deepestFloor: 0, enemiesKilled: 0, totalPlaytimeMs: 0 },
      sigmaStrainIds: ['hp', 'cache'],
    });
    expect(evaluateStrainUnlocks(POOL, owned)).toEqual([]);
  });
});

describe('aggregateStrainFx / applyStrainFxToPlayer — T-306', () => {
  it('sums numeric effects and ORs binary ones, only over unlocked ids', () => {
    const fx = aggregateStrainFx(POOL, ['hp', 'win1', 'kills', 'thermal', 'shards', 'cache', 'void_deaths', 'abyssal_runs']);
    expect(fx.maxHpPercent).toBe(5);
    expect(fx.veinBonusPercent).toBe(5);
    expect(fx.shardBonusPercent).toBe(10);
    expect(fx.startingVein).toBe(25);
    expect(fx.extraWildCard).toBe(true);
    expect(fx.firstCardMatchesLastFamily).toBe(false); // floor10 not unlocked
    expect(fx.resists).toEqual([{ damageType: 'thermal', percent: 10 }]);
    expect(fx.intentRevealTypes).toEqual(['void']);
    expect(fx.shopBiasFamilies).toEqual(['abyssal']);
  });

  it('with nothing unlocked, returns the zero baseline', () => {
    expect(aggregateStrainFx(POOL, [])).toEqual(ZERO_STRAIN_FX);
  });

  it('applies the max-HP nudge and resists to the player; stats untouched (§4.2)', () => {
    const base = newRunPlayer();
    const fx = aggregateStrainFx(POOL, ['hp', 'thermal']);
    const p = applyStrainFxToPlayer(base, fx);
    expect(p.maxHp).toBe(base.maxHp + Math.floor(base.maxHp * 0.05));
    expect(p.hp).toBe(p.maxHp); // run starts full
    expect(p.resists).toContainEqual({ damageType: 'thermal', percent: 10 });
    expect(p.stats).toEqual(base.stats);
    // No effects → identity.
    expect(applyStrainFxToPlayer(base, ZERO_STRAIN_FX)).toBe(base);
  });

  it('strain resists stack alongside an existing (Origin) resist', () => {
    const base: PlayerState = { ...newRunPlayer(), resists: [{ damageType: 'pressure', percent: 15 }] };
    const p = applyStrainFxToPlayer(base, aggregateStrainFx(POOL, ['thermal']));
    expect(p.resists).toEqual([
      { damageType: 'pressure', percent: 15 },
      { damageType: 'thermal', percent: 10 },
    ]);
  });
});

describe('recordRunOutcome folds strain counters + unlocks — T-306', () => {
  const outcome = {
    won: false,
    floorReached: 3,
    enemiesKilled: 12,
    playtimeMs: 1000,
    killsByType: { thermal: 7, physical: 5 },
    deathDamageType: 'void' as const,
    dominantFamily: 'abyssal' as const,
    mutationIds: ['gill_slits', 'lure_growth'],
  };

  it('advances killsByType / deathsByType / runsByFamily / lastRunMutationIds', () => {
    const m1 = recordRunOutcome(newMetaState(), outcome, POOL);
    expect(m1.killsByType).toEqual({ thermal: 7, physical: 5 });
    expect(m1.deathsByType).toEqual({ void: 1 });
    expect(m1.runsByFamily).toEqual({ abyssal: 1 });
    expect(m1.lastRunMutationIds).toEqual(['gill_slits', 'lure_growth']);
    const m2 = recordRunOutcome(m1, outcome, POOL);
    expect(m2.killsByType).toEqual({ thermal: 14, physical: 10 });
    expect(m2.deathsByType).toEqual({ void: 2 });
    expect(m2.runsByFamily).toEqual({ abyssal: 2 });
  });

  it('a death without a typed killing blow leaves deathsByType untouched; wins never count', () => {
    const m = recordRunOutcome(newMetaState(), { ...outcome, deathDamageType: undefined }, POOL);
    expect(m.deathsByType).toEqual({});
    const w = recordRunOutcome(newMetaState(), { ...outcome, won: true }, POOL);
    expect(w.deathsByType).toEqual({});
  });

  it('unlocks the strain on the run that crosses its milestone', () => {
    const m1 = recordRunOutcome(newMetaState(), outcome, POOL); // runs=1 → cache
    expect(m1.sigmaStrainIds).toContain('cache');
    expect(m1.sigmaStrainIds).not.toContain('hp');
    let m = m1;
    for (let i = 0; i < 4; i++) m = recordRunOutcome(m, outcome, POOL);
    expect(m.lifetime.runs).toBe(5);
    expect(m.sigmaStrainIds).toContain('hp'); // crossed on the 5th run
  });

  it('an unlocked shard-bonus strain boosts the next run-end conversion', () => {
    const base = meta({ sigmaStrainIds: ['shards'] });
    const plain = recordRunOutcome(newMetaState(), { ...outcome, veinEarned: 2000 }, POOL);
    const boosted = recordRunOutcome(base, { ...outcome, veinEarned: 2000 }, POOL);
    expect(boosted.shardCrystals).toBeCloseTo(plain.shardCrystals * 1.1, 10);
  });

  it('without a strain pool the legacy two-argument call still works', () => {
    const m = recordRunOutcome(newMetaState(), outcome);
    expect(m.lifetime.runs).toBe(1);
    expect(m.sigmaStrainIds).toEqual([]);
  });
});
