import type { MutationDef, MutationFamily } from '@shared-types/mutation';
import { FAMILY_RING } from '@shared-types/mutation';

/**
 * Dominant Trait detection — T-91 (GDD §5.5).
 *
 * Owning **three mutations of the same family** unlocks that family's Dominant
 * Trait — a powerful run-long passive (one per family, GDD §5.5 table). This
 * module is the *detection* + catalog: given the owned mutations it reports
 * which traits are active. Wiring each trait's combat effect (lifesteal, minimap
 * reveal, per-floor untargetability, +AP/turn, …) into the turn engine is a
 * separate, larger integration tracked with the combat work — the descriptions
 * here are the authoritative spec for it.
 */

export interface DominantTrait {
  readonly family: MutationFamily;
  readonly id: string;
  readonly name: string;
  /** GDD §5.5 effect text — authoritative spec for the (future) combat wiring. */
  readonly description: string;
}

/** Mutations of one family required to unlock its Dominant Trait. */
export const DOMINANT_TRAIT_THRESHOLD = 3;

/** The five Dominant Traits, one per family (GDD §5.5). */
export const DOMINANT_TRAITS: Readonly<Record<MutationFamily, DominantTrait>> = {
  abyssal: {
    family: 'abyssal',
    id: 'leviathan_core',
    name: 'Leviathan Core',
    description: '+30 max HP; all Abyssal abilities gain a 20% lifesteal component.',
  },
  mycelial: {
    family: 'mycelial',
    id: 'hive_awareness',
    name: 'Hive Awareness',
    description: 'All enemies visible on the minimap; spore abilities spread 1 extra tile.',
  },
  lithic: {
    family: 'lithic',
    id: 'fortress_form',
    name: 'Fortress Form',
    description: '+10 RES permanently; crystal abilities cost 1 less AP.',
  },
  voidborn: {
    family: 'voidborn',
    id: 'phase_collapse',
    name: 'Phase Collapse',
    description: 'Once per floor, become untargetable for 2 turns; drain attacks return double HP.',
  },
  thermal: {
    family: 'thermal',
    id: 'combustion_engine',
    name: 'Combustion Engine',
    description: '+2 AP per turn; all attacks add a burn status (5 dmg/turn).',
  },
};

/** Per-family owned counts, every family present (0 when unowned). */
function familyCounts(owned: readonly MutationDef[]): Map<MutationFamily, number> {
  const counts = new Map<MutationFamily, number>(FAMILY_RING.map((f) => [f, 0]));
  for (const m of owned) counts.set(m.family, (counts.get(m.family) ?? 0) + 1);
  return counts;
}

/** The Dominant Traits unlocked by `owned` (3+ of a family), in ring order. */
export function unlockedDominantTraits(owned: readonly MutationDef[]): readonly DominantTrait[] {
  const counts = familyCounts(owned);
  return FAMILY_RING.filter((f) => (counts.get(f) ?? 0) >= DOMINANT_TRAIT_THRESHOLD).map(
    (f) => DOMINANT_TRAITS[f],
  );
}

/** The Dominant Trait for one family (always defined — every family has one). */
export function dominantTraitFor(family: MutationFamily): DominantTrait {
  return DOMINANT_TRAITS[family];
}
