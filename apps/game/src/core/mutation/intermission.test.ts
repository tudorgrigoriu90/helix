import { describe, it, expect } from 'vitest';
import {
  resolveStrandEvent,
  isMutationCapped,
  MUTATION_CAP,
  VEIN_INTERMISSION_REWARD_VC,
} from './intermission';

describe('VEIN Intermission trigger — T-93 (GDD §3.5 / §4.2)', () => {
  it('the mutation cap is four (SIG cap 40)', () => {
    expect(MUTATION_CAP).toBe(4);
  });

  it('offers a normal card draw below the cap', () => {
    for (const count of [0, 1, 2, 3]) {
      expect(isMutationCapped(count)).toBe(false);
      expect(resolveStrandEvent(count)).toEqual({ kind: 'draw' });
    }
  });

  it('becomes a VEIN Intermission (+100 VC) at the cap', () => {
    expect(isMutationCapped(MUTATION_CAP)).toBe(true);
    expect(resolveStrandEvent(MUTATION_CAP)).toEqual({
      kind: 'intermission',
      veinCrystals: VEIN_INTERMISSION_REWARD_VC,
    });
    expect(VEIN_INTERMISSION_REWARD_VC).toBe(100);
  });

  it('stays an intermission past the cap (defensive)', () => {
    expect(resolveStrandEvent(5).kind).toBe('intermission');
  });
});
