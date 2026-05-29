import { describe, it, expect } from 'vitest';
import { HP_SCALE_PER_FLOOR, scaledMaxHp, scaledStats } from './scaling';

const base = { str: 10, res: 4, agi: 6, int: 5 };

describe('difficulty scaling — T-78', () => {
  it('treats Floor 1 as the authored baseline (no scaling)', () => {
    expect(scaledMaxHp(20, 1)).toBe(20);
    expect(scaledStats(base, 1)).toEqual(base);
  });

  it('scales HP up per floor', () => {
    expect(scaledMaxHp(20, 2)).toBe(Math.round(20 * (1 + HP_SCALE_PER_FLOOR)));
    expect(scaledMaxHp(20, 6)).toBe(Math.round(20 * (1 + 5 * HP_SCALE_PER_FLOOR)));
  });

  it('scales STR but leaves RES/AGI/INT flat (enemies stay killable; stable crit + AI)', () => {
    const s = scaledStats(base, 6);
    expect(s.str).toBeGreaterThan(base.str);
    expect(s.res).toBe(base.res); // flat so player damage stays meaningful at depth
    expect(s.agi).toBe(base.agi);
    expect(s.int).toBe(base.int);
  });

  it('grows monotonically with depth, and HP outpaces offense', () => {
    expect(scaledMaxHp(20, 10)).toBeGreaterThan(scaledMaxHp(20, 5));
    // 0.15/floor HP vs 0.10/floor STR — HP ratio should exceed STR ratio at depth.
    const hpRatio = scaledMaxHp(100, 11) / 100;
    const strRatio = scaledStats({ str: 100, res: 10, agi: 1, int: 1 }, 11).str / 100;
    expect(hpRatio).toBeGreaterThan(strRatio);
  });

  it('clamps non-positive floors to the baseline', () => {
    expect(scaledMaxHp(20, 0)).toBe(20);
    expect(scaledMaxHp(20, -3)).toBe(20);
  });
});
