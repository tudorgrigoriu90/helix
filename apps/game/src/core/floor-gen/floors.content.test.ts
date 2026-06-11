import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { EnemyDef } from '@shared-types/enemy';
import { ZONE_WARDEN_FLOORS } from '@shared-types/enemy';
import type { FloorTemplate, Zone } from '@shared-types/floor-template';
import { parseFloorTemplate } from './floor-template-loader';
import { parseEnemyDef } from '../content/enemy-loader';

/**
 * Floor-template content gate — T-291 (Zone 1) → T-298 (Zones 1–2) → T-305 (all
 * 20). Loads every shipped floor through the loader and pins the zone design:
 * the floor number matches its filename, its zone matches the GDD §7.1 band,
 * every pooled/boss enemy belongs to the floor's zone, and no boss is reused
 * across floors. Assertions hold at every incremental zone drop.
 */

const CONTENT = fileURLToPath(new URL('../../../../../packages/content/', import.meta.url));
const FLOORS_DIR = `${CONTENT}floors/`;
const ENEMIES_DIR = `${CONTENT}enemies/`;

/** GDD §7.1: five floors per zone, four zones across the 20-floor descent. */
function zoneForFloor(n: number): Zone {
  if (n <= 5) return 'shallows';
  if (n <= 10) return 'mycosphere';
  if (n <= 15) return 'lithic';
  return 'convergence';
}

function readJson(dir: string, file: string): unknown {
  return JSON.parse(readFileSync(`${dir}${file}`, 'utf-8'));
}

function floorFiles(): string[] {
  return readdirSync(FLOORS_DIR).filter((f) => f.endsWith('.json'));
}

function allFloors(): { file: string; tpl: FloorTemplate }[] {
  return floorFiles().map((file) => {
    const res = parseFloorTemplate(readJson(FLOORS_DIR, file));
    if (!res.ok) throw new Error(`${file}: ${res.error.message}`);
    return { file, tpl: res.template };
  });
}

function enemyRegistry(): Map<string, EnemyDef> {
  const reg = new Map<string, EnemyDef>();
  for (const file of readdirSync(ENEMIES_DIR).filter((f) => f.endsWith('.json'))) {
    const res = parseEnemyDef(readJson(ENEMIES_DIR, file));
    if (res.ok) reg.set(res.enemy.id, res.enemy);
  }
  return reg;
}

describe('floor-template content — T-291 / T-298 / T-305', () => {
  it('every floor file parses through the loader', () => {
    const files = floorFiles();
    expect(files.length).toBeGreaterThan(0);
    for (const file of files) {
      const res = parseFloorTemplate(readJson(FLOORS_DIR, file));
      expect(res.ok, `${file}: ${res.ok ? '' : res.error.message}`).toBe(true);
    }
  });

  it("a file's floor number matches its filename (floor_NN.json)", () => {
    for (const { file, tpl } of allFloors()) {
      expect(`floor_${String(tpl.floor).padStart(2, '0')}.json`).toBe(file);
    }
  });

  it('floor numbers are within 1..20 and unique', () => {
    const nums = allFloors().map((f) => f.tpl.floor);
    for (const n of nums) {
      expect(n, `floor ${n}`).toBeGreaterThanOrEqual(1);
      expect(n, `floor ${n}`).toBeLessThanOrEqual(20);
    }
    expect(new Set(nums).size).toBe(nums.length);
  });

  it("each floor's zone matches its GDD §7.1 band", () => {
    for (const { tpl } of allFloors()) {
      expect(tpl.zone, `floor ${tpl.floor}`).toBe(zoneForFloor(tpl.floor));
    }
  });

  it("every pooled enemy and boss belongs to the floor's zone", () => {
    const reg = enemyRegistry();
    for (const { tpl } of allFloors()) {
      for (const id of tpl.enemyPool) {
        const def = reg.get(id);
        expect(def, `floor ${tpl.floor} pool ${id}`).toBeDefined();
        expect(def?.zone, `floor ${tpl.floor} pool ${id}`).toBe(tpl.zone);
      }
      const boss = reg.get(tpl.bossId);
      expect(boss, `floor ${tpl.floor} boss ${tpl.bossId}`).toBeDefined();
      // DR-008 (T-501): zone-end floors field a Zone Warden, all others a Floor Boss.
      const expectedTier = ZONE_WARDEN_FLOORS.includes(tpl.floor) ? 'zone_warden' : 'floor_boss';
      expect(boss?.tier, `floor ${tpl.floor} boss ${tpl.bossId}`).toBe(expectedTier);
      expect(boss?.zone, `floor ${tpl.floor} boss ${tpl.bossId}`).toBe(tpl.zone);
    }
  });

  it('no boss is reused across floors', () => {
    const bossIds = allFloors().map((f) => f.tpl.bossId);
    expect(new Set(bossIds).size).toBe(bossIds.length);
  });
});
