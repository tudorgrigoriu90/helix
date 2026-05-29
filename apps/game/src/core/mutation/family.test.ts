import { describe, it, expect } from 'vitest';
import type { MutationFamily } from '@shared-types/mutation';
import { FAMILY_RING } from '@shared-types/mutation';
import { adjacentFamilies, otherFamilies, isAdjacent } from './family';

const ALL: readonly MutationFamily[] = ['abyssal', 'mycelial', 'lithic', 'voidborn', 'thermal'];

describe('family adjacency — T-82 (GDD §5.4 / §5.2 ring)', () => {
  it('every family has exactly 2 adjacent families', () => {
    for (const f of ALL) {
      expect(adjacentFamilies(f)).toHaveLength(2);
    }
  });

  it('every family has exactly 2 other (non-adjacent, non-self) families', () => {
    for (const f of ALL) {
      expect(otherFamilies(f)).toHaveLength(2);
    }
  });

  it('adjacent + other + self partition the full family set with no overlap', () => {
    for (const f of ALL) {
      const buckets = new Set<MutationFamily>([f, ...adjacentFamilies(f), ...otherFamilies(f)]);
      expect(buckets.size).toBe(5); // self + 2 adjacent + 2 other, all distinct
      expect([...buckets].sort()).toEqual([...ALL].sort());
    }
  });

  it('matches the ring neighbours for a known family', () => {
    // ring: abyssal, mycelial, lithic, voidborn, thermal
    // abyssal's neighbours wrap: thermal (prev) and mycelial (next)
    expect([...adjacentFamilies('abyssal')].sort()).toEqual(['mycelial', 'thermal']);
    // lithic sits in the middle: mycelial (prev) and voidborn (next)
    expect([...adjacentFamilies('lithic')].sort()).toEqual(['mycelial', 'voidborn']);
    // thermal wraps the other way: voidborn (prev) and abyssal (next)
    expect([...adjacentFamilies('thermal')].sort()).toEqual(['abyssal', 'voidborn']);
  });

  it('returns adjacency in deterministic counter-clockwise-then-clockwise order', () => {
    expect(adjacentFamilies('lithic')).toEqual(['mycelial', 'voidborn']);
    expect(adjacentFamilies('abyssal')).toEqual(['thermal', 'mycelial']);
  });

  it('isAdjacent is symmetric', () => {
    for (const a of ALL) {
      for (const b of ALL) {
        expect(isAdjacent(a, b)).toBe(isAdjacent(b, a));
      }
    }
  });

  it('a family is never adjacent to itself', () => {
    for (const f of ALL) {
      expect(isAdjacent(f, f)).toBe(false);
    }
  });

  it('otherFamilies excludes self and adjacent', () => {
    for (const f of ALL) {
      const others = otherFamilies(f);
      expect(others).not.toContain(f);
      for (const adj of adjacentFamilies(f)) {
        expect(others).not.toContain(adj);
      }
    }
  });

  it('FAMILY_RING contains all five families exactly once', () => {
    expect([...FAMILY_RING].sort()).toEqual([...ALL].sort());
    expect(new Set(FAMILY_RING).size).toBe(5);
  });
});
