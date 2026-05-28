import { describe, it, expect } from 'vitest';
import type { LoaderResult } from './floor-template-loader';
import { parseFloorTemplate } from './floor-template-loader';
// The Floor 1 fixture ships in packages/content/floors/. Imported here as
// a JSON module so the test exercises the real on-disk shape end-to-end.
import floor01 from '../../../../../packages/content/floors/floor_01.json';

// ── Helpers ─────────────────────────────────────────────────────────────────

/** A minimally-valid floor template used as a baseline; tests mutate fields to drive negative cases. */
function valid(): Record<string, unknown> {
  return {
    schemaVersion: 1,
    floor: 1,
    zone: 'shallows',
    roomCount: { min: 8, max: 14 },
    roomWeights: {
      combat: 0.40,
      loot: 0.20,
      safe: 0.15,
      merchant: 0.10,
      trap: 0.10,
      lace_event: 0.05,
    },
    roomMinima: { safe: 1 },
    connectivity: 'branching',
    enemyPool: ['filterer', 'cave_crawler'],
    bossId: 'pressure_warden',
    aestheticTags: ['caves', 'fluorescent'],
  };
}

function expectErr(result: LoaderResult, code: string, field?: string): void {
  expect(result.ok).toBe(false);
  if (result.ok === false) {
    expect(result.error.code).toBe(code);
    if (field !== undefined) {
      expect(result.error.field).toBe(field);
    }
  }
}

// ── Happy path ──────────────────────────────────────────────────────────────

