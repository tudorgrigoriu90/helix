import { describe, it, expect } from 'vitest';
import type { AbilityDef } from '@shared-types/ability';
import { newRunPlayer } from '../run/start-player';
import { applyMutation } from './apply';
import { makeMutation, statMod } from './test-fixtures';

const ABILITY: AbilityDef = {
  id: 'pressurize',
  apCost: 2,
  cooldown: 3,
  range: 1,
  targetType: 'enemy',
  baseDamage: 15,
  damageType: 'pressure',
  intScaling: 0,
  aoeRadius: 1,
  appliesStatus: 'crushed',
  statusDuration: 2,
};

describe('mutation application — T-90 (GDD §5.3)', () => {
  it('applies a stat modifier', () => {
    const before = newRunPlayer();
    const after = applyMutation(before, makeMutation({ modifiers: [statMod('res', 5)] }));
    expect(after.stats.res).toBe(before.stats.res + 5);
    expect(after.stats.str).toBe(before.stats.str); // others unchanged
  });

  it('raises max HP and current HP together', () => {
    const before = newRunPlayer();
    const after = applyMutation(before, makeMutation({ modifiers: [{ kind: 'maxHp', delta: 15 }] }));
    expect(after.maxHp).toBe(before.maxHp + 15);
    expect(after.hp).toBe(before.hp + 15);
  });

  it('clamps current HP to the new max when the player was hurt', () => {
    const hurt = { ...newRunPlayer(), hp: 78 }; // 78/80
    const after = applyMutation(hurt, makeMutation({ modifiers: [{ kind: 'maxHp', delta: 15 }] }));
    expect(after.maxHp).toBe(95);
    expect(after.hp).toBe(93); // 78 + 15, still ≤ 95
  });

  it('raises max AP and current AP together', () => {
    const before = newRunPlayer();
    const after = applyMutation(before, makeMutation({ modifiers: [{ kind: 'maxAp', delta: 1 }] }));
    expect(after.maxAp).toBe(before.maxAp + 1);
    expect(after.ap).toBe(before.ap + 1);
  });

  it('grants an active ability ready to use', () => {
    const before = newRunPlayer();
    const after = applyMutation(before, makeMutation({ grantsAbility: ABILITY }));
    expect(after.abilities).toHaveLength(before.abilities.length + 1);
    const slot = after.abilities.find((s) => s.def.id === 'pressurize');
    expect(slot?.cooldownRemaining).toBe(0);
  });

  it('leaves abilities untouched for a passive-only mutation', () => {
    const before = newRunPlayer();
    const after = applyMutation(before, makeMutation({ grantsAbility: null, modifiers: [statMod('int', 3)] }));
    expect(after.abilities).toEqual(before.abilities);
  });

  it('records the mutation id in the owned list', () => {
    const before = newRunPlayer();
    const after = applyMutation(before, makeMutation({ id: 'thermal_overclock' }));
    expect(after.mutations).toContain('thermal_overclock');
  });

  it('applies several modifiers from one mutation', () => {
    const before = newRunPlayer();
    const m = makeMutation({
      modifiers: [statMod('str', 2), statMod('agi', 4), { kind: 'maxHp', delta: 10 }],
    });
    const after = applyMutation(before, m);
    expect(after.stats.str).toBe(before.stats.str + 2);
    expect(after.stats.agi).toBe(before.stats.agi + 4);
    expect(after.maxHp).toBe(before.maxHp + 10);
  });

  it('floors a stat at 0 for a negative modifier', () => {
    const before = newRunPlayer(); // res 6
    const after = applyMutation(before, makeMutation({ modifiers: [statMod('res', -100)] }));
    expect(after.stats.res).toBe(0);
  });

  it('does not duplicate ownership or the ability when applied twice', () => {
    const before = newRunPlayer();
    const m = makeMutation({ id: 'dup', grantsAbility: ABILITY });
    const once = applyMutation(before, m);
    const twice = applyMutation(once, m);
    expect(twice.mutations.filter((id) => id === 'dup')).toHaveLength(1);
    expect(twice.abilities.filter((s) => s.def.id === 'pressurize')).toHaveLength(1);
  });

  it('does not mutate the input player (immutability)', () => {
    const before = newRunPlayer();
    const snapshot = JSON.stringify(before);
    applyMutation(before, makeMutation({ modifiers: [statMod('res', 5)], grantsAbility: ABILITY }));
    expect(JSON.stringify(before)).toBe(snapshot);
  });
});
