import { describe, it, expect } from 'vitest';
import { makeRng, type RngLabel } from './mulberry32';

// 100 fixed seeds spread across the 32-bit space.
const FIXED_SEEDS: number[] = Array.from(
  { length: 100 },
  (_, i) => ((i * 131_071 + 0xdead_beef) >>> 0), // 131071 is prime
);

const LABELS: RngLabel[] = ['combat', 'loot', 'floorgen', 'mutationdraw', 'events'];

/**
 * Produces a deterministic fingerprint for a root seed.
 *
 * Runs 2,000 calls through each sub-generator and XOR-folds the results into
 * a single hex string. Intentionally thin now — expanded to a full headless
 * run simulation in T-391 once the TurnEngine and FloorGen land (E-3).
 */
function fingerprint(rootSeed: number): string {
  let acc = 0;
  for (const label of LABELS) {
    const rng = makeRng(rootSeed, label);
    for (let i = 0; i < 2_000; i++) {
      acc = (acc ^ (rng.next() * 0xffff_ffff)) >>> 0;
    }
  }
  return acc.toString(16).padStart(8, '0');
}

describe('determinism replay gate — 100 fixed seeds (T-30)', () => {
  it('every seed produces identical output on repeated runs', () => {
    const pass1 = FIXED_SEEDS.map(fingerprint);
    const pass2 = FIXED_SEEDS.map(fingerprint);
    expect(pass2).toEqual(pass1);
  });

  it('output is independent of evaluation order (no cross-seed state leak)', () => {
    const forward = FIXED_SEEDS.map(fingerprint);
    // Run the same seeds in reverse order; reverse the result back for comparison.
    const reversed = [...FIXED_SEEDS].reverse().map(fingerprint).reverse();
    expect(reversed).toEqual(forward);
  });
});
