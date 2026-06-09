import type { EnemyTier } from '@shared-types/enemy';
import type { ItemDef, ItemRarity } from '@shared-types/item';
import type { Mulberry32 } from '../rng/mulberry32';

/**
 * Enemy item-drop rolls — T-445 (GDD §9.4).
 *
 * On a kill, roll the *items* an enemy drops from the floor's item pool, by tier
 * (boss guarantees split per DR-008, T-302):
 *   - grunt:       50% chance → 1 Common
 *   - elite:       100% → 1 Uncommon/Rare
 *   - floor_boss:  100% → 1 item, Uncommon+
 *   - zone_warden: 100% → 2 items (1 guaranteed Rare+, 1 of any rarity)
 *
 * Pure: the only entropy is the supplied RNG (the `loot` sub-generator), so the
 * same kill on the same seed always drops the same items. Distinct from the VEIN
 * + abstract cores in `drops.ts` — this rolls actual {@link ItemDef}s the player
 * can pick up. An empty pool (no item content) yields no drops. Where the rolled
 * items go (pending-loot pickup with drop-to-swap) is the run loop's concern.
 */

interface TierDrop {
  /** P(any item drops at all). */
  readonly chance: number;
  /** How many items when it drops. */
  readonly count: number;
  /** Eligible rarity band. */
  readonly bands: readonly ItemRarity[];
}

const TIER_DROP: Readonly<Record<EnemyTier, TierDrop>> = {
  grunt: { chance: 0.5, count: 1, bands: ['common'] },
  elite: { chance: 1, count: 1, bands: ['uncommon', 'rare'] },
  floor_boss: { chance: 1, count: 1, bands: ['uncommon', 'rare', 'legendary'] }, // 1× Uncommon+
  zone_warden: { chance: 1, count: 2, bands: ['rare', 'legendary'] }, // overridden below (1 Rare+, 1 any)
};

const ALL_RARITIES: readonly ItemRarity[] = ['common', 'uncommon', 'rare', 'legendary'];

/** Picks one item whose rarity is in `bands`; falls back to the whole pool if the band is empty. */
function pickFromBands(pool: readonly ItemDef[], bands: readonly ItemRarity[], rng: Mulberry32): ItemDef | undefined {
  const eligible = pool.filter((i) => bands.includes(i.rarity));
  const from = eligible.length > 0 ? eligible : pool;
  return from.length > 0 ? from[rng.nextInt(from.length)] : undefined;
}

/** Floor range each rarity can appear in (GDD §9.1). */
const RARITY_FLOORS: Readonly<Record<ItemRarity, readonly [number, number]>> = {
  common: [1, 10],
  uncommon: [4, 15],
  rare: [8, 20],
  legendary: [14, 20],
};
/** Relative weight of each rarity when rolling a floor-appropriate item (GDD §9.1 drop chances). */
const RARITY_WEIGHT: Readonly<Record<ItemRarity, number>> = { common: 60, uncommon: 25, rare: 12, legendary: 3 };

/**
 * Rolls the single guaranteed loot-room item (GDD §9.4) — a floor-appropriate
 * tier: only rarities whose floor band includes `floor` are eligible, weighted
 * by their drop chance (so deeper floors lean rarer). Falls back to the whole
 * pool if nothing matches. Deterministic per RNG state; undefined for an empty pool.
 */
export function rollLootRoomItem(floor: number, pool: readonly ItemDef[], rng: Mulberry32): ItemDef | undefined {
  if (pool.length === 0) return undefined;
  const eligible = pool.filter((i) => {
    const [lo, hi] = RARITY_FLOORS[i.rarity];
    return floor >= lo && floor <= hi;
  });
  const candidates = eligible.length > 0 ? eligible : pool;
  const total = candidates.reduce((s, i) => s + RARITY_WEIGHT[i.rarity], 0);
  let r = rng.next() * total;
  for (const i of candidates) {
    r -= RARITY_WEIGHT[i.rarity];
    if (r < 0) return i;
  }
  return candidates[candidates.length - 1];
}

/** Rolls the items a fallen enemy of `tier` drops from `pool`. Draw order is
 *  fixed (chance → picks) so a given RNG state is deterministic. */
export function rollItemDrops(tier: EnemyTier, pool: readonly ItemDef[], rng: Mulberry32): ItemDef[] {
  if (pool.length === 0) return [];
  const cfg = TIER_DROP[tier];
  if (rng.next() >= cfg.chance) return [];

  const out: (ItemDef | undefined)[] = [];
  if (tier === 'zone_warden') {
    out.push(pickFromBands(pool, ['rare', 'legendary'], rng)); // guaranteed Rare+
    out.push(pickFromBands(pool, ALL_RARITIES, rng)); // plus one of any rarity
  } else {
    for (let i = 0; i < cfg.count; i++) out.push(pickFromBands(pool, cfg.bands, rng));
  }
  return out.filter((i): i is ItemDef => i !== undefined);
}
