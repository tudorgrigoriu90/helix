import { describe, it, expect } from 'vitest';
import { newRunPlayer } from './start-player';

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
