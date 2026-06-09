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

describe('VEIN drops — T-106 (GDD §9.4, Economy.xlsx) + DR-008 tier split (T-302)', () => {
  it('per-kill VEIN matches the workbook drivers with the DR-008 boss split', () => {
    expect(VEIN_PER_KILL).toEqual({ grunt: 8, elite: 25, floor_boss: 45, zone_warden: 120 });
    expect(veinForKill('grunt')).toBe(8);
    expect(veinForKill('floor_boss')).toBe(45);
    expect(veinForKill('zone_warden')).toBe(120);
    expect(FLOOR_VEIN_CONSTANT).toBe(50);
  });

  it('reproduces the workbook PER-FLOOR INCOME with a Floor Boss (= 196.5)', () => {
    expect(expectedFloorVein(8, 1.5, 'floor_boss')).toBe(196.5); // 64 + 37.5 + 45 + 50
  });

  it('reproduces a Warden floor income (= 202)', () => {
    expect(expectedFloorVein(4, 0, 'zone_warden')).toBe(202); // 32 + 120 + 50
  });

  it('drop-rate table matches the Drop Rates tab (no SIG drop — removed by T-300)', () => {
    expect(DROP_RATES.grunt).toEqual({ vein: 1, mod: 0.05, rareCore: 0, epicCore: 0 });
    expect(DROP_RATES.elite.mod).toBe(0.3);
    expect(DROP_RATES.zone_warden.rareCore).toBe(0.6);
    expect(DROP_RATES.zone_warden.epicCore).toBe(0.15);
    // Floor Boss cores sit between elite and Warden (DR-008).
    expect(DROP_RATES.floor_boss.rareCore).toBeGreaterThan(DROP_RATES.elite.rareCore);
    expect(DROP_RATES.floor_boss.rareCore).toBeLessThan(DROP_RATES.zone_warden.rareCore);
    // DR-007: SIG is never a drop — it comes only from acquired mutations.
    for (const rates of Object.values(DROP_RATES)) {
      expect(rates).not.toHaveProperty('sig');
    }
  });

  it('always grants VEIN at the tier amount', () => {
    for (const tier of ['grunt', 'elite', 'floor_boss', 'zone_warden'] as const) {
      const d = rollKillDrops(tier, makeRng(1, 'loot'));
      expect(d.vein).toBe(VEIN_PER_KILL[tier]);
    }
  });

  it('kill drops carry no SIG field (T-300 / DR-007)', () => {
    for (let seed = 0; seed < 50; seed++) {
      expect(rollKillDrops('zone_warden', makeRng(seed, 'loot'))).not.toHaveProperty('sig');
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
