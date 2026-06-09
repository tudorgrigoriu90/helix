import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  VEIN_PER_KILL,
  FLOOR_VEIN_CONSTANT,
  DROP_RATES,
  XP_BASE,
  XP_GROWTH,
  RUN_LEVEL_CAP,
  SHARD_PER_VEIN,
  SHARD_DAILY_RUN,
  SHARD_ACHIEVEMENT,
  RARITY_VEIN_MULT,
  BASE_DISPENSER_VEIN,
  ZONE_PRICE_GROWTH,
  FLOORS_PER_ZONE,
} from './index';
import { MAX_FLOOR, ZONES, WARDEN_FLOORS } from '../campaign';
import { SIG_CAP, LACE_EVENT_SIG_BONUS } from '../mutation/sig';

/**
 * Economy ↔ lock reconciliation — T-322 (review finding F2 class).
 *
 * The locked workbook's driver cells are checked in as
 * `packages/content/economy-lock.json`; this suite asserts the code constants
 * equal them, so a tuning edit on either side fails CI until both move
 * together (and the lock doc is re-locked). This permanently closes the silent
 * code/model drift that produced the boss over-pay (F2).
 */

const LOCK_PATH = fileURLToPath(
  new URL('../../../../../packages/content/economy-lock.json', import.meta.url),
);

interface EconomyLock {
  readonly campaign: {
    readonly maxFloor: number;
    readonly zones: number;
    readonly floorsPerZone: number;
    readonly wardenFloors: readonly number[];
  };
  readonly veinPerKill: Record<string, number>;
  readonly floorVeinConstant: number;
  readonly dropRates: Record<string, Record<string, number>>;
  readonly xp: { readonly base: number; readonly growthPerLevel: number; readonly runLevelCap: number };
  readonly shards: { readonly perVein: number; readonly dailyRun: number; readonly achievement: number };
  readonly dispenser: {
    readonly rarityVeinMult: Record<string, number>;
    readonly baseVein: number;
    readonly zonePriceGrowth: number;
  };
  readonly sig: { readonly cap: number; readonly laceEventBonus: number };
}

const lock = JSON.parse(readFileSync(LOCK_PATH, 'utf-8')) as EconomyLock;

describe('economy ↔ lock reconciliation — T-322', () => {
  it('campaign structure matches the lock', () => {
    expect(MAX_FLOOR).toBe(lock.campaign.maxFloor);
    expect(ZONES.length).toBe(lock.campaign.zones);
    expect(FLOORS_PER_ZONE).toBe(lock.campaign.floorsPerZone);
    expect([...WARDEN_FLOORS]).toEqual([...lock.campaign.wardenFloors]);
  });

  it('VEIN drops match the lock (incl. the DR-008 boss split)', () => {
    expect({ ...VEIN_PER_KILL }).toEqual(lock.veinPerKill);
    expect(FLOOR_VEIN_CONSTANT).toBe(lock.floorVeinConstant);
  });

  it('bonus drop rates match the lock (and carry no SIG column — DR-007)', () => {
    const codeRates = Object.fromEntries(
      Object.entries(DROP_RATES).map(([tier, r]) => [tier, { ...r }]),
    );
    expect(codeRates).toEqual(lock.dropRates);
  });

  it('XP curve drivers match the lock', () => {
    expect(XP_BASE).toBe(lock.xp.base);
    expect(XP_GROWTH).toBe(lock.xp.growthPerLevel);
    expect(RUN_LEVEL_CAP).toBe(lock.xp.runLevelCap);
  });

  it('Shard earn rates match the lock', () => {
    expect(SHARD_PER_VEIN).toBe(lock.shards.perVein);
    expect(SHARD_DAILY_RUN).toBe(lock.shards.dailyRun);
    expect(SHARD_ACHIEVEMENT).toBe(lock.shards.achievement);
  });

  it('Dispenser pricing drivers match the lock', () => {
    expect({ ...RARITY_VEIN_MULT }).toEqual(lock.dispenser.rarityVeinMult);
    expect(BASE_DISPENSER_VEIN).toBe(lock.dispenser.baseVein);
    expect(ZONE_PRICE_GROWTH).toBe(lock.dispenser.zonePriceGrowth);
  });

  it('SIG drivers match the lock (DR-007 draft-only model)', () => {
    expect(SIG_CAP).toBe(lock.sig.cap);
    expect(LACE_EVENT_SIG_BONUS).toBe(lock.sig.laceEventBonus);
  });
});
