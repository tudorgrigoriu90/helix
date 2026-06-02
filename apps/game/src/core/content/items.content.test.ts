import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parseItemDef } from './item-loader';

/**
 * T-292 — Common-tier item content. Loads every shipped item file through the
 * T-284 loader so malformed content fails CI, and checks the Gate-1 catalog
 * (~15 Common items) is present and covers every effect kind.
 */

const ITEMS_DIR = fileURLToPath(
  new URL('../../../../../packages/content/items/', import.meta.url),
);

function itemFiles(): string[] {
  return readdirSync(ITEMS_DIR).filter((f) => f.endsWith('.json'));
}

function readJson(file: string): unknown {
  return JSON.parse(readFileSync(`${ITEMS_DIR}${file}`, 'utf-8'));
}

describe('Common-tier item content — T-292', () => {
  it('ships at least 15 items, every one parsing through the loader', () => {
    const files = itemFiles();
    expect(files.length).toBeGreaterThanOrEqual(15);
    for (const file of files) {
      const res = parseItemDef(readJson(file));
      expect(res.ok, `${file}: ${res.ok ? '' : res.error.message}`).toBe(true);
    }
  });

  it("a file's id matches its filename", () => {
    for (const file of itemFiles()) {
      const res = parseItemDef(readJson(file));
      if (res.ok) expect(res.item.id).toBe(file.replace(/\.json$/, ''));
    }
  });

  it('the catalog covers heal, damage, applyStatus, and a null-effect passive', () => {
    const items = itemFiles().map((file) => {
      const res = parseItemDef(readJson(file));
      if (!res.ok) throw new Error(`${file} failed to parse`);
      return res.item;
    });

    const kinds = new Set<string>(items.map((i) => i.effect?.kind ?? 'none'));
    for (const kind of ['heal', 'damage', 'applyStatus', 'none']) {
      expect(kinds.has(kind), kind).toBe(true);
    }
    // The Gate-1 catalog is Common tier; cursed items (T-449) may be rarer.
    for (const i of items) if (i.cursed !== true) expect(i.rarity, i.id).toBe('common');
    // At least one cursed item ships (the curse mechanic, GDD §9.3).
    expect(items.some((i) => i.cursed === true)).toBe(true);
  });
});
