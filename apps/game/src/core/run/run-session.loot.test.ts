import { describe, it, expect } from 'vitest';
import type { FloorTemplate } from '@shared-types/floor-template';
import type { EnemyDef } from '@shared-types/enemy';
import type { ItemDef, ItemRarity } from '@shared-types/item';
import type { RunState } from '@shared-types/run-state';
import { RunSession } from './run-session';
import { buildEnemyRegistry, type EnemyRegistry } from './encounter';
import { restoreRunSession } from './run-session-save';

function template(): FloorTemplate {
  return {
    schemaVersion: 1, floor: 1, zone: 'shallows',
    roomCount: { min: 8, max: 12 },
    roomWeights: { combat: 0.5, loot: 0.15, safe: 0.15, merchant: 0.1, trap: 0.05, lace_event: 0.05 },
    roomMinima: { safe: 1 }, connectivity: 'branching',
    enemyPool: ['filterer'], bossId: 'pressure_warden', aestheticTags: ['caves'],
  };
}
const registry: EnemyRegistry = buildEnemyRegistry([
  { schemaVersion: 1, id: 'filterer', name: 'F', tier: 'grunt', zone: 'shallows', maxHp: 16, stats: { str: 6, res: 2, agi: 5, int: 2 }, damageType: 'physical', aestheticTags: [] } as EnemyDef,
  { schemaVersion: 1, id: 'pressure_warden', name: 'B', tier: 'boss', zone: 'shallows', maxHp: 60, stats: { str: 6, res: 2, agi: 5, int: 2 }, damageType: 'physical', aestheticTags: [] } as EnemyDef,
]);
const item = (id: string, rarity: ItemRarity): ItemDef => ({ id, name: id, rarity, category: 'consumable', effect: null });
const POOL: readonly ItemDef[] = [item('c', 'common'), item('r', 'rare')];

function intoCombat(s: RunSession): RunState {
  const visited = new Set<string>();
  for (let i = 0; i < 100; i++) {
    if (s.needsCombat()) return s.beginEncounter()!;
    visited.add(s.snapshot.currentRoomId);
    const next = s.adjacentRooms().find((r) => !visited.has(r)) ?? s.adjacentRooms()[0];
    if (next === undefined) break;
    s.moveTo(next);
  }
  throw new Error('test setup: never reached combat');
}

/** A combat won against a single fallen enemy of the given def (drives endEncounter). */
function wonAgainst(combat: RunState, enemyDefId: string): RunState {
  return { ...combat, phase: 'victory', enemies: [{ ...combat.enemies[0]!, enemyDefId, hp: 0 }] };
}

describe('RunSession — enemy drops + loot pickup (T-445)', () => {
  it('rolls drops onto the pending pile on a kill (boss → 2 items)', () => {
    const s = new RunSession({ seed: 5, template: template(), registry, itemPool: POOL });
    const combat = intoCombat(s);
    s.endEncounter(wonAgainst(combat, 'pressure_warden'));
    expect(s.lootPending()).toHaveLength(2); // boss = 2 guaranteed
  });

  it('drops nothing when no item pool is supplied', () => {
    const s = new RunSession({ seed: 5, template: template(), registry });
    const combat = intoCombat(s);
    s.endEncounter(wonAgainst(combat, 'pressure_warden'));
    expect(s.lootPending()).toHaveLength(0);
  });

  it('takeLoot adds when there is room and consumes the pending entry', () => {
    const s = new RunSession({ seed: 5, template: template(), registry, itemPool: POOL });
    const beforeItems = s.snapshot.player.items.length;
    s.addPendingLoot(item('c', 'common'));
    const res = s.takeLoot('c');
    expect(res).toEqual({ taken: true, needsSwap: false });
    expect(s.snapshot.player.items.length).toBe(beforeItems + 1);
    expect(s.lootPending()).toHaveLength(0);
  });

  it('takeLoot reports needsSwap when the category is full, and swaps when told', () => {
    const s = new RunSession({ seed: 5, template: template(), registry, itemPool: POOL });
    // Fill equipment (2/2), then a 3rd equipment loot needs a swap.
    const equip = (id: string): ItemDef => ({ id, name: id, rarity: 'common', category: 'equipment', effect: null });
    s.addItem(equip('e1'));
    s.addItem(equip('e2'));
    s.addPendingLoot(equip('e3'));
    expect(s.takeLoot('e3')).toEqual({ taken: false, needsSwap: true });
    expect(s.takeLoot('e3', 'e1')).toEqual({ taken: true, needsSwap: false }); // swap e1 → e3
    const eq = s.snapshot.player.items.filter((i) => i.category === 'equipment').map((i) => i.id).sort();
    expect(eq).toEqual(['e2', 'e3']);
  });

  it('discardLoot leaves an item behind unclaimed', () => {
    const s = new RunSession({ seed: 5, template: template(), registry, itemPool: POOL });
    s.addPendingLoot(item('c', 'common'));
    s.discardLoot('c');
    expect(s.lootPending()).toHaveLength(0);
  });

  it('persists pending loot through save/restore (save v6)', () => {
    const s = new RunSession({ seed: 5, template: template(), registry, itemPool: POOL });
    const combat = intoCombat(s);
    s.endEncounter(wonAgainst(combat, 'pressure_warden'));
    const restored = restoreRunSession(s.toSave(), { template: template(), registry, itemPool: POOL });
    expect(restored.lootPending()).toEqual(s.lootPending());
  });
});
