import { describe, it, expect } from 'vitest';
import {
  IAP_CATALOG,
  PASS_MONTHLY_USD,
  PASS_ANNUAL_USD,
  FORBIDDEN_GRANT_PATTERNS,
} from './catalog';

/**
 * T-532 — DR-010 monetization integrity, pinned.
 * The catalog is the closed set of purchasable SKUs; these tests make the
 * locked rules structural so a future SKU can't quietly bend them.
 */

describe('IAP catalog — DR-010 invariants (T-532)', () => {
  it('the Deep Signal Pass is locked at $4.99/mo and $39.99/yr', () => {
    expect(PASS_MONTHLY_USD).toBe(4.99);
    expect(PASS_ANNUAL_USD).toBe(39.99);
    const subs = IAP_CATALOG.filter((s) => s.kind === 'subscription');
    expect(subs.map((s) => s.usd).sort((a, b) => a - b)).toEqual([4.99, 39.99]);
  });

  it('ships exactly 3 cosmetic packs and the $9.99 First Descent Supporter Pack (DR-011)', () => {
    expect(IAP_CATALOG.filter((s) => s.kind === 'cosmetic_pack')).toHaveLength(3);
    const supporter = IAP_CATALOG.filter((s) => s.kind === 'supporter_pack');
    expect(supporter).toHaveLength(1);
    expect(supporter[0]!.usd).toBe(9.99);
    expect(supporter[0]!.id).toBe('first_descent_supporter');
  });

  it('contains NO currency SKU — VEIN is never purchasable, Shards never sold', () => {
    // Structural: the only legal kinds are subscription / cosmetic_pack /
    // supporter_pack — there is no slot a currency SKU could occupy.
    for (const sku of IAP_CATALOG) {
      expect(['subscription', 'cosmetic_pack', 'supporter_pack']).toContain(sku.kind);
      expect(sku.id.toLowerCase()).not.toContain('vein');
      expect(sku.name.toLowerCase()).not.toContain('vein');
    }
  });

  it('no SKU grants currency, power, or survival (DR-010: money never buys the run)', () => {
    for (const sku of IAP_CATALOG) {
      for (const grant of sku.grants) {
        for (const forbidden of FORBIDDEN_GRANT_PATTERNS) {
          expect(forbidden.test(grant), `${sku.id} grants "${grant}" matching ${String(forbidden)}`).toBe(false);
        }
      }
    }
  });

  it('SKU ids are unique and every SKU grants something concrete', () => {
    const ids = IAP_CATALOG.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const sku of IAP_CATALOG) expect(sku.grants.length).toBeGreaterThan(0);
  });
});
