import { describe, it, expect } from 'vitest';
import type { MutationDef, MutationFamily, MutationTier } from '@shared-types/mutation';
import { makeRng } from '../rng/mulberry32';
import { drawProtoStrandCards, PROTO_STRAND_CARD_COUNT, PROTO_STRAND_FLOOR } from './proto-strand';

function mut(id: string, family: MutationFamily, tier: MutationTier = 'minor'): MutationDef {
  return { id, family, tier, name: id, sigBonus: 10, modifiers: [], grantsAbility: null, lace: 'x', tags: [] };
}

const POOL: MutationDef[] = [
  mut('ab1', 'abyssal'), mut('ab2', 'abyssal'), mut('ab3', 'abyssal'),
  mut('my1', 'mycelial'), mut('li1', 'lithic'),
  mut('vo_major', 'voidborn', 'major'), mut('th_dom', 'thermal', 'dominant'),
];

describe('drawProtoStrandCards — T-311 (DR-009b)', () => {
  it('offers two distinct unowned Minor cards', () => {
    const cards = drawProtoStrandCards({ pool: POOL, owned: [], rng: makeRng(1, 'mutationdraw') });
    expect(cards).toHaveLength(PROTO_STRAND_CARD_COUNT);
    expect(new Set(cards.map((c) => c.mutation.id)).size).toBe(2);
    for (const c of cards) expect(c.mutation.tier).toBe('minor');
  });

  it('never offers Major/Dominant tiers or owned mutations', () => {
    for (let seed = 0; seed < 60; seed++) {
      const cards = drawProtoStrandCards({ pool: POOL, owned: [POOL[0]!], rng: makeRng(seed, 'mutationdraw') });
      for (const c of cards) {
        expect(c.mutation.tier).toBe('minor');
        expect(c.mutation.id).not.toBe('ab1');
      }
    }
  });

  it('samples families uniformly, not by pool density', () => {
    // Abyssal has 3 Minors, mycelial/lithic 1 each — uniform family sampling
    // puts each family's first-card share near 1/3 despite the density skew.
    const counts: Record<string, number> = { abyssal: 0, mycelial: 0, lithic: 0 };
    const n = 3000;
    const rng = makeRng(0xfeed, 'mutationdraw');
    for (let i = 0; i < n; i++) {
      const first = drawProtoStrandCards({ pool: POOL, owned: [], rng })[0]!;
      counts[first.mutation.family] = (counts[first.mutation.family] ?? 0) + 1;
    }
    for (const family of ['abyssal', 'mycelial', 'lithic']) {
      expect(counts[family]! / n).toBeGreaterThan(0.28);
      expect(counts[family]! / n).toBeLessThan(0.39);
    }
  });

  it('degrades gracefully on a thin pool (one card, or none)', () => {
    const thin = [mut('only', 'abyssal')];
    expect(drawProtoStrandCards({ pool: thin, owned: [], rng: makeRng(1, 'mutationdraw') })).toHaveLength(1);
    expect(drawProtoStrandCards({ pool: [], owned: [], rng: makeRng(1, 'mutationdraw') })).toHaveLength(0);
  });

  it('is deterministic for a given RNG state', () => {
    const a = drawProtoStrandCards({ pool: POOL, owned: [], rng: makeRng(9, 'mutationdraw') });
    const b = drawProtoStrandCards({ pool: POOL, owned: [], rng: makeRng(9, 'mutationdraw') });
    expect(a.map((c) => c.mutation.id)).toEqual(b.map((c) => c.mutation.id));
  });

  it('pins the trigger floor (the Floor 2 boss clear)', () => {
    expect(PROTO_STRAND_FLOOR).toBe(2);
  });
});
