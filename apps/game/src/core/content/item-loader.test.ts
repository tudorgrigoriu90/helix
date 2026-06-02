import { describe, it, expect } from 'vitest';
import { parseItemDef } from './item-loader';

function healRaw(): Record<string, unknown> {
  return {
    schemaVersion: 1,
    id: 'vein_serum',
    name: 'Vein Serum',
    rarity: 'common',
    category: 'consumable',
    effect: { kind: 'heal', amount: 25 },
  };
}

describe('parseItemDef — T-284', () => {
  it('parses a heal consumable and strips schemaVersion from the runtime shape', () => {
    const res = parseItemDef(healRaw());
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.item).toEqual({
        id: 'vein_serum',
        name: 'Vein Serum',
        rarity: 'common',
        category: 'consumable',
        effect: { kind: 'heal', amount: 25 },
      });
      expect('schemaVersion' in res.item).toBe(false);
    }
  });

  it('parses a damage grenade', () => {
    const res = parseItemDef({
      schemaVersion: 1, id: 'frag', name: 'Frag', rarity: 'common', category: 'consumable',
      effect: { kind: 'damage', amount: 30, damageType: 'physical', aoeRadius: 1 },
    });
    expect(res.ok).toBe(true);
    if (res.ok && res.item.effect?.kind === 'damage') {
      expect(res.item.effect.damageType).toBe('physical');
      expect(res.item.effect.aoeRadius).toBe(1);
    }
  });

  it('parses an applyStatus consumable', () => {
    const res = parseItemDef({
      schemaVersion: 1, id: 'spore', name: 'Spore Bomb', rarity: 'uncommon', category: 'consumable',
      effect: { kind: 'applyStatus', status: 'infected', duration: 4, aoeRadius: 1 },
    });
    expect(res.ok).toBe(true);
  });

  it('parses a passive item with a null effect', () => {
    const res = parseItemDef({
      schemaVersion: 1, id: 'depth_gauge', name: 'Depth Gauge', rarity: 'uncommon', category: 'passive', effect: null,
    });
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.item.effect).toBeNull();
  });

  it('parses a passive with always-on modifiers (T-444)', () => {
    const res = parseItemDef({
      schemaVersion: 1, id: 'depth_gauge', name: 'Depth Gauge', rarity: 'common', category: 'passive', effect: null,
      modifiers: [{ kind: 'maxHp', delta: 10 }, { kind: 'stat', stat: 'res', delta: 6 }],
    });
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.item.modifiers).toEqual([{ kind: 'maxHp', delta: 10 }, { kind: 'stat', stat: 'res', delta: 6 }]);
  });

  it('rejects malformed modifiers (bad stat, non-integer delta, bad kind)', () => {
    const base = { schemaVersion: 1, id: 'x', name: 'X', rarity: 'common', category: 'passive', effect: null };
    expect(parseItemDef({ ...base, modifiers: [{ kind: 'stat', stat: 'luck', delta: 1 }] }).ok).toBe(false);
    expect(parseItemDef({ ...base, modifiers: [{ kind: 'maxHp', delta: 1.5 }] }).ok).toBe(false);
    expect(parseItemDef({ ...base, modifiers: [{ kind: 'wat', delta: 1 }] }).ok).toBe(false);
    expect(parseItemDef({ ...base, modifiers: 'nope' }).ok).toBe(false);
  });

  it('rejects a consumable with no effect', () => {
    const raw = healRaw();
    delete raw['effect'];
    const res = parseItemDef(raw);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.field).toBe('effect');
  });

  it('rejects a non-consumable that carries an effect', () => {
    const res = parseItemDef({
      schemaVersion: 1, id: 'x', name: 'X', rarity: 'common', category: 'passive',
      effect: { kind: 'heal', amount: 5 },
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.field).toBe('effect');
  });

  it('rejects unknown effect kinds and bad effect fields', () => {
    expect(parseItemDef({ ...healRaw(), effect: { kind: 'teleport' } }).ok).toBe(false);
    expect(parseItemDef({ ...healRaw(), effect: { kind: 'heal', amount: 0 } }).ok).toBe(false);
    expect(parseItemDef({ ...healRaw(), effect: { kind: 'heal', amount: -3 } }).ok).toBe(false);
    expect(
      parseItemDef({
        schemaVersion: 1, id: 'g', name: 'G', rarity: 'common', category: 'consumable',
        effect: { kind: 'damage', amount: 10, damageType: 'fire', aoeRadius: 1 },
      }).ok,
    ).toBe(false);
  });

  it('rejects invalid rarity and category', () => {
    expect(parseItemDef({ ...healRaw(), rarity: 'mythic' }).ok).toBe(false);
    expect(parseItemDef({ ...healRaw(), category: 'trinket' }).ok).toBe(false);
  });

  it('requires id and name and a supported schema version', () => {
    const noId = healRaw(); delete noId['id'];
    expect(parseItemDef(noId).ok).toBe(false);
    const noName = healRaw(); delete noName['name'];
    expect(parseItemDef(noName).ok).toBe(false);
    const badVer = parseItemDef({ ...healRaw(), schemaVersion: 99 });
    expect(badVer.ok).toBe(false);
    if (!badVer.ok) expect(badVer.error.code).toBe('UNSUPPORTED_SCHEMA_VERSION');
  });
});
