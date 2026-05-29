import type { MutationDef, MutationFamily, MutationModifier, MutationTier } from '@shared-types/mutation';
import { FAMILY_RING } from '@shared-types/mutation';
import type { EntityStats } from '@shared-types/run-state';

/**
 * Shared mutation test fixtures. A tiny builder so each test can spin up a pool
 * with known families/tiers without hand-writing full {@link MutationDef}s.
 */

let seq = 0;

export function makeMutation(overrides: Partial<MutationDef> = {}): MutationDef {
  const id = overrides.id ?? `mut_${seq++}`;
  return {
    id,
    family: overrides.family ?? 'abyssal',
    tier: overrides.tier ?? 'minor',
    name: overrides.name ?? id,
    sigBonus: overrides.sigBonus ?? 10,
    modifiers: overrides.modifiers ?? [],
    grantsAbility: overrides.grantsAbility ?? null,
    lace: overrides.lace ?? 'LACE says something.',
    tags: overrides.tags ?? [],
  };
}

/** A pool with `perFamily` minor mutations in every family (5 × perFamily total). */
export function makePool(perFamily = 4, tier: MutationTier = 'minor'): MutationDef[] {
  const out: MutationDef[] = [];
  for (const family of FAMILY_RING) {
    for (let i = 0; i < perFamily; i++) {
      out.push(makeMutation({ id: `${family}_${tier}_${i}`, family, tier }));
    }
  }
  return out;
}

export function statMod(stat: keyof EntityStats, delta: number): MutationModifier {
  return { kind: 'stat', stat, delta };
}

export const FAMILIES: readonly MutationFamily[] = FAMILY_RING;
