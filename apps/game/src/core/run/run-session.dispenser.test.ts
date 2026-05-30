import { describe, it, expect } from 'vitest';
import type { FloorTemplate } from '@shared-types/floor-template';
import type { EnemyDef } from '@shared-types/enemy';
import type { EnemyState, RunState } from '@shared-types/run-state';
import type { ItemDef } from '@shared-types/item';
import { RunSession } from './run-session';
import type { EnemyRegistry } from './encounter';
import { dispenserPriceForFloor, veinForKill } from '../economy';

// ── Fixtures ────────────────────────────────────────────────────────────────

const GRUNT: EnemyDef = {
  id: 'enemy.grunt',
  tier: 'grunt',
  archetype: 'swarmer',
  name: 'Grunt',
  maxHp: 10,
  stats: { str: 5, res: 0, agi: 0, int: 0 },
  abilities: [],
};

const REGISTRY: EnemyRegistry = { get: (id) => (id === GRUNT.id ? GRUNT : undefined) };

const TEMPLATE: FloorTemplate = {
  seed: 1,
  floor: 1,
  zone: 1,
  roomCount: 6,
  enemyTiers: ['grunt'],
  itemPool: [],
  hazardDensity: 0,
};

const COMMON_ITEM: ItemDef = { id: 'item.stim', name: 'Stim', rarity: 'common', slot: 'consumable' };
const RARE_ITEM: ItemDef = { id: 'item.blade', name: 'Vein Blade', rarity: 'rare', slot: 'weapon' };

function newSession(): RunSession {
  return new RunSession({ seed: 11, template: TEMPLATE, registry: REGISTRY });
}

function deadGrunt(i: number): EnemyState {
  return {
    id: `g${i}`,
    enemyDefId: GRUNT.id,
    pos: { x: 0, y: 0 },
    hp: 0,
    maxHp: GRUNT.maxHp,
    stats: GRUNT.stats,
    statuses: [],
    telegraph: null,
  };
}

/** Walks to the first room that needs a fight; returns its combat state. */
function reachCombat(session: RunSession): RunState {
  let guard = 0;
  while (guard++ < 50) {
    if (session.needsCombat()) {
      const combat = session.beginEncounter();
      if (combat !== null) return combat;
    }
    const next = session.adjacentRooms().find((r) => !session.snapshot.clearedRoomIds.includes(r))
      ?? session.adjacentRooms()[0];
    if (next === undefined) break;
    session.moveTo(next);
  }
  throw new Error('reachCombat: no combat room found');
}

/** Banks VEIN by clearing one room as though `n` grunts fell, then returns the session. */
function fundWith(session: RunSession, n: number): void {
  const combat = reachCombat(session);
  session.endEncounter({ ...combat, enemies: Array.from({ length: n }, (_, i) => deadGrunt(i)), phase: 'floor_complete' });
}

// ── Tests ─────────────────────────────────────────────────────────────────

describe('VEIN Dispenser purchases — T-112 (GDD §10.3)', () => {
  it('prices items by rarity and floor zone (T-108)', () => {
    const session = newSession();
    expect(session.dispenserPriceOf(COMMON_ITEM)).toBe(dispenserPriceForFloor('common', 1));
    expect(session.dispenserPriceOf(COMMON_ITEM)).toBe(40);
    expect(session.dispenserPriceOf(RARE_ITEM)).toBe(dispenserPriceForFloor('rare', 1));
  });

  it('canAfford reflects the run VEIN balance', () => {
    const session = newSession();
    expect(session.canAfford(COMMON_ITEM)).toBe(false); // 0 VEIN at start
    fundWith(session, 10); // 10 × 8 = 80 VEIN
    expect(session.snapshot.veinCrystals).toBe(10 * veinForKill('grunt'));
    expect(session.canAfford(COMMON_ITEM)).toBe(true); // 80 ≥ 40
  });

  it('purchase deducts the price and adds the item to inventory', () => {
    const session = newSession();
    fundWith(session, 10); // 80 VEIN
    const items0 = session.snapshot.player.items.length;

    session.purchaseItem(COMMON_ITEM);
    expect(session.snapshot.veinCrystals).toBe(80 - 40);
    expect(session.snapshot.player.items.length).toBe(items0 + 1);
    expect(session.snapshot.player.items.at(-1)?.id).toBe(COMMON_ITEM.id);
  });

  it('throws when VEIN is insufficient and leaves state untouched', () => {
    const session = newSession();
    fundWith(session, 2); // 16 VEIN < 40
    expect(() => session.purchaseItem(COMMON_ITEM)).toThrow(/insufficient VEIN/);
    expect(session.snapshot.veinCrystals).toBe(16);
    expect(session.snapshot.player.items.length).toBe(0);
  });

  it('refuses trading during combat', () => {
    const session = newSession();
    reachCombat(session); // status → in_combat
    expect(() => session.purchaseItem(COMMON_ITEM)).toThrow(/cannot trade during combat/);
  });

  it('isAtDispenser is false outside a merchant room', () => {
    const session = newSession();
    expect(session.isAtDispenser()).toBe(false);
  });
});
