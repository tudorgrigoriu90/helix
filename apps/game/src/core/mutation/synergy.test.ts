import { describe, it, expect } from 'vitest';
import type { MutationFamily } from '@shared-types/mutation';
import { FAMILY_RING } from '@shared-types/mutation';
import { HYBRID_SYNERGIES, unlockedSynergies, synergyFor } from './synergy';
import { makeMutation } from './test-fixtures';

const owns = (...families: MutationFamily[]) => families.map((family) => makeMutation({ family }));
const ringIdx = (f: MutationFamily) => FAMILY_RING.indexOf(f);

describe('hybrid synergy detection — T-92 (GDD §5.6)', () => {
  it('catalogs exactly ten synergies with unique ids and names', () => {
    expect(HYBRID_SYNERGIES).toHaveLength(10);
    expect(new Set(HYBRID_SYNERGIES.map((s) => s.id)).size).toBe(10);
    expect(new Set(HYBRID_SYNERGIES.map((s) => s.name)).size).toBe(10);
  });

  it('covers every cross-family pair exactly once, each stored in ring order', () => {
    const pairKeys = new Set<string>();
    for (const s of HYBRID_SYNERGIES) {
      const [a, b] = s.families;
      expect(a).not.toBe(b);
      expect(ringIdx(a)).toBeLessThan(ringIdx(b)); // canonical ring order
      pairKeys.add(`${a}+${b}`);
    }
    // C(5,2) = 10 distinct pairs.
    expect(pairKeys.size).toBe(10);
  });

  it('includes the five GDD §5.6-named synergies (canon)', () => {
    const canonNames = HYBRID_SYNERGIES.filter((s) => s.canon).map((s) => s.name).sort();
    expect(canonNames).toEqual(
      ['Bioluminescent Bloom', 'Dark Combustion', 'Fever Spores', 'Pressure Crystal', 'Void Shard'].sort(),
    );
  });

  it('unlocks nothing with mutations from only one family', () => {
    expect(unlockedSynergies(owns('abyssal', 'abyssal', 'abyssal'))).toEqual([]);
  });

  it('unlocks the pair synergy when both families are owned', () => {
    const found = unlockedSynergies(owns('abyssal', 'mycelial'));
    expect(found).toHaveLength(1);
    expect(found[0]!.name).toBe('Bioluminescent Bloom');
  });

  it('unlocks all pairwise synergies among three owned families', () => {
    const found = unlockedSynergies(owns('abyssal', 'lithic', 'thermal'));
    // pairs: abyssal+lithic, abyssal+thermal, lithic+thermal → 3
    expect(found).toHaveLength(3);
    expect(found.map((s) => s.id).sort()).toEqual(
      ['pressure_crystal', 'hydrothermal_vent', 'magma_forge'].sort(),
    );
  });

  it('synergyFor is order-independent and rejects same-family pairs', () => {
    expect(synergyFor('thermal', 'voidborn')).toBe(synergyFor('voidborn', 'thermal'));
    expect(synergyFor('thermal', 'voidborn')?.name).toBe('Dark Combustion');
    expect(synergyFor('abyssal', 'abyssal')).toBeUndefined();
  });

  it('synergyFor resolves every cross-family pair', () => {
    for (const a of FAMILY_RING) {
      for (const b of FAMILY_RING) {
        if (a === b) continue;
        expect(synergyFor(a, b)).toBeDefined();
      }
    }
  });
});
