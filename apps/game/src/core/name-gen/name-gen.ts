import type { MutationFamily } from '@shared-types/mutation';
import { Mulberry32 } from '../rng/mulberry32';
import type { TraitTable } from './name-tables';
import { specialSuffixes, type RunNameFacts } from './special-suffix';

/**
 * Organism name assembly — T-122 (UFD Share Flow, GDD §12.8, NFR P2).
 *
 * Produces the memorable, *deterministic* organism name shown on the "What You
 * Became" screen. The name is `{prefix} {trait} {suffix}` drawn from the content
 * tables (T-118/119/120) by a PRNG seeded from {@link nameHash} — so the same
 * run seed + final build always yields the same name (NFR P2 determinism) — with
 * any earned special-condition adornments (T-121) appended.
 *
 * The trait pool is selected by the run's dominant mutation family, so the name
 * reflects what the player became.
 */

/** The three content pools the assembler draws from. */
export interface NameTables {
  readonly prefixes: readonly string[];
  readonly traits: TraitTable;
  readonly suffixes: readonly string[];
}

export interface OrganismNameInput {
  /** The run's master seed (NFR P2 — the same seed replays the same run). */
  readonly runSeed: number;
  /**
   * A stable signature of the *final build* (e.g. the run's mutation ids, sorted
   * and joined). Folding this in means two runs on the same seed that diverged
   * into different builds still get distinct names.
   */
  readonly buildSignature: string;
  /** Dominant mutation family — selects the trait pool. */
  readonly family: MutationFamily;
  /** Run facts that drive the special-condition suffixes (T-121). */
  readonly facts: RunNameFacts;
  /** The loaded content pools. */
  readonly tables: NameTables;
}

/**
 * Deterministic 32-bit hash of `runSeed` + `buildSignature`. djb2 over the
 * signature string, folded with the seed. Pure; stable across runs/builds.
 */
export function nameHash(runSeed: number, buildSignature: string): number {
  let h = 5381;
  for (let i = 0; i < buildSignature.length; i++) {
    h = (Math.imul(h, 33) ^ buildSignature.charCodeAt(i)) >>> 0;
  }
  return (h ^ (runSeed >>> 0)) >>> 0;
}

function pick<T>(rng: Mulberry32, pool: readonly T[]): T {
  return pool[rng.nextInt(pool.length)]!;
}

/**
 * Assembles the organism name. Deterministic for a given input. Throws only on
 * structurally invalid tables (empty pool / missing family) — callers load the
 * tables through the validated loaders, so this is a guard, not a runtime path.
 */
export function generateOrganismName(input: OrganismNameInput): string {
  const traitPool = input.tables.traits[input.family];
  if (input.tables.prefixes.length === 0 || input.tables.suffixes.length === 0 || traitPool === undefined || traitPool.length === 0) {
    throw new Error(`generateOrganismName: empty pool for family "${input.family}"`);
  }

  const rng = new Mulberry32(nameHash(input.runSeed, input.buildSignature));
  // Draw order is fixed (prefix, trait, suffix) so names stay stable if pools grow.
  const prefix = pick(rng, input.tables.prefixes);
  const trait = pick(rng, traitPool);
  const suffix = pick(rng, input.tables.suffixes);

  const special = specialSuffixes(input.facts);
  let name = `${prefix} ${trait} ${suffix}`;
  if (special.descentPhrase !== null) name += ` ${special.descentPhrase}`;
  for (const tag of special.conditionTags) name += `, ${tag}`;
  return name;
}
