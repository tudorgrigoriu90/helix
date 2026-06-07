import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { EnemyDef } from '@shared-types/enemy';
import type { Zone } from '@shared-types/floor-template';
import { parseEnemyDef } from './enemy-loader';

/**
 * Enemy content gate — T-290 (Zone 1) → T-296/T-303 (all 4 zones). Loads every
 * shipped enemy file through the T-283 loader so malformed content fails CI, and
 * checks the bestiary's shape: ids match filenames, the original Zone-1 roster is
 * intact, every enemy sits in a valid zone, and each zone ships its own bosses
 * (no boss id is shared — every floor's boss is unique).
 *
 * Assertions are written to hold at every incremental zone drop, not just once
 * the whole game is shipped, so a per-zone push keeps the suite green.
 */

const ENEMIES_DIR = fileURLToPath(
  new URL('../../../../../packages/content/enemies/', import.meta.url),
);

const VALID_ZONES: readonly Zone[] = ['shallows', 'mycosphere', 'lithic', 'convergence'];

function enemyFiles(): string[] {
  return readdirSync(ENEMIES_DIR).filter((f) => f.endsWith('.json'));
}

function readJson(file: string): unknown {
  return JSON.parse(readFileSync(`${ENEMIES_DIR}${file}`, 'utf-8'));
}

function allEnemies(): EnemyDef[] {
  return enemyFiles().map((file) => {
    const res = parseEnemyDef(readJson(file));
    if (!res.ok) throw new Error(`${file}: ${res.error.message}`);
    return res.enemy;
  });
}

describe('enemy content — T-290 / T-296 / T-303', () => {
  it('every enemy file parses through the loader', () => {
    const files = enemyFiles();
    expect(files.length).toBeGreaterThan(0);
    for (const file of files) {
      const res = parseEnemyDef(readJson(file));
      expect(res.ok, `${file}: ${res.ok ? '' : res.error.message}`).toBe(true);
    }
  });

  it("a file's id matches its filename", () => {
    for (const file of enemyFiles()) {
      const res = parseEnemyDef(readJson(file));
      if (res.ok) expect(res.enemy.id).toBe(file.replace(/\.json$/, ''));
    }
  });

  it('ships the original Zone-1 roster (5 + boss) in the shallows', () => {
    const byId = new Map(allEnemies().map((e) => [e.id, e]));
    for (const expected of ['filterer', 'cave_crawler', 'acid_spitter', 'scavenger', 'shell_brute', 'pressure_warden']) {
      const e = byId.get(expected);
      expect(e, expected).toBeDefined();
      expect(e?.zone, expected).toBe('shallows');
    }
  });

  it('every enemy sits in a valid zone', () => {
    for (const e of allEnemies()) {
      expect(VALID_ZONES.includes(e.zone), `${e.id}: zone ${e.zone}`).toBe(true);
    }
  });

  it('every shipped zone provides at least one boss', () => {
    const enemies = allEnemies();
    const zonesPresent = new Set(enemies.map((e) => e.zone));
    for (const zone of zonesPresent) {
      const bosses = enemies.filter((e) => e.zone === zone && e.tier === 'boss');
      expect(bosses.length, `zone ${zone} has no boss`).toBeGreaterThanOrEqual(1);
    }
  });

  it('no boss id is shared — every boss is unique', () => {
    const bossIds = allEnemies().filter((e) => e.tier === 'boss').map((e) => e.id);
    expect(new Set(bossIds).size).toBe(bossIds.length);
  });
});
