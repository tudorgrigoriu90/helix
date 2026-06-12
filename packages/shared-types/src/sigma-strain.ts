import type { MutationFamily } from './mutation.js';
import type { DamageType } from './run-state.js';

/**
 * Sigma Strain — a permanent meta-progression passive (GDD §11.2).
 *
 * Strains are unlocked through achievements (lifetime milestones tracked on
 * MetaState) and then apply *every* run, forever. Per the GDD they are nudges,
 * never power spikes — numeric effects stay in single-digit percents and
 * binary effects are information or convenience, not damage. Authored as one
 * JSON file per strain under `packages/content/sigma-strains/`; the loader
 * (T-306) parses them, `evaluateStrainUnlocks` folds new unlocks into the
 * profile at run end, and `aggregateStrainFx` turns the unlocked set into the
 * run-start modifiers. All effects are labeled [META] in UI surfaces (§11.2).
 */

/** The lifetime milestone that unlocks a strain. Evaluated against MetaState. */
export type StrainUnlock =
  /** Lifetime runs completed (won or lost) reaches `count`. */
  | { readonly kind: 'runsCompleted'; readonly count: number }
  /** Lifetime wins (Floor 20 Convergence reached) reaches `count`. */
  | { readonly kind: 'wins'; readonly count: number }
  /** Deepest floor ever reached is at least `floor`. */
  | { readonly kind: 'reachFloor'; readonly floor: number }
  /** Lifetime enemies killed reaches `count`. */
  | { readonly kind: 'enemiesKilled'; readonly count: number }
  /** Lifetime kills of enemies whose basic attack deals `damageType`. */
  | { readonly kind: 'killsOfType'; readonly damageType: DamageType; readonly count: number }
  /** Runs finished with `family` as the build's most-stacked family. */
  | { readonly kind: 'runsWithFamily'; readonly family: MutationFamily; readonly count: number }
  /** Deaths where the killing blow dealt `damageType`. */
  | { readonly kind: 'deathsToType'; readonly damageType: DamageType; readonly count: number };

/**
 * What an unlocked strain does. Numeric effects of the same kind stack
 * additively across strains; binary effects never repeat across the catalog.
 * The marker effects (minimap/LACE hint/intent reveal/shop bias) are typed
 * here and aggregated, with their scene wiring tracked under E-4.
 */
export type StrainEffect =
  /** Percent added to starting max HP (and current HP) at run start. */
  | { readonly kind: 'maxHpPercent'; readonly percent: number }
  /** Typed damage resist, same semantics as the Origin perk ('true' exempt). */
  | { readonly kind: 'damageResistPercent'; readonly damageType: DamageType; readonly percent: number }
  /** Percent bonus on all VEIN banked, every zone (stacks with Origin zone bonus). */
  | { readonly kind: 'veinBonusPercent'; readonly percent: number }
  /** Percent bonus on the run-end Shard Crystal conversion. */
  | { readonly kind: 'shardBonusPercent'; readonly percent: number }
  /** Flat VEIN Crystals banked at run start. */
  | { readonly kind: 'startingVein'; readonly amount: number }
  /** Cadence Strand Events offer one extra wild card (True Convergence). */
  | { readonly kind: 'extraWildCard' }
  /** The first weighted card of a cadence draw matches the family of the most
   *  recently acquired mutation (Early Adaptation). */
  | { readonly kind: 'firstCardMatchesLastFamily' }
  /** Carry one random mutation from the last run into the next (Convergence Echo). */
  | { readonly kind: 'carryMutation' }
  /** Room types are visible on the minimap (Adapted Eyes — scene wiring E-4). */
  | { readonly kind: 'minimapRoomTypes' }
  /** LACE hints at the next floor's biome once per run (Vein Memory — scene wiring E-4). */
  | { readonly kind: 'laceBiomeHint' }
  /** Enemies of this damage type reveal their next action (scene wiring E-4). */
  | { readonly kind: 'enemyIntentReveal'; readonly damageType: DamageType }
  /** Dispensers stock this family's themed items more often (scene wiring E-4). */
  | { readonly kind: 'shopFamilyBias'; readonly family: MutationFamily };

export interface SigmaStrainDef {
  /** Bumped when the on-disk JSON shape changes; loader runs migrations. */
  readonly schemaVersion: number;
  /** Stable id stored in `MetaState.sigmaStrainIds`. */
  readonly id: string;
  readonly name: string;
  /** One-line effect summary (UI prefixes it with [META], §11.2). */
  readonly tagline: string;
  /** Flavour prose in LACE's voice — runs through the T-530 gate. */
  readonly blurb: string;
  readonly unlock: StrainUnlock;
  readonly effect: StrainEffect;
}

/** Current strain-def schema version. Increment when the on-disk shape changes. */
export const CURRENT_SIGMA_STRAIN_SCHEMA_VERSION = 1;
