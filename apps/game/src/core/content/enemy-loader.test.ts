import { describe, it, expect } from 'vitest';
import { parseEnemyDef } from './enemy-loader';

function validRaw(): Record<string, unknown> {
  return {
    schemaVersion: 2,
    id: 'filterer',
    name: 'Filterer',
    tier: 'grunt',
    zone: 'shallows',
    maxHp: 18,
    stats: { str: 7, res: 3, agi: 6, int: 2 },
    damageType: 'physical',
    aestheticTags: ['caves', 'translucent'],
  };
}

describe('parseEnemyDef — T-283', () => {
  it('parses a well-formed enemy', () => {
    const res = parseEnemyDef(validRaw());
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.enemy.id).toBe('filterer');
      expect(res.enemy.stats).toEqual({ str: 7, res: 3, agi: 6, int: 2 });
      expect(res.enemy.tier).toBe('grunt');
    }
  });

  it('accepts a JSON string as well as an object', () => {
    const res = parseEnemyDef(JSON.stringify(validRaw()));
    expect(res.ok).toBe(true);
  });

  it('rejects invalid JSON strings', () => {
    const res = parseEnemyDef('{ not json');
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe('INVALID_JSON');
  });

  it('rejects non-objects', () => {
    for (const bad of [42, null, ['a'], true]) {
      const res = parseEnemyDef(bad);
      expect(res.ok).toBe(false);
      if (!res.ok) expect(res.error.code).toBe('NOT_AN_OBJECT');
    }
  });

  it('rejects an unsupported schema version', () => {
    const res = parseEnemyDef({ ...validRaw(), schemaVersion: 3 });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe('UNSUPPORTED_SCHEMA_VERSION');
  });

  it("v1 migration: a plain v1 'boss' becomes a floor_boss (T-501, DR-008)", () => {
    const res = parseEnemyDef({ ...validRaw(), schemaVersion: 1, tier: 'boss' });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.enemy.tier).toBe('floor_boss');
      expect(res.enemy.schemaVersion).toBe(2);
    }
  });

  it("v1 migration: a v1 'boss' with a Warden id becomes a zone_warden (T-501, DR-008)", () => {
    const res = parseEnemyDef({
      ...validRaw(), schemaVersion: 1, id: 'leviathan_hatchling', tier: 'boss',
    });
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.enemy.tier).toBe('zone_warden');
  });

  it("v1 migration: non-boss tiers pass through unchanged", () => {
    const res = parseEnemyDef({ ...validRaw(), schemaVersion: 1 });
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.enemy.tier).toBe('grunt');
  });

  it("v2 rejects the retired single 'boss' tier (T-501)", () => {
    expect(parseEnemyDef({ ...validRaw(), tier: 'boss' }).ok).toBe(false);
  });

  it('requires id, name, maxHp', () => {
    for (const field of ['id', 'name', 'maxHp']) {
      const raw = validRaw();
      delete raw[field];
      const res = parseEnemyDef(raw);
      expect(res.ok, field).toBe(false);
      if (!res.ok) {
        expect(res.error.code, field).toBe('MISSING_FIELD');
        expect(res.error.field, field).toBe(field);
      }
    }
  });

  it('rejects an invalid tier / zone / damageType', () => {
    expect(parseEnemyDef({ ...validRaw(), tier: 'apex' }).ok).toBe(false);
    expect(parseEnemyDef({ ...validRaw(), zone: 'desert' }).ok).toBe(false);
    expect(parseEnemyDef({ ...validRaw(), damageType: 'fire' }).ok).toBe(false);
  });

  it('rejects a non-positive maxHp', () => {
    const res = parseEnemyDef({ ...validRaw(), maxHp: 0 });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.field).toBe('maxHp');
  });

  it('validates the stats block: every attribute required and non-negative', () => {
    const missing = parseEnemyDef({ ...validRaw(), stats: { str: 7, res: 3, agi: 6 } });
    expect(missing.ok).toBe(false);
    if (!missing.ok) expect(missing.error.field).toBe('stats.int');

    const negative = parseEnemyDef({ ...validRaw(), stats: { str: -1, res: 3, agi: 6, int: 2 } });
    expect(negative.ok).toBe(false);
    if (!negative.ok) expect(negative.error.field).toBe('stats.str');

    const notObject = parseEnemyDef({ ...validRaw(), stats: 5 });
    expect(notObject.ok).toBe(false);
    if (!notObject.ok) expect(notObject.error.code).toBe('WRONG_TYPE');
  });

  it('requires aestheticTags to be an array of strings', () => {
    expect(parseEnemyDef({ ...validRaw(), aestheticTags: 'caves' }).ok).toBe(false);
    expect(parseEnemyDef({ ...validRaw(), aestheticTags: [1, 2] }).ok).toBe(false);
  });
});
