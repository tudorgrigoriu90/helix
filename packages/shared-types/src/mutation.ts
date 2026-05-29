import type { AbilityDef } from './ability.js';
import type { EntityStats } from './run-state.js';

/**
 * Genetic mutation — the data contract for Strand Events (GDD §5), the core
 * build system of the game. One JSON file per mutation under
 * `packages/content/mutations/`; the loader (T-83) parses + validates them.
 *
 * Schema reality note: the TDD §8.1 sketch showed localized `name`/`description`
 * objects and modifier targets like `"armor"`/`"crush"`. The shipped engine uses
 * flat English-only strings (i18n deferred per TDD §21 Q1) and the real
 * `EntityStats` keys (str/res/agi/int) + real `DamageType`/`StatusEffect` enums.
 * This schema matches the *working code* (item.ts / enemy.ts conventions), not
 * the early sketch.
 */

/** The five genetic families (GDD §5.2). */
export type MutationFamily = 'abyssal' | 'mycelial' | 'lithic' | 'voidborn' | 'thermal';

/** Mutation power tier (GDD §5.3). Tier gates which Strand Event slots offer it. */
export type MutationTier = 'minor' | 'major' | 'dominant';

/**
 * A passive, always-on effect a mutation applies to the player on selection
 * (GDD §5.3 "Passive Effect"). Targets the real `PlayerState` fields the turn
 * engine reads, so a mutation's effect is immediately felt in combat:
 *   - `stat`  — additive delta to one of str/res/agi/int
 *   - `maxHp` — additive delta to max HP (current HP rises by the same amount)
 *   - `maxAp` — additive delta to max AP (current AP rises by the same amount)
 */
export type MutationModifier =
  | { readonly kind: 'stat'; readonly stat: keyof EntityStats; readonly delta: number }
  | { readonly kind: 'maxHp'; readonly delta: number }
  | { readonly kind: 'maxAp'; readonly delta: number };

export interface MutationDef {
  readonly id: string;
  readonly family: MutationFamily;
  readonly tier: MutationTier;
  readonly name: string;
  /** Sigma Resonance granted on selection (GDD §4.2 / §5.3). */
  readonly sigBonus: number;
  /** Passive stat effects applied on selection (T-90). */
  readonly modifiers: readonly MutationModifier[];
  /** Active ability the mutation grants, or null for passive-only mutations. */
  readonly grantsAbility: AbilityDef | null;
  /** LACE's one-line commentary on the card (GDD §5.3). Feeds the narrator. */
  readonly lace: string;
  /** Free-form tags (synergy keys, passive markers). */
  readonly tags: readonly string[];
}

/** Current mutation-content schema version. Increment when the on-disk shape changes. */
export const CURRENT_MUTATION_SCHEMA_VERSION = 1;

/**
 * The five families arranged in a ring, in GDD §5.2 table order. Each family's
 * two ring-neighbours are its "adjacent" families for the card-draw weighting
 * (GDD §5.4 Rule 1): with 5 families, every family has exactly 2 adjacent and 2
 * non-adjacent, which is precisely what makes the 40% / 2×20% / 2×10% = 100%
 * weighting balance.
 */
export const FAMILY_RING: readonly MutationFamily[] = [
  'abyssal',
  'mycelial',
  'lithic',
  'voidborn',
  'thermal',
];
