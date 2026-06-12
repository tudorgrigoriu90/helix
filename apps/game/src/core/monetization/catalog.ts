/**
 * IAP catalog — T-532 (DR-010, GDD §15.3–§15.5, UFD 06).
 *
 * The complete, closed set of purchasable SKUs, typed so DR-010's integrity
 * rules are structural rather than aspirational:
 *
 *   - the **Deep Signal Pass** at $4.99/mo or $39.99/yr (cosmetic + identity
 *     perks only — never power, never minutes-saved)
 *   - **3 cosmetic packs** (Shard-Crystal-priced cosmetics also exist; these
 *     are the direct-purchase bundles)
 *   - the **$9.99 "First Descent" Supporter Pack** (DR-011): supporter share
 *     frame + run-end title card + a LACE thank-you Codex entry
 *   - **no VEIN SKU, no currency SKU of any kind** — VEIN Crystals are never
 *     purchasable, Shard Crystals are earnable-only; money never buys
 *     survival or power (the revive is rewarded-ad only).
 *
 * catalog.test.ts pins every invariant. The store *screens* (S120+, S-9.1),
 * the platform IAP adapter (S-5.4), and server-side receipt validation
 * (Blaze-gated) consume this catalog later — defining it now means they
 * inherit DR-010 instead of re-deciding it.
 */

export type SkuKind = 'subscription' | 'cosmetic_pack' | 'supporter_pack';

export interface Sku {
  /** Store product id (also the analytics key). */
  readonly id: string;
  readonly kind: SkuKind;
  readonly name: string;
  /** USD list price — display/pinning only; stores localize actual pricing. */
  readonly usd: number;
  /** What the SKU grants. Cosmetic/identity content only — no currency field
   *  exists on this shape by design (DR-010). */
  readonly grants: readonly string[];
}

/** Deep Signal Pass (GDD §15.3) — DR-010 locked pricing. */
export const PASS_MONTHLY_USD = 4.99;
export const PASS_ANNUAL_USD = 39.99;

export const IAP_CATALOG: readonly Sku[] = [
  {
    id: 'deep_signal_pass_monthly',
    kind: 'subscription',
    name: 'Deep Signal Pass',
    usd: PASS_MONTHLY_USD,
    grants: ['pass_cosmetic_track', 'pass_title_cards', 'pass_codex_annotations'],
  },
  {
    id: 'deep_signal_pass_annual',
    kind: 'subscription',
    name: 'Deep Signal Pass (annual)',
    usd: PASS_ANNUAL_USD,
    grants: ['pass_cosmetic_track', 'pass_title_cards', 'pass_codex_annotations'],
  },
  {
    id: 'cosmetic_pack_abyssal',
    kind: 'cosmetic_pack',
    name: 'Abyssal Bloom Pack',
    usd: 2.99,
    grants: ['skin_abyssal_bloom', 'trail_pressure_wake'],
  },
  {
    id: 'cosmetic_pack_mycelial',
    kind: 'cosmetic_pack',
    name: 'Sporelight Pack',
    usd: 2.99,
    grants: ['skin_sporelight', 'trail_drifting_spores'],
  },
  {
    id: 'cosmetic_pack_voidborn',
    kind: 'cosmetic_pack',
    name: 'Null Resonance Pack',
    usd: 2.99,
    grants: ['skin_null_resonance', 'trail_collapsed_light'],
  },
  {
    id: 'first_descent_supporter',
    kind: 'supporter_pack',
    name: 'First Descent Supporter Pack',
    usd: 9.99,
    grants: ['supporter_share_frame', 'supporter_title_card', 'codex_lace_thank_you'],
  },
];

/** Grant-id substrings that would mean a SKU sells currency or survival —
 *  forbidden by DR-010, enforced by catalog.test.ts. */
export const FORBIDDEN_GRANT_PATTERNS: readonly RegExp[] = [
  /vein/i,
  /shard/i,
  /crystal/i,
  /revive/i,
  /currency/i,
  /booster?/i,
];
