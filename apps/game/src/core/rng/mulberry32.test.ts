import { describe, it, expect } from 'vitest';
import { Mulberry32, makeRng, type RngLabel } from './mulberry32';

const LABELS: RngLabel[] = ['combat', 'loot', 'floorgen', 'mutationdraw', 'events'];

// ── T-56: Distribution (chi-squared) ────────────────────────────────────────

const BINS = 100;
const SAMPLES = 1_000_000;
// χ²(df=99, α=0.001) ≈ 148.23 — a well-distributed PRNG should be comfortably below this.
const CHI_SQ_CRITICAL = 148.23;

function chiSquared(rng: Mulberry32, bins: number, n: number): number {
  const counts = new Array<number>(bins).fill(0);
  for (let i = 0; i < n; i++) {
    counts[Math.floor(rng.next() * bins)]++;
  }
  const expected = n / bins;
  return counts.reduce((sum, obs) => sum + (obs - expected) ** 2 / expected, 0);
}

describe('RNG distribution — T-56', () => {
  it.each(LABELS)(
    '%s sub-generator: χ²(100 bins, 1M samples) < critical value',
    (label) => {
      const stat = chiSquared(makeRng(0xdeadbeef, label), BINS, SAMPLES);
      expect(stat).toBeLessThan(CHI_SQ_CRITICAL);
    },
  );

  it('Mulberry32 direct: χ²(100 bins, 1M samples) < critical value', () => {
    const stat = chiSquared(new Mulberry32(0x12345678), BINS, SAMPLES);
    expect(stat).toBeLessThan(CHI_SQ_CRITICAL);
  });
});

// ── T-57: Seed isolation ─────────────────────────────────────────────────────

describe('RNG seed isolation — T-57', () => {
  const ROOT = 0xcafe_f00d;

  it('advancing one sub-generator does not shift another', () => {
    // Baseline: first 200 values from loot with no other activity.
    const baseline = Array.from({ length: 200 }, () => makeRng(ROOT, 'loot').next());

    // Heavily advance combat; loot should still produce the same sequence.
    const combat = makeRng(ROOT, 'combat');
    for (let i = 0; i < 50_000; i++) combat.next();

    const isolated = Array.from({ length: 200 }, () => makeRng(ROOT, 'loot').next());
    expect(isolated).toEqual(baseline);
  });

  it('different labels produce distinct sequences from the same root seed', () => {
    const fingerprints = LABELS.map((label) => {
      const rng = makeRng(ROOT, label);
      return Array.from({ length: 20 }, () => rng.next()).join(',');
    });
    const unique = new Set(fingerprints);
    expect(unique.size).toBe(LABELS.length);
  });

  it('same label + different root seeds produce distinct sequences', () => {
    const seeds = [0x1111_1111, 0x2222_2222, 0xaaaa_aaaa, 0xffff_ffff];
    const fingerprints = seeds.map((seed) => {
      const rng = makeRng(seed, 'combat');
      return Array.from({ length: 20 }, () => rng.next()).join(',');
    });
    const unique = new Set(fingerprints);
    expect(unique.size).toBe(seeds.length);
  });

  it('nextInt is bounded: 10,000 calls always return values in [0, n)', () => {
    const rng = new Mulberry32(0xabcd_ef01);
    for (let i = 0; i < 10_000; i++) {
      const n = (i % 20) + 1; // n from 1 to 20
      const v = rng.nextInt(n);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(n);
    }
  });
});