describe('parseFloorTemplate — T-70 (TDD §7.1)', () => {
  it('parses a valid object payload', () => {
    const result = parseFloorTemplate(valid());
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.template.floor).toBe(1);
      expect(result.template.zone).toBe('shallows');
      expect(result.template.roomCount).toEqual({ min: 8, max: 14 });
      expect(result.template.connectivity).toBe('branching');
      expect(result.template.bossId).toBe('pressure_warden');
    }
  });

  it('parses a JSON string payload', () => {
    const result = parseFloorTemplate(JSON.stringify(valid()));
    expect(result.ok).toBe(true);
  });

  it('parses the shipped Floor 1 fixture (round-trip from packages/content/floors/floor_01.json)', () => {
    const result = parseFloorTemplate(floor01);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.template.floor).toBe(1);
      expect(result.template.zone).toBe('shallows');
      expect(result.template.enemyPool).toContain('filterer');
      expect(result.template.bossId).toBe('pressure_warden');
      expect(result.template.aestheticTags).toContain('acid_pools');
    }
  });

  it('tolerates room-weight sums within tolerance', () => {
    // 0.40 + 0.20 + 0.15 + 0.10 + 0.10 + 0.05 = 1.0000000000000002 in float math
    const result = parseFloorTemplate(valid());
    expect(result.ok).toBe(true);
  });

  it('accepts an absent roomMinima (defaults to empty object)', () => {
    const t = valid();
    delete t['roomMinima'];
    const result = parseFloorTemplate(t);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.template.roomMinima).toEqual({});
  });

  // ── JSON / object shape ───────────────────────────────────────────────────

  it('rejects malformed JSON strings', () => {
    expectErr(parseFloorTemplate('{ not: valid json'), 'INVALID_JSON');
  });

  it('rejects non-object payloads', () => {
    expectErr(parseFloorTemplate(42), 'NOT_AN_OBJECT');
    expectErr(parseFloorTemplate(null), 'NOT_AN_OBJECT');
    expectErr(parseFloorTemplate([]), 'NOT_AN_OBJECT');
    expectErr(parseFloorTemplate('"a string"'), 'NOT_AN_OBJECT');
  });

  // ── schemaVersion ─────────────────────────────────────────────────────────

  it('rejects a missing schemaVersion', () => {
    const t = valid();
    delete t['schemaVersion'];
    expectErr(parseFloorTemplate(t), 'MISSING_FIELD', 'schemaVersion');
  });

  it('rejects a non-integer schemaVersion', () => {
    expectErr(parseFloorTemplate({ ...valid(), schemaVersion: 1.5 }), 'WRONG_TYPE', 'schemaVersion');
    expectErr(parseFloorTemplate({ ...valid(), schemaVersion: 'v1' }), 'WRONG_TYPE', 'schemaVersion');
  });

  it('rejects an unsupported schemaVersion (migration not yet implemented)', () => {
    expectErr(parseFloorTemplate({ ...valid(), schemaVersion: 2 }), 'UNSUPPORTED_SCHEMA_VERSION', 'schemaVersion');
    expectErr(parseFloorTemplate({ ...valid(), schemaVersion: 0 }), 'UNSUPPORTED_SCHEMA_VERSION', 'schemaVersion');
  });

  // ── floor ─────────────────────────────────────────────────────────────────

  it('rejects a missing floor', () => {
    const t = valid();
    delete t['floor'];
    expectErr(parseFloorTemplate(t), 'MISSING_FIELD', 'floor');
  });

  it('rejects floor 0 or negative', () => {
    expectErr(parseFloorTemplate({ ...valid(), floor: 0 }), 'INVALID_VALUE', 'floor');
    expectErr(parseFloorTemplate({ ...valid(), floor: -1 }), 'INVALID_VALUE', 'floor');
  });

  it('rejects a non-integer floor', () => {
    expectErr(parseFloorTemplate({ ...valid(), floor: 1.5 }), 'INVALID_VALUE', 'floor');
  });

  // ── zone ──────────────────────────────────────────────────────────────────

  it('rejects an unknown zone', () => {
    expectErr(parseFloorTemplate({ ...valid(), zone: 'narnia' }), 'INVALID_VALUE', 'zone');
  });

  it('rejects a non-string zone', () => {
    expectErr(parseFloorTemplate({ ...valid(), zone: 3 }), 'WRONG_TYPE', 'zone');
  });

  // ── roomCount ─────────────────────────────────────────────────────────────

  it('rejects a missing roomCount', () => {
    const t = valid();
    delete t['roomCount'];
    expectErr(parseFloorTemplate(t), 'MISSING_FIELD', 'roomCount');
  });

  it('rejects roomCount.min > roomCount.max', () => {
    expectErr(
      parseFloorTemplate({ ...valid(), roomCount: { min: 10, max: 5 } }),
      'INVALID_VALUE',
      'roomCount',
    );
  });

  it('rejects non-integer roomCount.min', () => {
    expectErr(
      parseFloorTemplate({ ...valid(), roomCount: { min: 1.5, max: 5 } }),
      'INVALID_VALUE',
      'roomCount.min',
    );
  });

  it('rejects non-integer roomCount.max', () => {
    expectErr(
      parseFloorTemplate({ ...valid(), roomCount: { min: 2, max: 5.5 } }),
      'INVALID_VALUE',
      'roomCount.max',
    );
  });

  it('rejects a string roomCount', () => {
    expectErr(parseFloorTemplate({ ...valid(), roomCount: 'not-an-object' }), 'WRONG_TYPE', 'roomCount');
  });

  // ── roomWeights ───────────────────────────────────────────────────────────

  it('rejects a missing room-type weight key', () => {
    const t = valid();
    const weights = { ...(t['roomWeights'] as object) } as Record<string, unknown>;
    delete weights['combat'];
    t['roomWeights'] = weights;
    expectErr(parseFloorTemplate(t), 'INVALID_VALUE', 'roomWeights.combat');
  });

  it('rejects a negative room-type weight', () => {
    expectErr(
      parseFloorTemplate({
        ...valid(),
        roomWeights: { combat: -0.1, loot: 0.3, safe: 0.2, merchant: 0.2, trap: 0.2, lace_event: 0.2 },
      }),
      'INVALID_VALUE',
      'roomWeights.combat',
    );
  });

  it('rejects room weights that do not sum to ~1.0', () => {
    expectErr(
      parseFloorTemplate({
        ...valid(),
        roomWeights: { combat: 0.5, loot: 0.5, safe: 0.5, merchant: 0.5, trap: 0.5, lace_event: 0.5 },
      }),
      'INVALID_VALUE',
      'roomWeights',
    );
  });

  it('rejects a non-object roomWeights', () => {
    expectErr(parseFloorTemplate({ ...valid(), roomWeights: 1.0 }), 'WRONG_TYPE', 'roomWeights');
  });

  // ── roomMinima ────────────────────────────────────────────────────────────

  it('rejects a negative roomMinima value', () => {
    expectErr(
      parseFloorTemplate({ ...valid(), roomMinima: { safe: -1 } }),
      'INVALID_VALUE',
      'roomMinima.safe',
    );
  });

  it('rejects a non-integer roomMinima value', () => {
    expectErr(
      parseFloorTemplate({ ...valid(), roomMinima: { safe: 1.5 } }),
      'INVALID_VALUE',
      'roomMinima.safe',
    );
  });

  it('rejects roomMinima sum exceeding roomCount.max (unsatisfiable)', () => {
    expectErr(
      parseFloorTemplate({
        ...valid(),
        roomCount: { min: 3, max: 5 },
        roomMinima: { safe: 3, merchant: 3 },
      }),
      'INVALID_VALUE',
      'roomMinima',
    );
  });

  it('rejects a non-object roomMinima', () => {
    expectErr(parseFloorTemplate({ ...valid(), roomMinima: 5 }), 'WRONG_TYPE', 'roomMinima');
  });

  // ── connectivity ──────────────────────────────────────────────────────────

  it('rejects a missing connectivity', () => {
    const t = valid();
    delete t['connectivity'];
    expectErr(parseFloorTemplate(t), 'MISSING_FIELD', 'connectivity');
  });

  it('rejects an unknown connectivity', () => {
    expectErr(parseFloorTemplate({ ...valid(), connectivity: 'spiral' }), 'INVALID_VALUE', 'connectivity');
  });

  it('rejects a non-string connectivity', () => {
    expectErr(parseFloorTemplate({ ...valid(), connectivity: 1 }), 'WRONG_TYPE', 'connectivity');
  });

  // ── enemyPool ─────────────────────────────────────────────────────────────

  it('rejects a missing enemyPool', () => {
    const t = valid();
    delete t['enemyPool'];
    expectErr(parseFloorTemplate(t), 'MISSING_FIELD', 'enemyPool');
  });

  it('rejects an empty enemyPool', () => {
    expectErr(parseFloorTemplate({ ...valid(), enemyPool: [] }), 'INVALID_VALUE', 'enemyPool');
  });

  it('rejects enemyPool containing non-strings', () => {
    expectErr(parseFloorTemplate({ ...valid(), enemyPool: ['ok', 42] }), 'WRONG_TYPE', 'enemyPool');
  });

  it('rejects a non-array enemyPool', () => {
    expectErr(parseFloorTemplate({ ...valid(), enemyPool: 'one_enemy' }), 'WRONG_TYPE', 'enemyPool');
  });

  // ── bossId ────────────────────────────────────────────────────────────────

  it('rejects a missing bossId', () => {
    const t = valid();
    delete t['bossId'];
    expectErr(parseFloorTemplate(t), 'MISSING_FIELD', 'bossId');
  });

  it('rejects an empty bossId', () => {
    expectErr(parseFloorTemplate({ ...valid(), bossId: '' }), 'INVALID_VALUE', 'bossId');
  });

  it('rejects a non-string bossId', () => {
    expectErr(parseFloorTemplate({ ...valid(), bossId: 12 }), 'INVALID_VALUE', 'bossId');
  });

  // ── aestheticTags ─────────────────────────────────────────────────────────

  it('rejects a missing aestheticTags', () => {
    const t = valid();
    delete t['aestheticTags'];
    expectErr(parseFloorTemplate(t), 'MISSING_FIELD', 'aestheticTags');
  });

  it('rejects aestheticTags containing non-strings', () => {
    expectErr(parseFloorTemplate({ ...valid(), aestheticTags: ['ok', 1] }), 'WRONG_TYPE', 'aestheticTags');
  });

  it('accepts an empty aestheticTags array', () => {
    const result = parseFloorTemplate({ ...valid(), aestheticTags: [] });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.template.aestheticTags).toEqual([]);
  });

  // ── Purity / immutability ─────────────────────────────────────────────────

  it('is pure — does not mutate the input object', () => {
    const t = valid();
    const snapshot = structuredClone(t);
    parseFloorTemplate(t);
    expect(t).toEqual(snapshot);
  });

  it('returns a fresh enemyPool array (caller mutation does not affect the source)', () => {
    const t = valid();
    const result = parseFloorTemplate(t);
    expect(result.ok).toBe(true);
    if (result.ok) {
      // structuredClone-equivalent check: mutating the loaded copy should not
      // affect the source.
      (result.template.enemyPool as string[]).push('mutated');
      expect((t['enemyPool'] as string[]).length).toBe(2); // original unchanged
    }
  });
});
