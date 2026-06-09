import { describe, it, expect } from 'vitest';
import {
  xpToNext,
  cumulativeXpForLevel,
  levelForTotalXp,
  levelUpReward,
  xpForKill,
  XP_BASE,
  XP_GROWTH,
  RUN_LEVEL_CAP,
} from './xp';

describe('XP & level curve — T-105 (GDD §4.3, Economy.xlsx)', () => {
  it('uses the workbook drivers (base 100, growth 0.15, run cap 20)', () => {
    expect(XP_BASE).toBe(100);
    expect(XP_GROWTH).toBe(0.15);
    expect(RUN_LEVEL_CAP).toBe(20);
  });

  it('matches the workbook "XP to next" column exactly', () => {
    // From the Economy.xlsx PER-LEVEL TABLE.
    const expected = [100, 115, 132, 152, 175, 201, 231, 266, 306, 352];
    for (let l = 1; l <= expected.length; l++) {
      expect(xpToNext(l), `level ${l}`).toBe(expected[l - 1]);
    }
  });

  it('matches the workbook cumulative XP column', () => {
    const cum = [0, 100, 215, 347, 499, 674, 875, 1106, 1372, 1678];
    for (let l = 1; l <= cum.length; l++) {
      expect(cumulativeXpForLevel(l), `level ${l}`).toBe(cum[l - 1]);
    }
  });

  it('xp curve is strictly increasing', () => {
    for (let l = 1; l < 20; l++) expect(xpToNext(l + 1)).toBeGreaterThan(xpToNext(l));
  });

  it('levelForTotalXp maps accumulated XP to the right level', () => {
    expect(levelForTotalXp(0)).toBe(1);
    expect(levelForTotalXp(99)).toBe(1);
    expect(levelForTotalXp(100)).toBe(2); // exactly enough for level 2
    expect(levelForTotalXp(214)).toBe(2);
    expect(levelForTotalXp(215)).toBe(3);
    expect(levelForTotalXp(1678)).toBe(10);
  });

  it('clamps to the run level cap', () => {
    expect(levelForTotalXp(Number.MAX_SAFE_INTEGER)).toBe(RUN_LEVEL_CAP);
    expect(levelForTotalXp(10_000_000, 5)).toBe(5);
  });

  it('each level-up grants +10 HP and +1 stat point (AP does not scale)', () => {
    expect(levelUpReward()).toEqual({ hp: 10, statPoints: 1 });
  });

  it('rejects levels below 1', () => {
    expect(() => xpToNext(0)).toThrow(RangeError);
    expect(() => cumulativeXpForLevel(0)).toThrow(RangeError);
  });

  it('per-kill XP rises with tier and yields ~1 level on a representative floor', () => {
    expect(xpForKill('grunt')).toBe(12);
    expect(xpForKill('elite')).toBe(40);
    expect(xpForKill('floor_boss')).toBe(200);
    expect(xpForKill('zone_warden')).toBe(200);
    // ~8 grunts + ~1.5 elites ≈ 156 XP → clears level 1→2 (needs 100).
    const floorXp = 8 * xpForKill('grunt') + 1.5 * xpForKill('elite');
    expect(levelForTotalXp(floorXp)).toBeGreaterThanOrEqual(2);
  });
});
