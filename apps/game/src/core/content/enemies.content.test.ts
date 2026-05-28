import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parseEnemyDef } from './enemy-loader';

/**
 * T-290 — Zone-1 enemy content. Loads every shipped enemy file through the
 * T-283 loader so malformed content fails CI, and checks the Zone-1 roster the
 * Floor 1 template draws from is present (5 + boss).
 */

const ENEMIES_DIR = fileURLToPath(
  new URL('../../../../../packages/content/enemies/', import.meta.url),
);

function enemyFiles(): string[] {
  return readdirSync(ENEMIES_DIR).filter((f) => f.endsWith('.json'));
}

function readJson(file: string): unknown {
  return JSON.parse(readFileSync(`${ENEMIES_DIR}${file}`, 'utf-8'));
}

describe('Zone-1 enemy content — T-290', () => {
  it('every enemy file parses through the loader', () => {
    const files = enemyFiles();
    expect(files.length).toBeGreaterThan(0);
    for (const file of files) {
      const raw = readJson(file);
      const res = parseEnemyDef(raw);
      expect(res.ok, `${file}: ${res.ok ? '' : res.error.message}`).toBe(true);
    }
  });

  it("a file's id matches its filename", () => {
    for (const file of enemyFiles()) {
      const raw = readJson(file);
      const res = parseEnemyDef(raw);
      if (res.ok) expect(res.enemy.id).toBe(file.replace(/\.json$/, ''));
    }
  });

  it('ships the Zone-1 roster: 5 enemies + 1 boss, all in the shallows', () => {
    const enemies = enemyFiles().map((file) => {
      const res = parseEnemyDef(readJson(file));
      if (!res.ok) throw new Error(`${file} failed to parse`);
      return res.enemy;
    });

    const ids = new Set(enemies.map((e) => e.id));
    for (const expected of ['filterer', 'cave_crawler', 'acid_spitter', 'scavenger', 'shell_brute', 'pressure_warden']) {
      expect(ids.has(expected), expected).toBe(true);
    }

    expect(enemies.filter((e) => e.tier === 'boss')).toHaveLength(1);
    expect(enemies.filter((e) => e.tier !== 'boss').length).toBeGreaterThanOrEqual(5);
    for (const e of enemies) expect(e.zone, e.id).toBe('shallows');
  });
});
