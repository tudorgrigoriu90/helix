import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { EnemyDef } from '@shared-types/enemy';
import type { FloorTemplate } from '@shared-types/floor-template';
import type { ItemDef } from '@shared-types/item';
import { parseEnemyDef } from './enemy-loader';
import { parseItemDef } from './item-loader';
import { parseFloorTemplate } from '../floor-gen';
import { parseLaceLines } from '../lace';
import { crossReferenceContent } from './cross-reference';

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

const enemies: EnemyDef[] = enemyResults.flatMap((e) => (e.res.ok ? [e.res.enemy] : []));
const items: ItemDef[] = itemResults.flatMap((i) => (i.res.ok ? [i.res.item] : []));
const floors: FloorTemplate[] = floorResults.flatMap((f) => (f.res.ok ? [f.res.template] : []));

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

  it('every LACE line bundle passes the schema loader', () => {
    const laceFiles = readDir('lace-lines');
    for (const { file, raw } of laceFiles) {
      const res = parseLaceLines(raw);
      expect(res.ok, `${file}: ${res.ok ? '' : res.error.message}`).toBe(true);
    }
  });

  it('the bundle has no dangling cross-references', () => {
    const errors = crossReferenceContent({ enemies, items, floors });
    expect(errors, errors.map((e) => e.message).join('\n')).toEqual([]);
  });
});
