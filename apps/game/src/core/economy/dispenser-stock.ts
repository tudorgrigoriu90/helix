import type { ItemDef } from '@shared-types/item';
import type { Mulberry32 } from '../rng/mulberry32';

/**
 * VEIN Dispenser stock selection — T-115b (GDD §10.3 / §7).
 *
 * A Dispenser "Sells 4–6 randomly selected items from the floor's item pool"
 * (GDD §10.3). This is the pure, deterministic selector: given the floor's pool
 * and a `loot` sub-generator, it picks a count in [4, 6] and returns that many
 * *distinct* items via a partial Fisher–Yates shuffle. Pricing is layered on
 * separately (T-108 `dispenserPriceForFloor`), and inventory refresh cadence /
 * the rewarded-ad reroll (GDD §10.3) are the caller's concern.
 *
 * The GDD specifies the *count*, not a rarity-depth curve, so selection is
 * uniform over the pool — deeper-floor value comes from the pool's own
 * composition, not a weighting invented here. Deterministic from the seed, so
 * the same floor always stocks the same shelf (T-109-style replay safety).
 */

/** Fewest items a Dispenser stocks (GDD §10.3). */
export const DISPENSER_MIN_STOCK = 4;
/** Most items a Dispenser stocks (GDD §10.3). */
export const DISPENSER_MAX_STOCK = 6;

export interface DispenserStockParams {
  /** The floor's item pool to draw from. */
  readonly pool: readonly ItemDef[];
  /** The deterministic `loot` sub-generator. */
  readonly rng: Mulberry32;
  /** Override the stock count (defaults to a roll in [4, 6]). */
  readonly count?: number;
}

/**
 * Selects the Dispenser's stock: `count` distinct items (default 4–6) drawn
 * uniformly without replacement from `pool`. If the pool is smaller than the
 * target count, the whole pool is returned (shuffled). Never mutates `pool`.
 */
export function rollDispenserStock(params: DispenserStockParams): ItemDef[] {
  const { pool, rng } = params;
  // nextInt(n) returns [0, n); map it onto the inclusive [MIN, MAX] count range.
  const span = DISPENSER_MAX_STOCK - DISPENSER_MIN_STOCK + 1;
  const target = params.count ?? DISPENSER_MIN_STOCK + rng.nextInt(span);
  const take = Math.max(0, Math.min(target, pool.length));

  // Partial Fisher–Yates over a copy: swap `take` items into the front.
  const items = [...pool];
  for (let i = 0; i < take; i++) {
    const j = i + Math.floor(rng.next() * (items.length - i));
    const tmp = items[i]!;
    items[i] = items[j]!;
    items[j] = tmp;
  }
  return items.slice(0, take);
}
