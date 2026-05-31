import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  parsePrefixTable,
  parseTraitTable,
  NAME_TABLE_FAMILIES,
  CURRENT_NAME_TABLE_SCHEMA_VERSION,
} from './name-tables';

/** A minimal valid traits payload: each family gets one placeholder trait. */
function validTraits(): { schemaVersion: number; traits: Record<string, string[]> } {
  const traits: Record<string, string[]> = {};
  for (const f of NAME_TABLE_FAMILIES) traits[f] = [`${f}-trait`];
  return { schemaVersion: 1, traits };
}

const NAMES_DIR = fileURLToPath(
  new URL('../../../../../packages/content/organism-names/', import.meta.url),
);

function loadJson(file: string): unknown {
  return JSON.parse(readFileSync(`${NAMES_DIR}${file}`, 'utf8'));
}

describe('prefix table loader — T-118', () => {
  it('parses a valid prefix table', () => {
    const res = parsePrefixTable({ schemaVersion: 1, prefixes: ['The', 'Pale'] });
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.prefixes).toEqual(['The', 'Pale']);
  });

  it('rejects a missing prefixes field', () => {
    const res = parsePrefixTable({ schemaVersion: 1 });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe('MISSING_FIELD');
  });

  it('rejects an empty pool', () => {
    const res = parsePrefixTable({ schemaVersion: 1, prefixes: [] });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe('INVALID_VALUE');
  });

  it('rejects an empty-string entry', () => {
    const res = parsePrefixTable({ schemaVersion: 1, prefixes: ['The', '  '] });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.field).toBe('prefixes[1]');
  });

  it('rejects duplicate entries', () => {
    const res = parsePrefixTable({ schemaVersion: 1, prefixes: ['The', 'The'] });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.message).toMatch(/duplicate/);
  });

  it('rejects an unsupported schema version', () => {
    const res = parsePrefixTable({ schemaVersion: 999, prefixes: ['The'] });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe('UNSUPPORTED_SCHEMA_VERSION');
  });

  it('rejects a non-object payload', () => {
    expect(parsePrefixTable(42).ok).toBe(false);
    expect(parsePrefixTable(null).ok).toBe(false);
  });
});

describe('shipped prefix content — T-118', () => {
  it('prefixes.json loads and is at the current schema version', () => {
    const res = parsePrefixTable(loadJson('prefixes.json'));
    expect(res.ok).toBe(true);
  });

  it('ships at least 20 unique prefixes (T-123 pool sizing)', () => {
    const res = parsePrefixTable(loadJson('prefixes.json'));
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.prefixes.length).toBeGreaterThanOrEqual(20);
      expect(new Set(res.prefixes).size).toBe(res.prefixes.length);
    }
  });

  it('schema version constant is 1', () => {
    expect(CURRENT_NAME_TABLE_SCHEMA_VERSION).toBe(1);
  });
});

describe('trait table loader — T-119', () => {
  it('parses a valid per-family trait table', () => {
    const res = parseTraitTable(validTraits());
    expect(res.ok).toBe(true);
    if (res.ok) {
      for (const f of NAME_TABLE_FAMILIES) expect(res.traits[f]).toEqual([`${f}-trait`]);
    }
  });

  it('rejects a missing traits field', () => {
    const res = parseTraitTable({ schemaVersion: 1 });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe('MISSING_FIELD');
  });

  it('rejects traits that is not an object', () => {
    const res = parseTraitTable({ schemaVersion: 1, traits: ['nope'] });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe('INVALID_VALUE');
  });

  it('rejects a missing family', () => {
    const payload = validTraits();
    delete payload.traits['voidborn'];
    const res = parseTraitTable(payload);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.field).toBe('traits.voidborn');
  });

  it('rejects an unknown family key', () => {
    const payload = validTraits();
    payload.traits['celestial'] = ['Starbright'];
    const res = parseTraitTable(payload);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.message).toMatch(/unknown family/);
  });

  it('rejects a family with duplicate traits, naming the family in the field path', () => {
    const payload = validTraits();
    payload.traits['lithic'] = ['Crystal', 'Crystal'];
    const res = parseTraitTable(payload);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.field).toBe('traits.lithic');
  });

  it('rejects an unsupported schema version', () => {
    const res = parseTraitTable({ ...validTraits(), schemaVersion: 7 });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe('UNSUPPORTED_SCHEMA_VERSION');
  });
});

describe('shipped trait content — T-119', () => {
  it('traits.json loads through the parser', () => {
    expect(parseTraitTable(loadJson('traits.json')).ok).toBe(true);
  });

  it('every family ships ≥20 unique traits (T-123 pool sizing)', () => {
    const res = parseTraitTable(loadJson('traits.json'));
    expect(res.ok).toBe(true);
    if (res.ok) {
      for (const f of NAME_TABLE_FAMILIES) {
        expect(res.traits[f].length, f).toBeGreaterThanOrEqual(20);
        expect(new Set(res.traits[f]).size, f).toBe(res.traits[f].length);
      }
    }
  });
});
