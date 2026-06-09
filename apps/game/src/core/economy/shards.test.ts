import { describe, it, expect } from 'vitest';
import {
  shardsFromRunVein,
  shardsForRun,
  floorShards,
  SHARD_PER_VEIN,
  SHARD_DAILY_RUN,
  SHARD_ACHIEVEMENT,
} from './shards';

describe('Shard Crystal earn rates — T-107 (GDD §15.5, Economy.xlsx)', () => {
  it('uses the workbook conversion rate', () => {
    expect(SHARD_PER_VEIN).toBe(0.005);
  });

  it('converts run VEIN to shards (floor 1 income → 0.7575)', () => {
    expect(shardsFromRunVein(151.5)).toBeCloseTo(0.7575, 6);
  });

  it('a full 30-floor run (~4797.5 VEIN) yields ~24 shards (workbook total)', () => {
    expect(shardsFromRunVein(4797.5)).toBeCloseTo(23.9875, 4);
  });

  it('adds the daily-run bonus only on the first run of the day', () => {
    const base = shardsFromRunVein(1000); // 5
    expect(shardsForRun({ vein: 1000, firstRunToday: true, achievementsUnlocked: 0 })).toBeCloseTo(base + SHARD_DAILY_RUN, 6);
    expect(shardsForRun({ vein: 1000, firstRunToday: false, achievementsUnlocked: 0 })).toBeCloseTo(base, 6);
  });

  it('adds a flat bonus per achievement unlocked', () => {
    const total = shardsForRun({ vein: 1000, firstRunToday: true, achievementsUnlocked: 2 });
    expect(total).toBeCloseTo(5 + SHARD_DAILY_RUN + 2 * SHARD_ACHIEVEMENT, 6); // 5 + 5 + 20 = 30
  });

  it('floors a fractional accrued balance to spendable shards', () => {
    expect(floorShards(23.9875)).toBe(23);
    expect(floorShards(0.7575)).toBe(0);
    expect(floorShards(-3)).toBe(0);
  });
});
