import { describe, it, expect } from 'vitest';
import { makeRng } from '../rng/mulberry32';
import {
  drawMutationCards,
  STRAND_CARD_COUNT,
  WILD_CARD_COUNT,
  type DrawnCard,
} from './card-draw';
import { makeMutation, makePool } from './test-fixtures';

const ids = (cards: readonly DrawnCard[]): string[] => cards.map((c) => c.mutation.id);

describe('card draw — T-85 (GDD §5.4 Rules 2 & 4)', () => {
  it('offers exactly three cards from a full pool', () => {
    const cards = drawMutationCards({ pool: makePool(4), owned: [], rng: makeRng(1, 'mutationdraw') });
    expect(cards).toHaveLength(STRAND_CARD_COUNT);
  });

  it('the three cards are always distinct mutations', () => {
    for (let seed = 0; seed < 200; seed++) {
      const cards = drawMutationCards({ pool: makePool(4), owned: [], rng: makeRng(seed, 'mutationdraw') });
      expect(new Set(ids(cards)).size).toBe(cards.length);
    }
  });

  it('never offers a mutation the player already owns (Rule 4)', () => {
    const pool = makePool(4);
    const owned = [pool[0]!, pool[1]!, pool[10]!]; // a few across families
    for (let seed = 0; seed < 200; seed++) {
      const cards = drawMutationCards({ pool, owned, rng: makeRng(seed, 'mutationdraw') });
      for (const id of ids(cards)) {
        expect(owned.map((m) => m.id)).not.toContain(id);
      }
    }
  });

  it('produces exactly one wild card and the rest weighted (Rule 2)', () => {
    const cards = drawMutationCards({ pool: makePool(4), owned: [], rng: makeRng(7, 'mutationdraw') });
    expect(cards.filter((c) => c.slot === 'wild')).toHaveLength(WILD_CARD_COUNT);
    expect(cards.filter((c) => c.slot === 'weighted')).toHaveLength(STRAND_CARD_COUNT - WILD_CARD_COUNT);
  });

  it('is deterministic — same seed + owned yields identical cards', () => {
    const pool = makePool(4);
    const a = drawMutationCards({ pool, owned: [], rng: makeRng(42, 'mutationdraw') });
    const b = drawMutationCards({ pool, owned: [], rng: makeRng(42, 'mutationdraw') });
    expect(ids(a)).toEqual(ids(b));
    expect(a.map((c) => c.slot)).toEqual(b.map((c) => c.slot));
  });

  it('different seeds explore different cards (not vacuously constant)', () => {
    const pool = makePool(4);
    const fingerprints = new Set<string>();
    for (let seed = 0; seed < 60; seed++) {
      const cards = drawMutationCards({ pool, owned: [], rng: makeRng(seed, 'mutationdraw') });
      fingerprints.add(ids(cards).join(','));
    }
    expect(fingerprints.size).toBeGreaterThan(10);
  });

  it('with no ownership every family can appear (uniform base distribution)', () => {
    const pool = makePool(4);
    const families = new Set<string>();
    for (let seed = 0; seed < 300; seed++) {
      const cards = drawMutationCards({ pool, owned: [], rng: makeRng(seed, 'mutationdraw') });
      for (const c of cards) families.add(c.mutation.family);
    }
    expect(families.size).toBe(5); // all five reachable when nothing is owned
  });

  it('degrades gracefully when the available pool is smaller than three', () => {
    const pool = [
      makeMutation({ id: 'a', family: 'abyssal' }),
      makeMutation({ id: 'b', family: 'thermal' }),
    ];
    const cards = drawMutationCards({ pool, owned: [], rng: makeRng(3, 'mutationdraw') });
    expect(cards).toHaveLength(2);
    expect(new Set(ids(cards)).size).toBe(2);
  });

  it('returns no cards when every mutation is already owned', () => {
    const pool = makePool(1);
    const cards = drawMutationCards({ pool, owned: pool, rng: makeRng(9, 'mutationdraw') });
    expect(cards).toHaveLength(0);
  });

  it('ownership biases the weighted slots toward the owned family (T-86 wiring)', () => {
    const pool = makePool(6);
    // Own several abyssal mutations (not so many the pool runs dry).
    const owned = pool.filter((m) => m.family === 'abyssal').slice(0, 3);
    let abyssalWeighted = 0;
    let otherWeighted = 0;
    for (let seed = 0; seed < 400; seed++) {
      const cards = drawMutationCards({ pool, owned, rng: makeRng(seed, 'mutationdraw') });
      for (const c of cards.filter((x) => x.slot === 'weighted')) {
        if (c.mutation.family === 'abyssal') abyssalWeighted++;
        else otherWeighted++;
      }
    }
    // With 3 abyssal owned (the 2+ rule: 50% dominant), the weighted slots should
    // land on abyssal far more often than any single other family.
    expect(abyssalWeighted).toBeGreaterThan(otherWeighted);
  });
});
