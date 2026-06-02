import type { EnemyTier } from '@shared-types/enemy';
import type { ItemDef, ItemRarity } from '@shared-types/item';
import type { Mulberry32 } from '../rng/mulberry32';

/**
 * Enemy item-drop rolls — T-445 (GDD §9.4).
 *
 * On a kill, roll the *items* an enemy drops from the floor's item pool, by tier:
 *   - grunt: 50% chance → 1 Common
 *   - elite: 100% → 1 Uncommon/Rare
 *   - boss:  100% → 2 items (1 guaranteed Rare+, 1 of any rarity)
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
  boss: { chance: 1, count: 2, bands: ['rare', 'legendary'] }, // overridden below (1 Rare+, 1 any)
};

const ALL_RARITIES: readonly ItemRarity[] = ['common', 'uncommon', 'rare', 'legendary'];

/** Picks one item whose rarity is in `bands`; falls back to the whole pool if the band is empty. */
function pickFromBands(pool: readonly ItemDef[], bands: readonly ItemRarity[], rng: Mulberry32): ItemDef | undefined {
  const eligible = pool.filter((i) => bands.includes(i.rarity));
  const from = eligible.length > 0 ? eligible : pool;
  return from.length > 0 ? from[rng.nextInt(from.length)] : undefined;
}

/** Rolls the items a fallen enemy of `tier` drops from `pool`. Draw order is
 *  fixed (chance → picks) so a given RNG state is deterministic. */
export function rollItemDrops(tier: EnemyTier, pool: readonly ItemDef[], rng: Mulberry32): ItemDef[] {
  if (pool.length === 0) return [];
  const cfg = TIER_DROP[tier];
  if (rng.next() >= cfg.chance) return [];

  const out: (ItemDef | undefined)[] = [];
  if (tier === 'boss') {
    out.push(pickFromBands(pool, ['rare', 'legendary'], rng)); // guaranteed Rare+
    out.push(pickFromBands(pool, ALL_RARITIES, rng)); // plus one of any rarity
  } else {
    for (let i = 0; i < cfg.count; i++) out.push(pickFromBands(pool, cfg.bands, rng));
  }
  return out.filter((i): i is ItemDef => i !== undefined);
}
