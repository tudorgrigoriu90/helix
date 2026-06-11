import { describe, it, expect } from 'vitest';
import { makeRng } from '../rng/mulberry32';
import {
  veinForKill,
  expectedFloorVein,
  rollKillDrops,
  VEIN_PER_KILL,
  FLOOR_VEIN_CONSTANT,
  DROP_RATES,
} from './drops';

describe('VEIN drops — T-106 (GDD §9.4, Economy.xlsx)', () => {
  it('per-kill VEIN matches the workbook drivers', () => {
    expect(VEIN_PER_KILL).toEqual({ grunt: 8, elite: 25, floor_boss: 45, zone_warden: 120 });
    expect(veinForKill('grunt')).toBe(8);
    expect(veinForKill('floor_boss')).toBe(45);
    expect(veinForKill('zone_warden')).toBe(120);
    expect(FLOOR_VEIN_CONSTANT).toBe(50);
  });

  it('reproduces the workbook PER-FLOOR INCOME with the boss unkilled (floor 1 = 151.5)', () => {
    expect(expectedFloorVein(8, 1.5, null)).toBe(151.5); // 64 + 37.5 + 50
  });

  it('reproduces a warden floor income (= 202)', () => {
    expect(expectedFloorVein(4, 0, 'zone_warden')).toBe(202); // 32 + 120 + 50
  });

  it('reflects a Floor Boss kill on a non-warden floor (T-502, DR-008)', () => {
    expect(expectedFloorVein(4, 0, 'floor_boss')).toBe(127); // 32 + 45 + 50
  });

  it('drop-rate table matches the Drop Rates tab', () => {
    expect(DROP_RATES.grunt).toEqual({ vein: 1, mod: 0.05, rareCore: 0, epicCore: 0 });
    expect(DROP_RATES.elite.mod).toBe(0.3);
    expect(DROP_RATES.floor_boss.rareCore).toBe(0.6);
    expect(DROP_RATES.zone_warden.rareCore).toBe(0.6);
    expect(DROP_RATES.zone_warden.epicCore).toBe(0.15);
  });

  it('rolls no SIG drop — SIG comes only from mutations (T-500, DR-007)', () => {
    expect(Object.keys(DROP_RATES.grunt)).not.toContain('sig');
    expect(Object.keys(rollKillDrops('zone_warden', makeRng(1, 'loot')))).not.toContain('sig');
  });

  it('always grants VEIN at the tier amount', () => {
    for (const tier of ['grunt', 'elite', 'floor_boss', 'zone_warden'] as const) {
      const d = rollKillDrops(tier, makeRng(1, 'loot'));
      expect(d.vein).toBe(VEIN_PER_KILL[tier]);
    }
  });

  it('a boss never drops item mods (probability 0)', () => {
    for (let seed = 0; seed < 50; seed++) {
      expect(rollKillDrops('floor_boss', makeRng(seed, 'loot')).mod).toBe(false);
      expect(rollKillDrops('zone_warden', makeRng(seed, 'loot')).mod).toBe(false);
    }
  });

  it('a grunt never drops rare or epic cores (probability 0)', () => {
    for (let seed = 0; seed < 50; seed++) {
      const d = rollKillDrops('grunt', makeRng(seed, 'loot'));
      expect(d.rareCore).toBe(false);
      expect(d.epicCore).toBe(false);
    }
  });

  it('is deterministic for a given seed', () => {
    expect(rollKillDrops('elite', makeRng(42, 'loot'))).toEqual(rollKillDrops('elite', makeRng(42, 'loot')));
  });
});
