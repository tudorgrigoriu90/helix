import type { AbilityDef } from './ability.js';
import type { ItemCategory } from './item.js';
import type { MutationFamily } from './mutation.js';
import type { DamageType } from './run-state.js';
import type { Zone } from './floor-template.js';

/**
 * Origin — the starting condition picked before each run (GDD §4.1).
 *
 * Origins are deliberately *not* classes: base stats are identical for every
 * Origin (§4.2 — "Origins modify starting items or passive affinities, not raw
 * stats"), so a perk is a small directional nudge expressed through one of the
 * engine's existing systems. Authored as one JSON file per Origin under
 * `packages/content/origins/`; the loader (T-301) parses them and the
 * OriginSelect carousel renders + unlock-gates them off `MetaState.lifetime`.
 */

/** The systemic hook an Origin starts the run with. One perk per Origin. */
export type OriginPerk =
  /** Begin the run carrying this item (Combat Medic). Resolved from the item pool. */
  | { readonly kind: 'startingItem'; readonly itemId: string }
  /** Begin the run with an extra ability on the bar (Blacksite Agent). */
  | { readonly kind: 'startingAbility'; readonly ability: AbilityDef }
  /** Strand-draw weighting nudge toward one family (Field Biologist).
   *  Applies to cadence Strand Events only — the Proto-Strand stays uniform
   *  by design (DR-009b: "no family weighting yet"). */
  | { readonly kind: 'familyAffinity'; readonly family: MutationFamily }
  /** Percent reduction of incoming damage of one type (Deep Sea Diver). */
  | { readonly kind: 'damageResistPercent'; readonly damageType: DamageType; readonly percent: number }
  /** Percent bonus on all VEIN banked while descending one zone (Geologist). */
  | { readonly kind: 'zoneVeinBonus'; readonly zone: Zone; readonly percent: number }
  // ── The five unlockable Origins' perks (T-307, GDD §4.1) ──────────────────
  /** Full immunity to one damage type through `throughFloor` (Volcanologist:
   *  thermal, floors 1–5). Ships as a 100% resist the session prunes deeper. */
  | { readonly kind: 'zoneDamageImmunity'; readonly damageType: DamageType; readonly throughFloor: number }
  /** Enemies (and their integrity readouts) are visible even outside vision
   *  range (Xenobiologist — "see enemy HP values always"). Scene-level flag. */
  | { readonly kind: 'enemyHpReveal' }
  /** Cadence Strand draws carry one extra wild card (Sigma Prime). Shares the
   *  True Convergence strain's semantics; the two do not stack. */
  | { readonly kind: 'extraWildCard' }
  /** Each run begins with this many undiscovered Codex entries revealed
   *  (The Archivist). Resolved by the scene against the codex bundle. */
  | { readonly kind: 'codexHeadStart'; readonly count: number }
  /** Extra inventory capacity in one category (Sigma Echo: +1 consumable). */
  | { readonly kind: 'inventorySlotBonus'; readonly category: ItemCategory; readonly slots: number };

export interface OriginDef {
  /** Bumped when the on-disk JSON shape changes; loader runs migrations. */
  readonly schemaVersion: number;
  /** Stable id (analytics `run_start.originId`, save `originId`). */
  readonly id: string;
  readonly name: string;
  /** One-line perk summary shown on the select card. */
  readonly tagline: string;
  /** Flavour prose for the select card (LACE-voice — runs through the T-530 gate). */
  readonly blurb: string;
  /** Lifetime runs required to unlock; 0 = available from the first run. */
  readonly unlockRuns: number;
  readonly perk: OriginPerk;
}

/** Current origin-def schema version. Increment when the on-disk shape changes. */
export const CURRENT_ORIGIN_SCHEMA_VERSION = 1;
