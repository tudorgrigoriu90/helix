import { describe, it, expect } from 'vitest';
import type { FloorTemplate } from '@shared-types/floor-template';
import type { EnemyDef } from '@shared-types/enemy';
import type { ItemDef } from '@shared-types/item';
import type { RunState } from '@shared-types/run-state';
import { bfsDistances } from '../floor-gen';
import { RunSession } from './run-session';
import { buildEnemyRegistry, type EnemyRegistry } from './encounter';
import { DISPENSER_MIN_STOCK, DISPENSER_MAX_STOCK } from '../economy';

// ── Fixtures ────────────────────────────────────────────────────────────────

function template(over: Partial<FloorTemplate> = {}): FloorTemplate {
  return {
    schemaVersion: 1,
    floor: 1,
    zone: 'shallows',
    roomCount: { min: 8, max: 12 },
    roomWeights: { combat: 0.4, loot: 0.1, safe: 0.1, merchant: 0.4, trap: 0, lace_event: 0 },
    roomMinima: { safe: 1, merchant: 2 },
    connectivity: 'branching',
    enemyPool: ['filterer'],
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
  def('pressure_warden', 'floor_boss', 60),
]);

const POOL: readonly ItemDef[] = Array.from({ length: 10 }, (_, i) => ({
  id: `item_${i}`, name: `Item ${i}`, rarity: 'common', category: 'consumable', effect: null,
}));

function newSession(seed: number, withPool = true): RunSession {
  return new RunSession({
    seed, template: template(), registry, finalFloor: 20,
    itemPool: withPool ? POOL : undefined,
  });
}

/** Greedily walks toward `target` (passing through any room — combat rooms are
 *  not fought, just traversed). Returns true on arrival. */
function walkTo(s: RunSession, target: string): boolean {
  let guard = 0;
  while (guard++ < 200) {
    if (s.snapshot.currentRoomId === target) return true;
    if (s.snapshot.status !== 'exploring') return false;
    const dist = bfsDistances(target, s.floor.rooms, s.floor.edges);
    let best: string | undefined;
    let bestD = Infinity;
    for (const r of s.adjacentRooms()) {
      const d = dist.get(r) ?? Infinity;
      if (d < bestD) { bestD = d; best = r; }
    }
    if (best === undefined || bestD === Infinity) return false;
    s.moveTo(best);
  }
  return false;
}

/** Walks to the first reachable non-boss merchant room; returns its id. */
function reachMerchant(s: RunSession): string {
  for (const m of s.floor.rooms) {
    if (m.type !== 'merchant' || m.id === s.floor.bossRoomId) continue;
    if (walkTo(s, m.id)) return m.id;
  }
  throw new Error('reachMerchant: no reachable merchant room');
}

/** Banks a generous VEIN balance by clearing one combat encounter as though a
 *  big pack of grunts fell (enough to afford any common-priced item). */
function fundByCombat(s: RunSession): void {
  // Walk to the nearest uncleared combat room, enter it, then end with a
  // terminal state padded with dead grunts so the kill payout is comfortably
  // above a common item's price (40 VEIN; grunt = 8 each → 10 kills = 80).
  for (let i = 0; i < 40 && !s.needsCombat(); i++) {
    const target = s.floor.rooms.find(
      (r) => r.enemies.length > 0 && r.id !== s.floor.bossRoomId && !s.snapshot.clearedRoomIds.includes(r.id),
    );
    if (target === undefined || !walkTo(s, target.id)) break;
  }
  if (!s.needsCombat()) throw new Error('fundByCombat: no combat room reachable');
  const combat = s.beginEncounter()!;
  const grunts = Array.from({ length: 10 }, (_, k) => ({
    id: `pad${k}`, enemyDefId: 'filterer', pos: { x: 0, y: 0 },
    hp: 0, maxHp: 16, stats: { str: 6, res: 2, agi: 5, int: 2 }, statuses: [], telegraph: null,
  }));
  const dead: RunState = { ...combat, enemies: grunts, phase: 'floor_complete' };
  s.endEncounter(dead);
}

// ── Tests ─────────────────────────────────────────────────────────────────

describe('RunSession Dispenser stock — T-116b (GDD §10.3)', () => {
  it('a merchant room offers 4–6 distinct items from the pool', () => {
    const s = newSession(1);
    reachMerchant(s);
    expect(s.isAtDispenser()).toBe(true);
    const stock = s.dispenserStock();
    expect(stock.length).toBeGreaterThanOrEqual(DISPENSER_MIN_STOCK);
    expect(stock.length).toBeLessThanOrEqual(DISPENSER_MAX_STOCK);
    expect(new Set(stock.map((i) => i.id)).size).toBe(stock.length);
    const poolIds = new Set(POOL.map((i) => i.id));
    for (const i of stock) expect(poolIds.has(i.id)).toBe(true);
  });

  it('stock is stable across reads (cached per room)', () => {
    const s = newSession(2);
    reachMerchant(s);
    expect(s.dispenserStock().map((i) => i.id)).toEqual(s.dispenserStock().map((i) => i.id));
  });

  it('is deterministic: two sessions on the same seed stock the same shelf', () => {
    const shelf = (): string[] => {
      const s = newSession(123);
      const m = reachMerchant(s);
      return s.snapshot.currentRoomId === m ? s.dispenserStock().map((i) => i.id) : [];
    };
    expect(shelf()).toEqual(shelf());
  });

  it('returns no stock when no item pool was supplied', () => {
    const s = newSession(3, /* withPool */ false);
    reachMerchant(s);
    expect(s.isAtDispenser()).toBe(true);
    expect(s.dispenserStock()).toEqual([]);
  });

  it('returns no stock outside a merchant room', () => {
    const s = newSession(4);
    expect(s.isAtDispenser()).toBe(false); // start room is safe
    expect(s.dispenserStock()).toEqual([]);
  });

  it('buying a stocked item charges VEIN and removes it from the shelf', () => {
    const s = newSession(7);
    fundByCombat(s);
    expect(s.snapshot.veinCrystals).toBeGreaterThan(0);
    reachMerchant(s);

    const stock = s.dispenserStock();
    expect(stock.length).toBeGreaterThan(0);
    const target = stock.find((i) => s.canAfford(i));
    expect(target, 'should afford at least one stocked item').toBeDefined();

    const before = s.dispenserStock().length;
    const vein0 = s.snapshot.veinCrystals;
    s.purchaseItem(target!);

    expect(s.snapshot.veinCrystals).toBe(vein0 - s.dispenserPriceOf(target!));
    const after = s.dispenserStock();
    expect(after.length).toBe(before - 1);
    expect(after.some((i) => i.id === target!.id)).toBe(false);
    expect(s.snapshot.player.items.some((i) => i.id === target!.id)).toBe(true);
  });
});
