import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { EnemyDef } from '@shared-types/enemy';
import type { FloorTemplate } from '@shared-types/floor-template';
import type { ItemDef } from '@shared-types/item';
import type { MutationDef } from '@shared-types/mutation';
import type { LaceLine } from '@shared-types/lace-line';
import { parseEnemyDef } from './enemy-loader';
import { parseItemDef } from './item-loader';
import { parseMutationDef } from './mutation-loader';
import { parseCodexEntries } from './codex-loader';
import { parseFloorTemplate } from '../floor-gen';
import { parseLaceLines } from '../lace';
import { crossReferenceContent } from './cross-reference';
import { parsePrefixTable, parseTraitTable, parseSuffixTable, NAME_TABLE_FAMILIES } from '../name-gen/name-tables';

/**
 * Content bundle gate — the real `pnpm validate` target (T-288).
 *
 * Loads every shipped content file through its schema loader, then runs the
 * cross-reference validator over the whole bundle. This is the gate that
 * replaced the old echo stub: malformed content or a dangling enemy/boss
 * reference fails CI here. Runs in the normal test suite too.
 */

const CONTENT_DIR = fileURLToPath(new URL('../../../../../packages/content/', import.meta.url));

function readDir(sub: string): { file: string; raw: unknown }[] {
  const dir = `${CONTENT_DIR}${sub}/`;
  return readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .map((file) => ({ file, raw: JSON.parse(readFileSync(`${dir}${file}`, 'utf-8')) as unknown }));
}

// Parse everything eagerly at collection time so the cross-reference assertion
// never runs against a half-populated bundle (no test-ordering dependency).
const enemyResults = readDir('enemies').map((e) => ({ file: e.file, res: parseEnemyDef(e.raw) }));
const itemResults = readDir('items').map((i) => ({ file: i.file, res: parseItemDef(i.raw) }));
const floorResults = readDir('floors').map((f) => ({ file: f.file, res: parseFloorTemplate(f.raw) }));
const mutationResults = readDir('mutations').map((m) => ({ file: m.file, res: parseMutationDef(m.raw) }));

const enemies: EnemyDef[] = enemyResults.flatMap((e) => (e.res.ok ? [e.res.enemy] : []));
const items: ItemDef[] = itemResults.flatMap((i) => (i.res.ok ? [i.res.item] : []));
const floors: FloorTemplate[] = floorResults.flatMap((f) => (f.res.ok ? [f.res.template] : []));
const mutations: MutationDef[] = mutationResults.flatMap((m) => (m.res.ok ? [m.res.mutation] : []));

describe('content bundle — T-288 (pnpm validate gate)', () => {
  it('every enemy file passes the schema loader', () => {
    for (const { file, res } of enemyResults) {
      expect(res.ok, `${file}: ${res.ok ? '' : res.error.message}`).toBe(true);
    }
  });

  it('every item file passes the schema loader', () => {
    for (const { file, res } of itemResults) {
      expect(res.ok, `${file}: ${res.ok ? '' : res.error.message}`).toBe(true);
    }
  });

  it('every floor file passes the schema loader', () => {
    for (const { file, res } of floorResults) {
      expect(res.ok, `${file}: ${res.ok ? '' : res.error.message}`).toBe(true);
    }
  });

  it('every mutation file passes the schema loader', () => {
    for (const { file, res } of mutationResults) {
      expect(res.ok, `${file}: ${res.ok ? '' : res.error.message}`).toBe(true);
    }
  });

  it('every LACE line bundle passes the schema loader', () => {
    const laceFiles = readDir('lace-lines');
    for (const { file, raw } of laceFiles) {
      const res = parseLaceLines(raw);
      expect(res.ok, `${file}: ${res.ok ? '' : res.error.message}`).toBe(true);
    }
  });

  it('every Codex bundle passes the schema loader, with globally-unique ids (T-294)', () => {
    const seen = new Set<string>();
    for (const { file, raw } of readDir('codex')) {
      const res = parseCodexEntries(raw);
      expect(res.ok, `${file}: ${res.ok ? '' : res.error.message}`).toBe(true);
      if (res.ok) {
        for (const entry of res.entries) {
          expect(seen.has(entry.id), `duplicate codex id "${entry.id}" across bundles`).toBe(false);
          seen.add(entry.id);
        }
      }
    }
  });

  it('ships the four Floor 0 Codex entries (T-294)', () => {
    const floorZero = readDir('codex').flatMap(({ raw }) => {
      const res = parseCodexEntries(raw);
      return res.ok ? res.entries.filter((e) => e.floor === 0) : [];
    });
    expect(floorZero.length).toBeGreaterThanOrEqual(4);
  });

  it('ships the Prototype LACE library — ≥50 lines covering every context (T-313)', () => {
    const lines = readDir('lace-lines').flatMap(({ raw }) => {
      const res = parseLaceLines(raw);
      return res.ok ? res.lines : [];
    });
    expect(lines.length).toBeGreaterThanOrEqual(50);
    // Every triggerable context must have at least one line so selection never
    // falls through to `generic` for a core run event (T-98/T-102).
    const contexts: readonly LaceLine['context'][] = [
      'run_start', 'floor_enter', 'combat_start', 'enemy_killed', 'player_hurt',
      'room_cleared', 'boss_start', 'boss_killed', 'floor_complete', 'player_death', 'generic',
    ];
    for (const context of contexts) {
      expect(
        lines.filter((l) => l.context === context).length,
        `context "${context}" must have ≥1 line`,
      ).toBeGreaterThanOrEqual(1);
    }
  });

  it('the bundle has no dangling cross-references', () => {
    const errors = crossReferenceContent({ enemies, items, floors, mutations });
    expect(errors, errors.map((e) => e.message).join('\n')).toEqual([]);
  });
});

// ── Organism-name tables (T-287) ─────────────────────────────────────────────

const NAMES_DIR = `${CONTENT_DIR}organism-names/`;
const readNameJson = (file: string): unknown =>
  JSON.parse(readFileSync(`${NAMES_DIR}${file}`, 'utf-8')) as unknown;

const prefixResult = parsePrefixTable(readNameJson('prefixes.json'));
const traitResult = parseTraitTable(readNameJson('traits.json'));
const suffixResult = parseSuffixTable(readNameJson('suffixes.json'));

describe('organism-name tables — T-287 (content-bundle gate)', () => {
  it('prefixes.json passes the schema loader (≥20 unique non-empty strings)', () => {
    expect(prefixResult.ok, prefixResult.ok ? '' : prefixResult.error.message).toBe(true);
    if (prefixResult.ok) expect(prefixResult.prefixes.length).toBeGreaterThanOrEqual(20);
  });

  it('traits.json passes the schema loader — all five families present with ≥20 traits each', () => {
    expect(traitResult.ok, traitResult.ok ? '' : traitResult.error.message).toBe(true);
    if (traitResult.ok) {
      for (const family of NAME_TABLE_FAMILIES) {
        expect(
          traitResult.traits[family].length,
          `family "${family}" must have ≥20 traits`,
        ).toBeGreaterThanOrEqual(20);
      }
    }
  });

  it('suffixes.json passes the schema loader (≥10 unique non-empty strings)', () => {
    expect(suffixResult.ok, suffixResult.ok ? '' : suffixResult.error.message).toBe(true);
    if (suffixResult.ok) expect(suffixResult.suffixes.length).toBeGreaterThanOrEqual(10);
  });
});
