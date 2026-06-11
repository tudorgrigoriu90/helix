import { describe, it, expect } from 'vitest';
import type { FloorTemplate } from '@shared-types/floor-template';
import type { EnemyDef } from '@shared-types/enemy';
import type { ItemCategory, ItemDef } from '@shared-types/item';
import { RunSession } from './run-session';
import { buildEnemyRegistry, type EnemyRegistry } from './encounter';

function template(): FloorTemplate {
  return {
    schemaVersion: 1, floor: 1, zone: 'shallows',
    roomCount: { min: 8, max: 12 },
    roomWeights: { combat: 0.5, loot: 0.15, safe: 0.15, merchant: 0.1, trap: 0.05, lace_event: 0.05 },
    roomMinima: { safe: 1 }, connectivity: 'branching',
    enemyPool: ['filterer'], bossId: 'pressure_warden', aestheticTags: ['caves'],
  };
}
const registry: EnemyRegistry = buildEnemyRegistry([
  { schemaVersion: 1, id: 'filterer', name: 'F', tier: 'grunt', zone: 'shallows', maxHp: 16, stats: { str: 6, res: 2, agi: 5, int: 2 }, damageType: 'physical', aestheticTags: [] } as EnemyDef,
  { schemaVersion: 1, id: 'pressure_warden', name: 'B', tier: 'floor_boss', zone: 'shallows', maxHp: 60, stats: { str: 6, res: 2, agi: 5, int: 2 }, damageType: 'physical', aestheticTags: [] } as EnemyDef,
]);

const mk = (category: ItemCategory, id: string): ItemDef => ({ id, name: id, rarity: 'common', category, effect: null });
const session = (): RunSession => new RunSession({ seed: 1, template: template(), registry });

describe('RunSession — inventory slots (T-443, GDD §9.5)', () => {
  it('enforces the per-category cap and reports room + counts', () => {
    const s = session();
    expect(s.addItem(mk('equipment', 'e1'))).toBe(true);
    expect(s.addItem(mk('equipment', 'e2'))).toBe(true);
    expect(s.canCarry(mk('equipment', 'e3'))).toBe(false); // 2/2 equipment full
    expect(s.addItem(mk('equipment', 'e3'))).toBe(false);
    expect(s.inventory().equipment).toEqual({ count: 2, limit: 2 });
    // A full category doesn't block others.
    expect(s.canCarry(mk('passive', 'p1'))).toBe(true);
  });

  it('drop frees a slot; swap makes room atomically (the model-b flow)', () => {
    const s = session();
    s.addItem(mk('equipment', 'e1'));
    s.addItem(mk('equipment', 'e2'));
    s.dropItem('e1');
    expect(s.canCarry(mk('equipment', 'e3'))).toBe(true);
    s.addItem(mk('equipment', 'e3'));
    s.swapItem('e2', mk('equipment', 'e4')); // full → drop e2, take e4
    const eq = s.snapshot.player.items.filter((i) => i.category === 'equipment').map((i) => i.id).sort();
    expect(eq).toEqual(['e3', 'e4']); // still 2/2, swapped not stacked
  });

  it('starter consumables count toward the consumable cap', () => {
    const s = session();
    // newRunPlayer ships 3 consumables.
    expect(s.inventory().consumable.count).toBe(3);
    expect(s.canCarry(mk('consumable', 'c'))).toBe(true); // 3/6
  });

  it('adding a passive applies its modifiers; dropping/swapping reverses them (T-444)', () => {
    const s = session();
    const baseHp = s.snapshot.player.maxHp;
    const baseRes = s.snapshot.player.stats.res;
    const gauge: ItemDef = { id: 'gauge', name: 'Gauge', rarity: 'common', category: 'passive', effect: null, modifiers: [{ kind: 'maxHp', delta: 10 }] };
    const plate: ItemDef = { id: 'plate', name: 'Plate', rarity: 'common', category: 'passive', effect: null, modifiers: [{ kind: 'stat', stat: 'res', delta: 6 }] };

    s.addItem(gauge);
    expect(s.snapshot.player.maxHp).toBe(baseHp + 10);
    s.dropItem('gauge');
    expect(s.snapshot.player.maxHp).toBe(baseHp); // reversed

    s.addItem(gauge);
    s.swapItem('gauge', plate); // drop gauge (+10 HP off), take plate (+6 RES on)
    expect(s.snapshot.player.maxHp).toBe(baseHp);
    expect(s.snapshot.player.stats.res).toBe(baseRes + 6);
  });

  it('cursed items apply but cannot be dropped or swapped out until purged (T-449)', () => {
    const s = session();
    const baseStr = s.snapshot.player.stats.str;
    const curse: ItemDef = {
      id: 'hungry', name: 'Hungry Blade', rarity: 'rare', category: 'equipment', effect: null,
      cursed: true, modifiers: [{ kind: 'stat', stat: 'str', delta: 6 }, { kind: 'maxHp', delta: -8 }],
    };
    s.addItem(curse);
    expect(s.snapshot.player.stats.str).toBe(baseStr + 6); // positive applied
    expect(s.canDrop('hungry')).toBe(false);

    s.dropItem('hungry'); // no-op for a cursed item
    expect(s.snapshot.player.items.some((i) => i.id === 'hungry')).toBe(true);
    s.swapItem('hungry', mk('equipment', 'other')); // can't swap out a cursed item
    expect(s.snapshot.player.items.some((i) => i.id === 'other')).toBe(false);

    s.purgeCursed(); // the Purge Serum
    expect(s.snapshot.player.items.some((i) => i.id === 'hungry')).toBe(false);
    expect(s.snapshot.player.stats.str).toBe(baseStr); // modifiers reversed on purge
  });
});
