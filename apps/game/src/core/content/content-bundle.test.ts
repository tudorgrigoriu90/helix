import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { EnemyDef } from '@shared-types/enemy';
import { ZONE_WARDEN_FLOORS, ZONE_WARDEN_IDS } from '@shared-types/enemy';
import { MAX_FLOOR, zoneNameForFloor } from '@shared-types/campaign';
import type { FloorTemplate } from '@shared-types/floor-template';
import type { ItemDef } from '@shared-types/item';
import type { MutationDef } from '@shared-types/mutation';
import type { LaceLine } from '@shared-types/lace-line';
import { parseEnemyDef } from './enemy-loader';
import { parseItemDef } from './item-loader';
import { parseMutationDef } from './mutation-loader';
import { parseCodexEntries } from './codex-loader';
import { parseOriginDef } from './origin-loader';
import { parseSigmaStrainDef } from './sigma-strain-loader';
import { parseEndingDef } from './ending-loader';
import { FAMILY_RING } from '@shared-types/mutation';
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
      'room_cleared', 'boss_start', 'boss_killed', 'floor_complete', 'player_death',
      'resume_recap', 'generic',
    ];
    for (const context of contexts) {
      expect(
        lines.filter((l) => l.context === context).length,
        `context "${context}" must have ≥1 line`,
      ).toBeGreaterThanOrEqual(1);
    }
  });

  it('ships exactly the canonical campaign: MAX_FLOOR floors, zones agree (T-523)', () => {
    expect(floors).toHaveLength(MAX_FLOOR);
    const byFloor = new Map(floors.map((f) => [f.floor, f]));
    for (let n = 1; n <= MAX_FLOOR; n++) {
      const tpl = byFloor.get(n);
      expect(tpl, `floor ${n} template missing`).toBeDefined();
      expect(tpl?.zone, `floor ${n} zone`).toBe(zoneNameForFloor(n));
    }
  });

  it('ships exactly 4 Zone Wardens, on exactly floors 5/10/15/20 (T-501, DR-008)', () => {
    const wardens = enemies.filter((e) => e.tier === 'zone_warden');
    expect(wardens.map((e) => e.id).sort()).toEqual([...ZONE_WARDEN_IDS].sort());

    const enemyById = new Map(enemies.map((e) => [e.id, e]));
    for (const floor of floors) {
      const boss = enemyById.get(floor.bossId);
      const expected = ZONE_WARDEN_FLOORS.includes(floor.floor) ? 'zone_warden' : 'floor_boss';
      expect(boss?.tier, `floor ${floor.floor} boss ${floor.bossId}`).toBe(expected);
    }
  });

  it('ships the full 66-mutation roster — family and tier mix locked (T-302, GDD §5.7)', () => {
    expect(mutations).toHaveLength(66);
    const byFamily = new Map<string, number>();
    const byTier = new Map<string, number>();
    for (const m of mutations) {
      byFamily.set(m.family, (byFamily.get(m.family) ?? 0) + 1);
      byTier.set(m.tier, (byTier.get(m.tier) ?? 0) + 1);
    }
    expect(Object.fromEntries(byFamily)).toEqual({
      abyssal: 14, mycelial: 14, lithic: 13, voidborn: 13, thermal: 12,
    });
    expect(Object.fromEntries(byTier)).toEqual({ minor: 41, major: 15, dominant: 10 });
    // Dominant-tier cards only enter draws at floor 15 (GDD §5.4 Rule 3) —
    // every family must field at least one so deep draws never starve.
    for (const family of ['abyssal', 'mycelial', 'lithic', 'voidborn', 'thermal']) {
      expect(
        mutations.filter((m) => m.family === family && m.tier === 'dominant').length,
        `${family} dominant-tier coverage`,
      ).toBeGreaterThanOrEqual(2);
    }
  });

  it('ships all 10 Origins — 5 defaults + the 5 unlockables at their GDD §4.1 thresholds (T-301/T-307)', () => {
    const results = readDir('origins').map((o) => ({ file: o.file, res: parseOriginDef(o.raw) }));
    for (const { file, res } of results) {
      expect(res.ok, `${file}: ${res.ok ? '' : res.error.message}`).toBe(true);
    }
    const origins = results.flatMap((o) => (o.res.ok ? [o.res.origin] : []));
    expect(origins).toHaveLength(10);
    const defaults = origins.filter((o) => o.unlockRuns === 0).map((o) => o.id).sort();
    expect(defaults).toEqual(['blacksite_agent', 'combat_medic', 'deep_sea_diver', 'field_biologist', 'geologist']);
    // The unlockable five gate on the exact GDD §4.1 run-count milestones.
    const unlockable = new Map(origins.filter((o) => o.unlockRuns > 0).map((o) => [o.id, o.unlockRuns]));
    expect(Object.fromEntries(unlockable)).toEqual({
      volcanologist: 10, xenobiologist: 25, sigma_prime: 50, the_archivist: 100, sigma_echo: 200,
    });
    // A startingItem perk must reference shipped item content.
    const itemIds = new Set(items.map((i) => i.id));
    for (const o of origins) {
      if (o.perk.kind === 'startingItem') {
        expect(itemIds.has(o.perk.itemId), `${o.id} starting item "${o.perk.itemId}"`).toBe(true);
      }
    }
  });

  it('ships exactly the 30 Sigma Strains, the nine GDD §11.2 canon ids among them (T-306)', () => {
    const results = readDir('sigma-strains').map((s) => ({ file: s.file, res: parseSigmaStrainDef(s.raw) }));
    for (const { file, res } of results) {
      expect(res.ok, `${file}: ${res.ok ? '' : res.error.message}`).toBe(true);
    }
    const strains = results.flatMap((s) => (s.res.ok ? [s.res.strain] : []));
    expect(strains).toHaveLength(30);
    const ids = new Set(strains.map((s) => s.id));
    expect(ids.size, 'strain ids must be globally unique').toBe(30);
    // The nine strains designed in GDD §11.2 are a locked contract.
    for (const canon of [
      'resilient_baseline', 'adapted_eyes', 'early_adaptation', 'vein_memory',
      'thermal_resistance', 'abyssal_affinity', 'void_sense', 'true_convergence',
      'convergence_echo',
    ]) {
      expect(ids.has(canon), `canon strain "${canon}" missing`).toBe(true);
    }
    // Binary effects never repeat across the catalog (typed binaries may repeat
    // per type/family but not per identical parameterisation).
    const binaryKeys = strains
      .map((s) => s.effect)
      .filter((e) => !('percent' in e) && !('amount' in e))
      .map((e) => JSON.stringify(e));
    expect(new Set(binaryKeys).size, 'duplicate binary strain effect').toBe(binaryKeys.length);
  });

  it('ships exactly 5 Endings — one Convergence per mutation family (T-309, GDD §2.8)', () => {
    const results = readDir('endings').map((e) => ({ file: e.file, res: parseEndingDef(e.raw) }));
    for (const { file, res } of results) {
      expect(res.ok, `${file}: ${res.ok ? '' : res.error.message}`).toBe(true);
    }
    const endings = results.flatMap((e) => (e.res.ok ? [e.res.ending] : []));
    expect(endings).toHaveLength(5);
    expect(endings.map((e) => e.family).sort()).toEqual([...FAMILY_RING].sort());
    expect(new Set(endings.map((e) => e.id)).size).toBe(5);
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
