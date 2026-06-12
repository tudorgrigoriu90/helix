import { describe, it, expect } from 'vitest';
import type { ItemDef } from '@shared-types/item';
import { applyOriginPerk, newRunPlayer } from './start-player';

describe('newRunPlayer — starting loadout (T-301 precursor)', () => {
  it('ships with abilities and consumables ready to use', () => {
    const p = newRunPlayer();
    expect(p.abilities.length).toBeGreaterThanOrEqual(2);
    expect(p.items.length).toBeGreaterThanOrEqual(3);
    expect(p.abilities.every((s) => s.cooldownRemaining === 0)).toBe(true);
  });

  it('covers a damaging ability and a healing item (a real combat kit)', () => {
    const p = newRunPlayer();
    expect(p.abilities.some((s) => s.def.baseDamage > 0)).toBe(true);
    expect(p.items.some((i) => i.effect?.kind === 'heal')).toBe(true);
    expect(p.items.some((i) => i.effect?.kind === 'damage')).toBe(true);
  });

  it('returns a fresh, independent copy each call (no shared mutation surface)', () => {
    const a = newRunPlayer();
    const b = newRunPlayer();
    expect(a).not.toBe(b);
    expect(a.abilities[0]).not.toBe(b.abilities[0]);
    expect(a.items[0]).not.toBe(b.items[0]);
    expect(a).toEqual(b);
  });

  it('has INT to make ability scaling matter', () => {
    expect(newRunPlayer().stats.int).toBeGreaterThan(0);
  });
});

describe('applyOriginPerk — T-301 (GDD §4.1)', () => {
  const pool: ItemDef[] = [
    { id: 'deep_tonic', name: 'Deep Tonic', rarity: 'common', category: 'consumable', effect: { kind: 'heal', amount: 40 } },
  ];

  it('startingItem adds the resolved item; missing content degrades to no perk', () => {
    const withItem = applyOriginPerk(newRunPlayer(), { kind: 'startingItem', itemId: 'deep_tonic' }, pool);
    expect(withItem.items.map((i) => i.id)).toContain('deep_tonic');
    const missing = applyOriginPerk(newRunPlayer(), { kind: 'startingItem', itemId: 'nope' }, pool);
    expect(missing.items).toEqual(newRunPlayer().items);
  });

  it('startingAbility lands on the bar at zero cooldown', () => {
    const ability = {
      id: 'ghost_step', apCost: 1, cooldown: 5, range: 0, targetType: 'self' as const,
      baseDamage: 0, damageType: 'void' as const, intScaling: 0, aoeRadius: 0,
      appliesStatus: 'phased' as const, statusDuration: 2,
    };
    const p = applyOriginPerk(newRunPlayer(), { kind: 'startingAbility', ability }, pool);
    expect(p.abilities.map((a) => a.def.id)).toContain('ghost_step');
    expect(p.abilities.find((a) => a.def.id === 'ghost_step')!.cooldownRemaining).toBe(0);
  });

  it('damageResistPercent records the typed resist; base stats never change (§4.2)', () => {
    const p = applyOriginPerk(newRunPlayer(), { kind: 'damageResistPercent', damageType: 'pressure', percent: 15 }, pool);
    expect(p.resists).toEqual([{ damageType: 'pressure', percent: 15 }]);
    expect(p.stats).toEqual(newRunPlayer().stats);
    expect(p.maxHp).toBe(newRunPlayer().maxHp);
  });

  it('session-level perks are a no-op on the player', () => {
    expect(applyOriginPerk(newRunPlayer(), { kind: 'familyAffinity', family: 'mycelial' }, pool))
      .toEqual(newRunPlayer());
    expect(applyOriginPerk(newRunPlayer(), { kind: 'zoneVeinBonus', zone: 'lithic', percent: 10 }, pool))
      .toEqual(newRunPlayer());
  });
});
