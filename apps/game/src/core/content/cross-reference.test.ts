import { describe, it, expect } from 'vitest';
import type { EnemyDef } from '@shared-types/enemy';
import type { FloorTemplate } from '@shared-types/floor-template';
import type { ItemDef } from '@shared-types/item';
import type { MutationDef } from '@shared-types/mutation';
import { crossReferenceContent, type ContentBundle } from './cross-reference';

function enemy(id: string, tier: EnemyDef['tier'] = 'grunt'): EnemyDef {
  return {
    schemaVersion: 1,
    id,
    name: id,
    tier,
    zone: 'shallows',
    maxHp: 20,
    stats: { str: 5, res: 5, agi: 5, int: 5 },
    damageType: 'physical',
    aestheticTags: ['caves'],
  };
}

function item(id: string): ItemDef {
  return { id, name: id, rarity: 'common', category: 'passive', effect: null };
}

function floor(over: Partial<FloorTemplate> = {}): FloorTemplate {
  return {
    schemaVersion: 1,
    floor: 1,
    zone: 'shallows',
    roomCount: { min: 8, max: 14 },
    roomWeights: { combat: 0.4, loot: 0.2, safe: 0.15, merchant: 0.1, trap: 0.1, lace_event: 0.05 },
    roomMinima: { safe: 1 },
    connectivity: 'branching',
    enemyPool: ['grunt_a'],
    bossId: 'big_boss',
    aestheticTags: ['caves'],
    ...over,
  };
}

function mutation(id: string): MutationDef {
  return {
    id,
    family: 'abyssal',
    tier: 'minor',
    name: id,
    sigBonus: 10,
    modifiers: [],
    grantsAbility: null,
    lace: 'test line',
    tags: [],
  };
}

function bundle(over: Partial<ContentBundle> = {}): ContentBundle {
  return {
    enemies: [enemy('grunt_a'), enemy('big_boss', 'floor_boss')],
    items: [item('x')],
    floors: [floor()],
    mutations: [mutation('m1')],
    ...over,
  };
}

describe('crossReferenceContent — T-288', () => {
  it('returns no errors for a consistent bundle', () => {
    expect(crossReferenceContent(bundle())).toEqual([]);
  });

  it('flags an enemyPool id with no matching enemy', () => {
    const errs = crossReferenceContent(bundle({
      enemies: [enemy('big_boss', 'floor_boss')], // grunt_a missing
    }));
    expect(errs.some((e) => e.field === 'enemyPool' && e.message.includes('grunt_a'))).toBe(true);
  });

  it('flags a bossId with no matching enemy', () => {
    const errs = crossReferenceContent(bundle({
      enemies: [enemy('grunt_a')], // big_boss missing
    }));
    expect(errs.some((e) => e.field === 'bossId' && e.message.includes('big_boss'))).toBe(true);
  });

  it('flags a bossId that resolves to a non-boss enemy', () => {
    const errs = crossReferenceContent(bundle({
      enemies: [enemy('grunt_a'), enemy('big_boss', 'grunt')], // wrong tier
    }));
    expect(errs.some((e) => e.field === 'bossId' && e.message.includes('expected a boss'))).toBe(true);
  });

  it('flags a floor_boss on a zone-end floor — wardens only (DR-008, T-501)', () => {
    const errs = crossReferenceContent(bundle({
      floors: [floor({ floor: 5 })], // floor 5 demands a zone_warden
    }));
    expect(errs.some((e) => e.field === 'bossId' && e.message.includes('expected "zone_warden"'))).toBe(true);
  });

  it('flags a zone_warden on a non-zone-end floor (DR-008, T-501)', () => {
    const errs = crossReferenceContent(bundle({
      enemies: [enemy('grunt_a'), enemy('big_boss', 'zone_warden')],
    }));
    expect(errs.some((e) => e.field === 'bossId' && e.message.includes('expected "floor_boss"'))).toBe(true);
  });

  it('accepts a zone_warden on a zone-end floor (DR-008, T-501)', () => {
    const errs = crossReferenceContent(bundle({
      enemies: [enemy('grunt_a'), enemy('big_boss', 'zone_warden')],
      floors: [floor({ floor: 10 })],
    }));
    expect(errs).toEqual([]);
  });

  it('flags duplicate enemy and item ids', () => {
    const errs = crossReferenceContent(bundle({
      enemies: [enemy('grunt_a'), enemy('grunt_a'), enemy('big_boss', 'floor_boss')],
      items: [item('x'), item('x')],
    }));
    expect(errs.filter((e) => e.message.includes('duplicate enemy id'))).toHaveLength(1);
    expect(errs.filter((e) => e.message.includes('duplicate item id'))).toHaveLength(1);
  });

  it('flags duplicate mutation ids', () => {
    const errs = crossReferenceContent(bundle({
      mutations: [mutation('dup'), mutation('dup'), mutation('unique')],
    }));
    expect(errs.filter((e) => e.message.includes('duplicate mutation id'))).toHaveLength(1);
  });

  it('reports every problem at once rather than short-circuiting', () => {
    const errs = crossReferenceContent(bundle({
      enemies: [], // both enemyPool and bossId now dangle
    }));
    expect(errs.length).toBeGreaterThanOrEqual(2);
  });
});
