import { describe, it, expect } from 'vitest';
import type { FloorTemplate } from '@shared-types/floor-template';
import type { EnemyDef } from '@shared-types/enemy';
import type { EnemyState, PlayerState, RunState } from '@shared-types/run-state';
import type { ItemDef } from '@shared-types/item';
import { bfsDistances } from '../floor-gen';
import { RunSession } from './run-session';
import { buildEnemyRegistry, type EnemyRegistry } from './encounter';
import { newRunPlayer } from './start-player';
import { dispenserPriceForFloor } from '../economy';

// ── Fixtures ────────────────────────────────────────────────────────────────

function template(over: Partial<FloorTemplate> = {}): FloorTemplate {
  return {
    schemaVersion: 1,
    floor: 1,
    zone: 'shallows',
    roomCount: { min: 8, max: 12 },
    roomWeights: { combat: 0.5, loot: 0.15, safe: 0.15, merchant: 0.1, trap: 0.05, lace_event: 0.05 },
    roomMinima: { safe: 1 },
    connectivity: 'branching',
    enemyPool: ['filterer', 'cave_crawler'],
    bossId: 'pressure_warden',
    aestheticTags: ['caves'],
    ...over,
  };
}

function def(id: string, tier: EnemyDef['tier'], maxHp: number): EnemyDef {
  return {
    schemaVersion: 1, id, name: id, tier, zone: 'shallows', maxHp,
    stats: { str: 6, res: 2, agi: 5, int: 2 }, damageType: 'physical', aestheticTags: ['caves'],
  };
}

const registry: EnemyRegistry = buildEnemyRegistry([
  def('filterer', 'grunt', 16),
  def('cave_crawler', 'grunt', 18),
  def('pressure_warden', 'boss', 60),
]);

const COMMON_ITEM: ItemDef = { id: 'item.stim', name: 'Stim', rarity: 'common', category: 'consumable', effect: { kind: 'heal', amount: 10 } };
const RARE_ITEM: ItemDef = { id: 'item.core', name: 'Vein Core', rarity: 'rare', category: 'passive', effect: null };

function newSession(seed = 11): RunSession {
  return new RunSession({ seed, template: template(), registry, finalFloor: 20 });
}

function nextTowardBoss(s: RunSession, target: string): string {
  const adj = s.adjacentRooms();
  if (adj.includes(target)) return target;
  const dist = bfsDistances(target, s.floor.rooms, s.floor.edges);
  let best = adj[0]!;
  let bestD = Infinity;
  for (const r of adj) {
    const d = dist.get(r) ?? Infinity;
    if (d < bestD) { bestD = d; best = r; }
  }
  return best;
}

function enterCombat(s: RunSession): void {
  let guard = 0;
  const target = s.floor.bossRoomId;
  while (guard++ < 100) {
    if (s.needsCombat() && s.beginEncounter() !== null) return;
    s.moveTo(nextTowardBoss(s, target));
  }
  throw new Error('enterCombat: never reached combat');
}

function deadGrunt(i: number): EnemyState {
  return {
    id: `g${i}`, enemyDefId: 'filterer', pos: { x: 0, y: 0 },
    hp: 0, maxHp: 16, stats: { str: 6, res: 2, agi: 5, int: 2 }, statuses: [], telegraph: null,
  };
}

function clearedWith(n: number, player: PlayerState): RunState {
  return {
    schemaVersion: 1, seed: 1, floorNumber: 1, phase: 'floor_complete', turn: 5,
    grid: { width: 7, height: 7, tiles: new Array(49).fill('open') },
    player,
    enemies: Array.from({ length: n }, (_, i) => deadGrunt(i)),
  };
}

/** Funds the run by clearing one encounter as though `n` grunts fell. */
function fund(s: RunSession, n: number): void {
  enterCombat(s);
  s.endEncounter(clearedWith(n, newRunPlayer()));
}

// ── Tests ─────────────────────────────────────────────────────────────────

describe('VEIN Dispenser purchases — T-112 (GDD §10.3)', () => {
  it('prices items by rarity and floor zone (T-108)', () => {
    const s = newSession();
    expect(s.dispenserPriceOf(COMMON_ITEM)).toBe(dispenserPriceForFloor('common', 1));
    expect(s.dispenserPriceOf(COMMON_ITEM)).toBe(40);
    expect(s.dispenserPriceOf(RARE_ITEM)).toBe(dispenserPriceForFloor('rare', 1));
  });

  it('canAfford reflects the run VEIN balance', () => {
    const s = newSession();
    expect(s.canAfford(COMMON_ITEM)).toBe(false); // 0 VEIN at start
    fund(s, 10); // ≥ 80 VEIN
    expect(s.snapshot.veinCrystals).toBeGreaterThanOrEqual(40);
    expect(s.canAfford(COMMON_ITEM)).toBe(true);
  });

  it('purchase deducts the price and adds the item to inventory', () => {
    const s = newSession();
    fund(s, 10);
    const balance = s.snapshot.veinCrystals;
    const items0 = s.snapshot.player.items.length;

    s.purchaseItem(COMMON_ITEM);
    expect(s.snapshot.veinCrystals).toBe(balance - 40);
    expect(s.snapshot.player.items.length).toBe(items0 + 1);
    expect(s.snapshot.player.items.at(-1)?.id).toBe(COMMON_ITEM.id);
  });

  it('throws when VEIN is insufficient and leaves state untouched', () => {
    const s = newSession(); // fresh: 0 VEIN
    expect(() => s.purchaseItem(COMMON_ITEM)).toThrow(/insufficient VEIN/);
    expect(s.snapshot.veinCrystals).toBe(0);
    expect(s.snapshot.player.items.length).toBe(0);
  });

  it('refuses trading during combat', () => {
    const s = newSession();
    enterCombat(s); // status → in_combat
    expect(() => s.purchaseItem(COMMON_ITEM)).toThrow(/cannot trade during combat/);
  });

  it('isAtDispenser is false outside a merchant room', () => {
    const s = newSession();
    expect(s.isAtDispenser()).toBe(false);
  });
});
