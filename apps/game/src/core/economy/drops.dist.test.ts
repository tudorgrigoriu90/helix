import { describe, it, expect } from 'vitest';
import type { EnemyTier } from '@shared-types/enemy';
import { makeRng } from '../rng/mulberry32';
import { rollKillDrops, DROP_RATES, VEIN_PER_KILL, type KillDrops } from './drops';

/**
 * T-109 — drop-rate distribution gate (TDD §16.1).
 *
 * Samples 100,000 kills per tier off the deterministic `loot` sub-generator and
 * asserts each bonus drop's empirical frequency matches its configured
 * probability via a chi-squared goodness-of-fit (1 d.o.f., α = 0.001). Because
 * the RNG is seeded, this is deterministic — it catches a miswired rate or a
 * biased generator without ever flaking.
 */

const N = 100_000;
/** χ² critical value, 1 degree of freedom, α = 0.001. */
const CHI2_CRIT_1DOF = 10.828;

const BONUS: readonly (keyof Omit<KillDrops, 'vein'>)[] = ['mod', 'rareCore', 'epicCore'];

/** χ² statistic for a Bernoulli(`p`) with `successes` out of `n`. */
function chiSquaredBernoulli(successes: number, n: number, p: number): number {
  const eSucc = n * p;
  const eFail = n * (1 - p);
  const failures = n - successes;
  return (successes - eSucc) ** 2 / eSucc + (failures - eFail) ** 2 / eFail;
}

function sampleTier(tier: EnemyTier): { counts: Record<string, number>; veinOk: boolean } {
  const rng = makeRng(0x5eed ^ tier.length, 'loot');
  const counts: Record<string, number> = { mod: 0, rareCore: 0, epicCore: 0 };
  let veinOk = true;
  for (let i = 0; i < N; i++) {
    const d = rollKillDrops(tier, rng);
    if (d.vein !== VEIN_PER_KILL[tier]) veinOk = false;
    for (const k of BONUS) if (d[k]) counts[k]!++;
  }
  return { counts, veinOk };
}

describe('drop-rate distribution — T-109 (chi-squared, 100K samples)', () => {
  for (const tier of ['grunt', 'elite', 'floor_boss', 'zone_warden'] as const) {
    it(`${tier}: empirical drop rates fit the configured probabilities`, () => {
      const rates = DROP_RATES[tier];
      const { counts, veinOk } = sampleTier(tier);

      expect(veinOk, 'VEIN always granted at tier amount').toBe(true);

      for (const k of BONUS) {
        const p = rates[k];
        const observed = counts[k]!;
        if (p === 0) {
          expect(observed, `${tier}.${k} should never drop`).toBe(0);
        } else if (p === 1) {
          expect(observed, `${tier}.${k} should always drop`).toBe(N);
        } else {
          const chi2 = chiSquaredBernoulli(observed, N, p);
          const empirical = observed / N;
          expect(chi2, `${tier}.${k} χ²=${chi2.toFixed(2)} (rate ${empirical.toFixed(4)} vs ${p})`).toBeLessThan(CHI2_CRIT_1DOF);
        }
      }
    });
  }

  it('no-vacuous-pass: a wrong expected probability fails the same test', () => {
    // Elite mod is 0.3; testing it against 0.4 must blow past the critical value.
    const { counts } = sampleTier('elite');
    const chi2Wrong = chiSquaredBernoulli(counts['mod']!, N, 0.4);
    expect(chi2Wrong).toBeGreaterThan(CHI2_CRIT_1DOF);
  });
});
