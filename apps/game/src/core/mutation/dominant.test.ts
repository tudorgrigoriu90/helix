import { describe, it, expect } from 'vitest';
import type { MutationFamily } from '@shared-types/mutation';
import { FAMILY_RING } from '@shared-types/mutation';
import {
  unlockedDominantTraits,
  dominantTraitFor,
  DOMINANT_TRAITS,
  DOMINANT_TRAIT_THRESHOLD,
} from './dominant';
import { makeMutation } from './test-fixtures';

const owns = (...families: MutationFamily[]) => families.map((family) => makeMutation({ family }));

describe('dominant trait detection — T-91 (GDD §5.5)', () => {
  it('unlocks nothing below the 3-of-a-family threshold', () => {
    expect(unlockedDominantTraits([])).toEqual([]);
    expect(unlockedDominantTraits(owns('abyssal'))).toEqual([]);
    expect(unlockedDominantTraits(owns('abyssal', 'abyssal'))).toEqual([]);
  });

  it('unlocks a family trait at exactly three of that family', () => {
    const traits = unlockedDominantTraits(owns('lithic', 'lithic', 'lithic'));
    expect(traits).toHaveLength(1);
    expect(traits[0]!.id).toBe('fortress_form');
    expect(traits[0]!.family).toBe('lithic');
  });

  it('does not unlock when three are spread across families', () => {
    expect(unlockedDominantTraits(owns('abyssal', 'mycelial', 'lithic'))).toEqual([]);
  });

  it('still unlocks just one trait when more than three of a family are owned', () => {
    const traits = unlockedDominantTraits(owns('thermal', 'thermal', 'thermal', 'thermal'));
    expect(traits.map((t) => t.id)).toEqual(['combustion_engine']);
  });

  it('detects multiple traits in ring order (general case)', () => {
    const traits = unlockedDominantTraits(
      owns('abyssal', 'abyssal', 'abyssal', 'voidborn', 'voidborn', 'voidborn'),
    );
    // FAMILY_RING order: abyssal precedes voidborn.
    expect(traits.map((t) => t.family)).toEqual(['abyssal', 'voidborn']);
  });

  it('threshold constant matches the GDD (three)', () => {
    expect(DOMINANT_TRAIT_THRESHOLD).toBe(3);
  });

  it('every family has exactly one trait with a unique id and effect text', () => {
    const ids = new Set<string>();
    for (const f of FAMILY_RING) {
      const t = dominantTraitFor(f);
      expect(t.family).toBe(f);
      expect(t.description.length).toBeGreaterThan(10);
      ids.add(t.id);
    }
    expect(ids.size).toBe(FAMILY_RING.length);
    expect(Object.keys(DOMINANT_TRAITS).sort()).toEqual([...FAMILY_RING].sort());
  });
});
