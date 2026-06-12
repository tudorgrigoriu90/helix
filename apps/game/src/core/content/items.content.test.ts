import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { ItemDef } from '@shared-types/item';
import { parseItemDef } from './item-loader';

/**
 * T-292 (Gate-1 Commons) → T-304 (full tiers) — item content gate. Loads every
 * shipped item file through the T-284 loader so malformed content fails CI,
 * and checks the catalog covers every effect kind and every rarity band.
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

function allItems(): ItemDef[] {
  return itemFiles().map((file) => {
    const res = parseItemDef(readJson(file));
    if (!res.ok) throw new Error(`${file}: ${res.error.message}`);
    return res.item;
  });
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

  it('covers every rarity band so drops and Dispenser tiers never starve (T-304)', () => {
    const byRarity = new Map<string, number>();
    for (const item of allItems()) byRarity.set(item.rarity, (byRarity.get(item.rarity) ?? 0) + 1);
    expect(byRarity.get('common') ?? 0).toBeGreaterThanOrEqual(14);
    expect(byRarity.get('uncommon') ?? 0).toBeGreaterThanOrEqual(8);
    expect(byRarity.get('rare') ?? 0).toBeGreaterThanOrEqual(6);
    expect(byRarity.get('legendary') ?? 0).toBeGreaterThanOrEqual(4);
    // Each band needs at least one consumable (loot variety) and the upper
    // bands at least one carried item (passive/equipment — the build pieces).
    for (const rarity of ['uncommon', 'rare', 'legendary']) {
      const band = allItems().filter((i) => i.rarity === rarity);
      expect(band.some((i) => i.category === 'consumable'), `${rarity} consumable`).toBe(true);
      expect(band.some((i) => i.category !== 'consumable'), `${rarity} carried`).toBe(true);
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
    // At least one cursed item ships (the curse mechanic, GDD §9.3).
    expect(items.some((i) => i.cursed === true)).toBe(true);
  });
});
