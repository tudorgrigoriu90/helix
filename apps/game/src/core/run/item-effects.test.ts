import { describe, it, expect } from 'vitest';
import type { ItemDef } from '@shared-types/item';
import { newRunPlayer } from './start-player';
import { equipItem, unequipItem } from './item-effects';

const passive = (id: string, modifiers: ItemDef['modifiers']): ItemDef => ({
  id, name: id, rarity: 'common', category: 'passive', effect: null, modifiers,
});

describe('item-effects — T-444 passive modifier application', () => {
  it('equip raises max HP and current HP together; unequip takes both back', () => {
    const base = newRunPlayer();
    const gauge = passive('depth_gauge', [{ kind: 'maxHp', delta: 10 }]);
    const equipped = equipItem(base, gauge);
    expect(equipped.maxHp).toBe(base.maxHp + 10);
    expect(equipped.hp).toBe(base.hp + 10);
    expect(unequipItem(equipped, gauge)).toEqual(base); // exact round-trip
  });

  it('equip adds a stat delta; unequip reverses it', () => {
    const base = newRunPlayer();
    const plate = passive('chitin_plate', [{ kind: 'stat', stat: 'res', delta: 6 }]);
    const equipped = equipItem(base, plate);
    expect(equipped.stats.res).toBe(base.stats.res + 6);
    expect(unequipItem(equipped, plate).stats.res).toBe(base.stats.res);
  });

  it('is a no-op for items without modifiers (plain consumables)', () => {
    const base = newRunPlayer();
    const potion: ItemDef = { id: 'p', name: 'p', rarity: 'common', category: 'consumable', effect: { kind: 'heal', amount: 10 } };
    expect(equipItem(base, potion)).toEqual(base);
  });

  it('clamps current HP down when unequipping a max-HP item after taking damage', () => {
    const gauge = passive('depth_gauge', [{ kind: 'maxHp', delta: 10 }]);
    const equipped = equipItem(newRunPlayer(), gauge); // maxHp+10, hp+10
    const hurt = { ...equipped, hp: 5 }; // dropped low
    const after = unequipItem(hurt, gauge);
    expect(after.maxHp).toBe(newRunPlayer().maxHp);
    expect(after.hp).toBe(0); // clamp(5 - 10, 0, maxHp)
  });

  it('is pure — leaves the input player untouched', () => {
    const base = newRunPlayer();
    const before = base.maxHp;
    equipItem(base, passive('g', [{ kind: 'maxHp', delta: 10 }]));
    expect(base.maxHp).toBe(before);
  });
});
