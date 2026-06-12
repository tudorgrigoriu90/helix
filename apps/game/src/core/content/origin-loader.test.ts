import { describe, it, expect } from 'vitest';
import { parseOriginDef } from './origin-loader';

/** T-301 — origin loader: every perk kind round-trips; malformed perks fail. */

function valid(): Record<string, unknown> {
  return {
    schemaVersion: 1,
    id: 'combat_medic',
    name: 'Combat Medic',
    tagline: 'Begin carrying a Deep Tonic',
    blurb: 'You kept other people alive in places that disagreed.',
    unlockRuns: 0,
    perk: { kind: 'startingItem', itemId: 'deep_tonic' },
  };
}

describe('parseOriginDef — T-301', () => {
  it('parses a well-formed origin', () => {
    const res = parseOriginDef(valid());
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.origin.id).toBe('combat_medic');
      expect(res.origin.perk).toEqual({ kind: 'startingItem', itemId: 'deep_tonic' });
    }
  });

  it('parses every perk kind', () => {
    const perks = [
      { kind: 'familyAffinity', family: 'mycelial' },
      { kind: 'damageResistPercent', damageType: 'pressure', percent: 15 },
      { kind: 'zoneVeinBonus', zone: 'lithic', percent: 10 },
      {
        kind: 'startingAbility',
        ability: {
          id: 'ghost_step', apCost: 1, cooldown: 5, range: 0, targetType: 'self',
          baseDamage: 0, damageType: 'void', intScaling: 0, aoeRadius: 0,
          appliesStatus: 'phased', statusDuration: 2,
        },
      },
    ];
    for (const perk of perks) {
      const res = parseOriginDef({ ...valid(), perk });
      expect(res.ok, JSON.stringify(perk)).toBe(true);
    }
  });

  it('parses the five unlockable-Origin perk kinds (T-307)', () => {
    const perks = [
      { kind: 'zoneDamageImmunity', damageType: 'thermal', throughFloor: 5 },
      { kind: 'enemyHpReveal' },
      { kind: 'extraWildCard' },
      { kind: 'codexHeadStart', count: 2 },
      { kind: 'inventorySlotBonus', category: 'consumable', slots: 1 },
    ];
    for (const perk of perks) {
      const res = parseOriginDef({ ...valid(), perk });
      expect(res.ok, JSON.stringify(perk)).toBe(true);
    }
  });

  it('rejects malformed perks', () => {
    expect(parseOriginDef({ ...valid(), perk: { kind: 'freeVein', amount: 999 } }).ok).toBe(false);
    expect(parseOriginDef({ ...valid(), perk: { kind: 'familyAffinity', family: 'cosmic' } }).ok).toBe(false);
    expect(parseOriginDef({ ...valid(), perk: { kind: 'damageResistPercent', damageType: 'pressure', percent: 250 } }).ok).toBe(false);
    expect(parseOriginDef({ ...valid(), perk: { kind: 'startingAbility', ability: null } }).ok).toBe(false);
    expect(parseOriginDef({ ...valid(), perk: 7 }).ok).toBe(false);
    // T-307 kinds: 'true' immunity, zero counts, and bad categories all fail.
    expect(parseOriginDef({ ...valid(), perk: { kind: 'zoneDamageImmunity', damageType: 'true', throughFloor: 5 } }).ok).toBe(false);
    expect(parseOriginDef({ ...valid(), perk: { kind: 'zoneDamageImmunity', damageType: 'thermal', throughFloor: 0 } }).ok).toBe(false);
    expect(parseOriginDef({ ...valid(), perk: { kind: 'codexHeadStart', count: 0 } }).ok).toBe(false);
    expect(parseOriginDef({ ...valid(), perk: { kind: 'inventorySlotBonus', category: 'weapon', slots: 1 } }).ok).toBe(false);
  });

  it('rejects missing fields and bad versions', () => {
    const raw = valid();
    delete raw['tagline'];
    expect(parseOriginDef(raw).ok).toBe(false);
    expect(parseOriginDef({ ...valid(), schemaVersion: 99 }).ok).toBe(false);
    expect(parseOriginDef({ ...valid(), unlockRuns: -1 }).ok).toBe(false);
  });
});
