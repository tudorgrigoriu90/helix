import { describe, it, expect } from 'vitest';
import type { MutationFamily } from '@shared-types/mutation';
import { FAMILY_RING } from '@shared-types/mutation';
import {
  familyWeights,
  WEIGHT_UNIFORM,
  WEIGHT_DOMINANT_SINGLE,
  WEIGHT_ADJACENT_SINGLE,
  WEIGHT_OTHER_SINGLE,
  WEIGHT_DOMINANT_MANY,
  WEIGHT_OTHER_MANY,
} from './family-weights';
import { adjacentFamilies, otherFamilies } from './family';
import { makeMutation } from './test-fixtures';

const sum = (w: ReadonlyMap<MutationFamily, number>): number => [...w.values()].reduce((a, b) => a + b, 0);

describe('family weighting — T-86 (GDD §5.4 Rule 1)', () => {
  it('0 owned → every family weighted equally, summing to 100', () => {
    const w = familyWeights([]);
    for (const f of FAMILY_RING) expect(w.get(f)).toBe(WEIGHT_UNIFORM);
    expect(sum(w)).toBe(100);
  });

  it('1 owned → dominant 40, adjacent 20 each, others 10 each (sum 100)', () => {
    const w = familyWeights([makeMutation({ family: 'abyssal' })]);
    expect(w.get('abyssal')).toBe(WEIGHT_DOMINANT_SINGLE);
    for (const adj of adjacentFamilies('abyssal')) expect(w.get(adj)).toBe(WEIGHT_ADJACENT_SINGLE);
    for (const oth of otherFamilies('abyssal')) expect(w.get(oth)).toBe(WEIGHT_OTHER_SINGLE);
    expect(sum(w)).toBe(100);
  });

  it('2+ in one family → dominant 50, the other four 12.5 each (sum 100)', () => {
    const w = familyWeights([
      makeMutation({ family: 'thermal' }),
      makeMutation({ family: 'thermal' }),
    ]);
    expect(w.get('thermal')).toBe(WEIGHT_DOMINANT_MANY);
    for (const f of FAMILY_RING) {
      if (f !== 'thermal') expect(w.get(f)).toBe(WEIGHT_OTHER_MANY);
    }
    expect(sum(w)).toBe(100);
  });

  it('3 in one family behaves the same as 2 (the "2+" case)', () => {
    const three = familyWeights([
      makeMutation({ family: 'lithic' }),
      makeMutation({ family: 'lithic' }),
      makeMutation({ family: 'lithic' }),
    ]);
    expect(three.get('lithic')).toBe(WEIGHT_DOMINANT_MANY);
    expect(sum(three)).toBe(100);
  });

  it('most-owned family is the dominant one when ownership is mixed', () => {
    const w = familyWeights([
      makeMutation({ family: 'abyssal' }),
      makeMutation({ family: 'abyssal' }),
      makeMutation({ family: 'thermal' }),
    ]);
    expect(w.get('abyssal')).toBe(WEIGHT_DOMINANT_MANY); // 2 abyssal beats 1 thermal
    expect(w.get('thermal')).toBe(WEIGHT_OTHER_MANY);
  });

  it('a 1-each tie breaks by FAMILY_RING order and uses the 1-owned rule', () => {
    // abyssal (ring idx 0) and thermal (ring idx 4) each owned once → abyssal dominant.
    const w = familyWeights([
      makeMutation({ family: 'thermal' }),
      makeMutation({ family: 'abyssal' }),
    ]);
    expect(w.get('abyssal')).toBe(WEIGHT_DOMINANT_SINGLE);
    expect(sum(w)).toBe(100);
  });

  it('weights are always positive and sum to 100 for any ownership', () => {
    const samples: MutationFamily[][] = [
      [],
      ['abyssal'],
      ['mycelial', 'mycelial'],
      ['lithic', 'voidborn', 'thermal'],
      ['voidborn', 'voidborn', 'voidborn', 'abyssal'],
    ];
    for (const fams of samples) {
      const w = familyWeights(fams.map((family) => makeMutation({ family })));
      for (const f of FAMILY_RING) expect(w.get(f)).toBeGreaterThan(0);
      expect(sum(w)).toBeCloseTo(100, 6);
    }
  });
});
