import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  VEIN_PER_KILL,
  FLOOR_VEIN_CONSTANT,
  DROP_RATES,
} from './drops';
import {
  SHARD_PER_VEIN,
  SHARD_DAILY_RUN,
  SHARD_ACHIEVEMENT,
} from './shards';
import {
  BASE_DISPENSER_VEIN,
  RARITY_VEIN_MULT,
  ZONE_PRICE_GROWTH,
  FLOORS_PER_ZONE,
} from './pricing';
import { XP_BASE, XP_GROWTH, RUN_LEVEL_CAP, XP_PER_KILL } from './xp';
import { SIG_CAP, LACE_EVENT_SIG_BONUS } from '../mutation/sig';
import { MAX_FLOOR, ZONE_COUNT, WARDEN_FLOORS } from '@shared-types/campaign';

/**
 * Economy ↔ lock reconciliation — T-522 (review F2 class).
 *
 * `packages/content/economy-lock.json` is the checked-in export of the Economy
 * workbook's driver cells (re-exported whenever the workbook re-locks). This
 * suite asserts the shipped code constants equal it, so code and model can
 * never drift silently again — the failure mode behind the F2 boss over-pay,
 * where a "matches code exactly" reconciliation note went stale. Any
 * intentional change must touch both sides (and the Lock doc) in one PR.
 */

interface EconomyLock {
  readonly schemaVersion: number;
  readonly campaign: {
    readonly maxFloor: number;
    readonly zones: number;
    readonly floorsPerZone: number;
    readonly wardenFloors: readonly number[];
  };
  readonly vein: {
    readonly perKill: Readonly<Record<string, number>>;
    readonly perFloorConstant: number;
  };
  readonly dropRates: Readonly<
    Record<string, { vein: number; mod: number; rareCore: number; epicCore: number }>
  >;
  readonly shards: {
    readonly perVein: number;
    readonly dailyRun: number;
    readonly achievement: number;
  };
  readonly dispenser: {
    readonly baseVein: number;
    readonly rarityMult: Readonly<Record<string, number>>;
    readonly zonePriceGrowth: number;
  };
  readonly xp: {
    readonly base: number;
    readonly growth: number;
    readonly levelCap: number;
    readonly perKill: Readonly<Record<string, number>>;
  };
  readonly sig: {
    readonly cap: number;
    readonly strandBonus: number;
    readonly laceEventBonus: number;
  };
}

const LOCK_PATH = fileURLToPath(
  new URL('../../../../../packages/content/economy-lock.json', import.meta.url),
);
const lock = JSON.parse(readFileSync(LOCK_PATH, 'utf-8')) as EconomyLock;

describe('economy ↔ lock reconciliation — T-522', () => {
  it('campaign shape matches the lock', () => {
    expect(lock.campaign.zones * lock.campaign.floorsPerZone).toBe(lock.campaign.maxFloor);
    expect(MAX_FLOOR).toBe(lock.campaign.maxFloor);
    expect(ZONE_COUNT).toBe(lock.campaign.zones);
    expect(FLOORS_PER_ZONE).toBe(lock.campaign.floorsPerZone);
    expect(RUN_LEVEL_CAP).toBe(lock.campaign.maxFloor); // one level per floor (GDD §4.3)
    expect([...WARDEN_FLOORS]).toEqual([...lock.campaign.wardenFloors]);
  });

  it('VEIN drops match the lock (DR-008 tier split)', () => {
    expect(VEIN_PER_KILL).toEqual(lock.vein.perKill);
    expect(FLOOR_VEIN_CONSTANT).toBe(lock.vein.perFloorConstant);
  });

  it('bonus-drop rates match the lock (no SIG column — DR-007)', () => {
    expect(DROP_RATES).toEqual(lock.dropRates);
    for (const rates of Object.values(lock.dropRates)) {
      expect(Object.keys(rates)).not.toContain('sig');
    }
  });

  it('Shard earn rates match the lock — and no revive sink exists (DR-010)', () => {
    expect(SHARD_PER_VEIN).toBe(lock.shards.perVein);
    expect(SHARD_DAILY_RUN).toBe(lock.shards.dailyRun);
    expect(SHARD_ACHIEVEMENT).toBe(lock.shards.achievement);
    // DR-010: Shards are cosmetics-only — a revive cost may never reappear.
    expect((lock.shards as Record<string, unknown>)['reviveCost']).toBeUndefined();
  });

  it('Dispenser pricing drivers match the lock', () => {
    expect(BASE_DISPENSER_VEIN).toBe(lock.dispenser.baseVein);
    expect(RARITY_VEIN_MULT).toEqual(lock.dispenser.rarityMult);
    expect(ZONE_PRICE_GROWTH).toBe(lock.dispenser.zonePriceGrowth);
  });

  it('XP curve and per-kill XP match the lock', () => {
    expect(XP_BASE).toBe(lock.xp.base);
    expect(XP_GROWTH).toBe(lock.xp.growth);
    expect(RUN_LEVEL_CAP).toBe(lock.xp.levelCap);
    expect(XP_PER_KILL).toEqual(lock.xp.perKill);
  });

  it('SIG model matches the lock (DR-007: run-scoped, draft-only)', () => {
    expect(SIG_CAP).toBe(lock.sig.cap);
    expect(LACE_EVENT_SIG_BONUS).toBe(lock.sig.laceEventBonus);
  });

  it('every shipped mutation grants the locked flat Strand SIG bonus (DR-007)', () => {
    const dir = fileURLToPath(new URL('../../../../../packages/content/mutations/', import.meta.url));
    const files = readdirSync(dir).filter((f) => f.endsWith('.json'));
    expect(files.length).toBeGreaterThan(0);
    for (const file of files) {
      const raw = JSON.parse(readFileSync(`${dir}${file}`, 'utf-8')) as { sigBonus?: number };
      expect(raw.sigBonus, file).toBe(lock.sig.strandBonus);
    }
  });
});
