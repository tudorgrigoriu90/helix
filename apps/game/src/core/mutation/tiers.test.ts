import { describe, it, expect } from 'vitest';
import { makeRng } from '../rng/mulberry32';
import {
  tiersForFloor,
  STRAND_MAJOR_FLOOR,
  STRAND_DOMINANT_FLOOR,
} from './tiers';
import { STRAND_CARD_COUNT } from './constants';
import { drawMutationCards } from './card-draw';
import { makeMutation, makePool } from './test-fixtures';

describe('tier progression — T-88 (GDD §5.4 Rule 3)', () => {
  it('Floor 5–9 offers three Minor cards', () => {
    for (const floor of [5, 7, 9]) {
      expect(tiersForFloor(floor)).toEqual(['minor', 'minor', 'minor']);
    }
  });

  it('Floor 10–14 offers two Minor + one Major', () => {
    for (const floor of [STRAND_MAJOR_FLOOR, 12, 14]) {
      expect(tiersForFloor(floor)).toEqual(['minor', 'minor', 'major']);
    }
  });

  it('Floor 15+ offers Minor + Major + Dominant', () => {
    for (const floor of [STRAND_DOMINANT_FLOOR, 20, 99]) {
      expect(tiersForFloor(floor)).toEqual(['minor', 'major', 'dominant']);
    }
  });

  it('always returns exactly STRAND_CARD_COUNT tiers', () => {
    for (let floor = 1; floor <= 30; floor++) {
      expect(tiersForFloor(floor)).toHaveLength(STRAND_CARD_COUNT);
    }
  });

  it('the draw honours the floor tier mix when content exists', () => {
    // A pool with every tier in every family.
    const pool = [
      ...makePool(3, 'minor'),
      ...makePool(3, 'major'),
      ...makePool(3, 'dominant'),
    ];
    const cards = drawMutationCards({ pool, owned: [], floor: 15, rng: makeRng(4, 'mutationdraw') });
    expect(cards.map((c) => c.tier)).toEqual(['minor', 'major', 'dominant']);
    // With matching content available, the drawn mutation's own tier matches.
    for (const c of cards) expect(c.mutation.tier).toBe(c.tier);
  });

  it('falls back gracefully when the required tier has no content', () => {
    // Minor-only pool but a deep floor that wants Major/Dominant.
    const pool = makePool(4, 'minor');
    const cards = drawMutationCards({ pool, owned: [], floor: 15, rng: makeRng(8, 'mutationdraw') });
    expect(cards).toHaveLength(3);
    // Requested tiers still reflect the floor; actual mutations fall back to minor.
    expect(cards.map((c) => c.tier)).toEqual(['minor', 'major', 'dominant']);
    for (const c of cards) expect(c.mutation.tier).toBe('minor');
  });

  it('defaults to floor 1 (all Minor) when no floor is supplied', () => {
    const pool = [...makePool(2, 'minor'), ...makePool(2, 'major')];
    const cards = drawMutationCards({ pool, owned: [makeMutation()], rng: makeRng(2, 'mutationdraw') });
    for (const c of cards) expect(c.tier).toBe('minor');
  });
});
