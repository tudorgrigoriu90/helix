import type { MutationDef, MutationFamily } from '@shared-types/mutation';
import { FAMILY_RING } from '@shared-types/mutation';

/**
 * Hybrid Synergy detection — T-92 (GDD §5.6).
 *
 * Owning at least one mutation in *each* of two families unlocks that pair's
 * passive Hybrid Synergy. With five families there are exactly C(5,2) = 10
 * cross-family pairs, and GDD §5.6 states there are 10 synergies — one per pair.
 * Five are named in §5.6; the other five (the "Appendix A" set, which isn't in
 * the GDD markdown we hold) are authored here to theme, and flagged so a writer
 * pass can revise them. Synergies are "discovered through play" — this module
 * detects which are active; surfacing/first-trigger reveal is a UI concern.
 *
 * Detection + catalog only — wiring each synergy's combat effect is part of the
 * combat integration; the descriptions are the authoritative spec for it.
 */

/** A pair of distinct families, stored in `FAMILY_RING` order (canonical). */
export type FamilyPair = readonly [MutationFamily, MutationFamily];

export interface HybridSynergy {
  readonly id: string;
  readonly name: string;
  /** The two families, in ring order. */
  readonly families: FamilyPair;
  /** GDD §5.6 effect text — authoritative spec for the (future) combat wiring. */
  readonly description: string;
  /** True for the five §5.6-named synergies; false for the authored Appendix-A set. */
  readonly canon: boolean;
}

const ringIndex = (f: MutationFamily): number => FAMILY_RING.indexOf(f);

/** Canonicalises a family pair to ring order so lookups are order-independent. */
function orderPair(a: MutationFamily, b: MutationFamily): FamilyPair {
  return ringIndex(a) <= ringIndex(b) ? [a, b] : [b, a];
}

/** The ten Hybrid Synergies, one per cross-family pair (GDD §5.6 + Appendix A). */
export const HYBRID_SYNERGIES: readonly HybridSynergy[] = [
  {
    id: 'bioluminescent_bloom',
    name: 'Bioluminescent Bloom',
    families: ['abyssal', 'mycelial'],
    description: 'Spore abilities deal bonus damage to pressurized enemies.',
    canon: true,
  },
  {
    id: 'pressure_crystal',
    name: 'Pressure Crystal',
    families: ['abyssal', 'lithic'],
    description: 'Crystal fragmentation triggers a pressure wave (AoE).',
    canon: true,
  },
  {
    id: 'crushing_void',
    name: 'Crushing Void',
    families: ['abyssal', 'voidborn'],
    description: 'Pressurized enemies take bonus void damage; drain attacks also Crush.',
    canon: false,
  },
  {
    id: 'hydrothermal_vent',
    name: 'Hydrothermal Vent',
    families: ['abyssal', 'thermal'],
    description: 'Pressure abilities also apply Burn; thermal damage ignores RES on crushed targets.',
    canon: false,
  },
  {
    id: 'petrified_grove',
    name: 'Petrified Grove',
    families: ['mycelial', 'lithic'],
    description: 'Rooted enemies also become Fractured; spore tiles harden into cover.',
    canon: false,
  },
  {
    id: 'spore_phase',
    name: 'Spore Phase',
    families: ['mycelial', 'voidborn'],
    description: 'Phasing seeds spores on the exit tile; Infected enemies lose sight of you.',
    canon: false,
  },
  {
    id: 'fever_spores',
    name: 'Fever Spores',
    families: ['mycelial', 'thermal'],
    description: 'Spore clouds deal fire damage instead of poison.',
    canon: true,
  },
  {
    id: 'void_shard',
    name: 'Void Shard',
    families: ['lithic', 'voidborn'],
    description: 'Phase abilities leave crystal shards on the exit tile.',
    canon: true,
  },
  {
    id: 'magma_forge',
    name: 'Magma Forge',
    families: ['lithic', 'thermal'],
    description: 'Fractured enemies take bonus thermal damage; crystal abilities apply Burn.',
    canon: false,
  },
  {
    id: 'dark_combustion',
    name: 'Dark Combustion',
    families: ['voidborn', 'thermal'],
    description: 'Stealth breaks deal a guaranteed Burn status.',
    canon: true,
  },
];

/** The set of distinct families the player owns at least one mutation in. */
function ownedFamilies(owned: readonly MutationDef[]): Set<MutationFamily> {
  return new Set(owned.map((m) => m.family));
}

/** The Hybrid Synergies active for `owned` (≥1 mutation in both families), in catalog order. */
export function unlockedSynergies(owned: readonly MutationDef[]): readonly HybridSynergy[] {
  const families = ownedFamilies(owned);
  return HYBRID_SYNERGIES.filter((s) => families.has(s.families[0]) && families.has(s.families[1]));
}

/** The synergy for a family pair (order-independent), or undefined if a === b. */
export function synergyFor(a: MutationFamily, b: MutationFamily): HybridSynergy | undefined {
  if (a === b) return undefined;
  const [x, y] = orderPair(a, b);
  return HYBRID_SYNERGIES.find((s) => s.families[0] === x && s.families[1] === y);
}
