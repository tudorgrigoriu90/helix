import { describe, it, expect } from 'vitest';
import { makeRng } from '../rng/mulberry32';
import { drawMutationCards, type DrawnCard } from './card-draw';
import { rerollCard } from './reroll';
import { makeMutation, makePool } from './test-fixtures';

const ids = (cards: readonly DrawnCard[]): string[] => cards.map((c) => c.mutation.id);

describe('reroll — T-89 (GDD §5.4 Rule 5)', () => {
  it('replaces only the targeted card; the others are untouched', () => {
    const pool = makePool(6);
    const rng = makeRng(11, 'mutationdraw');
    const offer = drawMutationCards({ pool, owned: [], rng });
    const after = rerollCard({ offer, index: 1, pool, owned: [], rng });

    expect(after[0]).toBe(offer[0]); // identical reference — kept
    expect(after[2]).toBe(offer[2]);
    expect(after[1]).not.toBe(offer[1]); // replaced
    expect(after).toHaveLength(offer.length);
  });

  it('the replacement is distinct from every kept card and the original', () => {
    const pool = makePool(6);
    for (let seed = 0; seed < 100; seed++) {
      const rng = makeRng(seed, 'mutationdraw');
      const offer = drawMutationCards({ pool, owned: [], rng });
      const after = rerollCard({ offer, index: 0, pool, owned: [], rng });
      expect(new Set(ids(after)).size).toBe(after.length); // still all distinct
      expect(after[0]!.mutation.id).not.toBe(offer[0]!.mutation.id); // actually changed
    }
  });

  it('the replacement keeps the rerolled slot and tier', () => {
    const pool = [...makePool(3, 'minor'), ...makePool(3, 'major'), ...makePool(3, 'dominant')];
    const rng = makeRng(5, 'mutationdraw');
    const offer = drawMutationCards({ pool, owned: [], floor: 15, rng });
    const after = rerollCard({ offer, index: 2, pool, owned: [], rng });
    expect(after[2]!.slot).toBe(offer[2]!.slot);
    expect(after[2]!.tier).toBe(offer[2]!.tier);
  });

  it('never offers an owned mutation', () => {
    const pool = makePool(6);
    const owned = pool.filter((m) => m.family === 'lithic').slice(0, 2);
    const rng = makeRng(3, 'mutationdraw');
    const offer = drawMutationCards({ pool, owned, rng });
    const after = rerollCard({ offer, index: 1, pool, owned, rng });
    for (const id of ids(after)) expect(owned.map((m) => m.id)).not.toContain(id);
  });

  it('draws from the same sub-stream — full draw+reroll replays identically', () => {
    const pool = makePool(6);
    const rngA = makeRng(99, 'mutationdraw');
    const offerA = drawMutationCards({ pool, owned: [], rng: rngA });
    const afterA = rerollCard({ offer: offerA, index: 1, pool, owned: [], rng: rngA });

    const rngB = makeRng(99, 'mutationdraw');
    const offerB = drawMutationCards({ pool, owned: [], rng: rngB });
    const afterB = rerollCard({ offer: offerB, index: 1, pool, owned: [], rng: rngB });

    expect(ids(afterA)).toEqual(ids(afterB));
  });

  it('throws on an out-of-range index', () => {
    const pool = makePool(4);
    const rng = makeRng(1, 'mutationdraw');
    const offer = drawMutationCards({ pool, owned: [], rng });
    expect(() => rerollCard({ offer, index: 9, pool, owned: [], rng })).toThrow(RangeError);
    expect(() => rerollCard({ offer, index: -1, pool, owned: [], rng })).toThrow(RangeError);
  });

  it('returns the offer unchanged when no alternative is available', () => {
    // Pool of exactly 3 → after the draw there is nothing left to swap in.
    const pool = [
      makeMutation({ id: 'a', family: 'abyssal' }),
      makeMutation({ id: 'b', family: 'mycelial' }),
      makeMutation({ id: 'c', family: 'lithic' }),
    ];
    const rng = makeRng(7, 'mutationdraw');
    const offer = drawMutationCards({ pool, owned: [], rng });
    expect(offer).toHaveLength(3);
    const after = rerollCard({ offer, index: 0, pool, owned: [], rng });
    expect(ids(after)).toEqual(ids(offer)); // unchanged — nothing to swap
  });
});
