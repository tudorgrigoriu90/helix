import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  parsePrefixTable,
  CURRENT_NAME_TABLE_SCHEMA_VERSION,
} from './name-tables';

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
