import { describe, it, expect } from 'vitest';
import {
  accumulateSig,
  sigBonusFor,
  gainMutationSig,
  SIG_CAP,
  LACE_EVENT_SIG_BONUS,
} from './sig';
import { makeMutation } from './test-fixtures';

describe('SIG accrual + cap — T-94 (GDD §4.2)', () => {
  it('the SIG cap is 40 and LACE-event bonus is +5', () => {
    expect(SIG_CAP).toBe(40);
    expect(LACE_EVENT_SIG_BONUS).toBe(5);
  });

  it('accumulates SIG additively below the cap', () => {
    expect(accumulateSig(0, 10)).toBe(10);
    expect(accumulateSig(10, 10)).toBe(20);
  });

  it('clamps at the 40 cap', () => {
    expect(accumulateSig(38, 10)).toBe(40);
    expect(accumulateSig(40, 10)).toBe(40);
  });

  it('floors at 0 for a negative bonus', () => {
    expect(accumulateSig(3, -10)).toBe(0);
  });

  it('a Strand mutation grants its own sigBonus', () => {
    expect(sigBonusFor(makeMutation({ sigBonus: 10 }), 'strand')).toBe(10);
    expect(sigBonusFor(makeMutation({ sigBonus: 15 }), 'strand')).toBe(15);
  });

  it('a LACE-event mutation grants a flat +5 regardless of sigBonus', () => {
    expect(sigBonusFor(makeMutation({ sigBonus: 10 }), 'lace_event')).toBe(5);
    expect(sigBonusFor(makeMutation({ sigBonus: 99 }), 'lace_event')).toBe(5);
  });

  it('the canonical run reaches 35 SIG (3 Strand + 1 LACE), under the cap', () => {
    const m = makeMutation({ sigBonus: 10 });
    let sig = 0;
    sig = gainMutationSig(sig, m, 'strand'); // 10
    sig = gainMutationSig(sig, m, 'strand'); // 20
    sig = gainMutationSig(sig, m, 'strand'); // 30
    sig = gainMutationSig(sig, m, 'lace_event'); // 35
    expect(sig).toBe(35);
  });

  it('gainMutationSig respects the cap when already high', () => {
    const m = makeMutation({ sigBonus: 10 });
    expect(gainMutationSig(35, m, 'strand')).toBe(40); // 35 + 10 → capped
  });
});
