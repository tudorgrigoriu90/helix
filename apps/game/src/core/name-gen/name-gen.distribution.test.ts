import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { MutationFamily } from '@shared-types/mutation';
import { parsePrefixTable, parseTraitTable, parseSuffixTable, NAME_TABLE_FAMILIES } from './name-tables';
import { generateOrganismName, type NameTables } from './name-gen';
import type { RunNameFacts } from './special-suffix';

/**
 * T-123 — organism-name distribution gate (TDD §16.1).
 *
 * The spec asks for "1000 random seeds → 1000 names; no collisions in a family
 * pool of 4,000". A *literal* "1000 distinct names from random sampling of a
 * 4,000-name pool" is impossible — the birthday paradox guarantees ~100
 * collisions — so this gate verifies the defensible, meaningful guarantees:
 *   1. the per-family distinct-name *space* is ≥ 4,000 (the "pool of 4,000");
 *   2. the generator is deterministic;
 *   3. 1000 random seeds all produce valid, well-formed names;
 *   4. uniqueness across those 1000 is strong — consistent with sampling a
 *      ≥4,000 space (we assert a sound lower bound, not an impossible 1000).
 */

const NAMES_DIR = fileURLToPath(
  new URL('../../../../../packages/content/organism-names/', import.meta.url),
);
const loadJson = (file: string): unknown => JSON.parse(readFileSync(`${NAMES_DIR}${file}`, 'utf8'));

function loadTables(): NameTables {
  const prefixes = parsePrefixTable(loadJson('prefixes.json'));
  const traits = parseTraitTable(loadJson('traits.json'));
  const suffixes = parseSuffixTable(loadJson('suffixes.json'));
  if (!prefixes.ok || !traits.ok || !suffixes.ok) throw new Error('T-123: shipped name tables failed to load');
  return { prefixes: prefixes.prefixes, traits: traits.traits, suffixes: suffixes.suffixes };
}

const TABLES = loadTables();

/** Neutral facts → no special suffixes, so names are pure {prefix}{trait}{suffix}
 *  and uniqueness measures the core pool exactly. */
const NEUTRAL: RunNameFacts = { floorReached: 5, damageTaken: 10, enemiesKilled: 10, won: false };

describe('organism-name distribution — T-123', () => {
  it('each family offers a distinct-name space of at least 4,000', () => {
    for (const family of NAME_TABLE_FAMILIES) {
      const space = TABLES.prefixes.length * TABLES.traits[family].length * TABLES.suffixes.length;
      expect(space, family).toBeGreaterThanOrEqual(4000);
    }
  });

  it('is deterministic: the same seed + build + family yields the same name', () => {
    for (let seed = 0; seed < 50; seed++) {
      const a = generateOrganismName({ runSeed: seed, buildSignature: 'sig', family: 'lithic', facts: NEUTRAL, tables: TABLES });
      const b = generateOrganismName({ runSeed: seed, buildSignature: 'sig', family: 'lithic', facts: NEUTRAL, tables: TABLES });
      expect(b).toBe(a);
    }
  });

  it('1000 random seeds all produce valid, well-formed names', () => {
    for (let seed = 0; seed < 1000; seed++) {
      const family = NAME_TABLE_FAMILIES[seed % NAME_TABLE_FAMILIES.length]!;
      const name = generateOrganismName({ runSeed: seed * 2654435761, buildSignature: `build-${seed}`, family, facts: NEUTRAL, tables: TABLES });
      expect(name.length).toBeGreaterThan(0);
      // {prefix} {trait} {suffix} → at least 3 space-separated tokens.
      expect(name.split(' ').length).toBeGreaterThanOrEqual(3);
    }
  });

  it('1000 seeds in one family yield strong uniqueness (≥85% of the birthday bound)', () => {
    const family: MutationFamily = 'voidborn';
    const space = TABLES.prefixes.length * TABLES.traits[family].length * TABLES.suffixes.length;
    const n = 1000;
    const names = new Set<string>();
    for (let seed = 0; seed < n; seed++) {
      names.add(generateOrganismName({ runSeed: seed, buildSignature: `b${seed}`, family, facts: NEUTRAL, tables: TABLES }));
    }
    // Expected distinct ≈ space·(1−(1−1/space)^n) for uniform sampling. Assert we
    // reach ≥85% of that — a real distribution check that catches a biased hash
    // or a too-small pool without flaking (the generator is deterministic).
    const expectedUnique = space * (1 - Math.pow(1 - 1 / space, n));
    expect(names.size).toBeGreaterThanOrEqual(Math.floor(expectedUnique * 0.85));
  });

  it('uses the full prefix/trait/suffix vocabulary across many seeds', () => {
    const family: MutationFamily = 'thermal';
    const prefixes = new Set<string>();
    const suffixes = new Set<string>();
    const traits = new Set<string>();
    for (let seed = 0; seed < 4000; seed++) {
      const name = generateOrganismName({ runSeed: seed, buildSignature: `b${seed}`, family, facts: NEUTRAL, tables: TABLES });
      const [p, t, s] = name.split(' ');
      prefixes.add(p!); traits.add(t!); suffixes.add(s!);
    }
    // Every entry in each pool should appear at least once given enough seeds.
    expect(prefixes.size).toBe(TABLES.prefixes.length);
    expect(traits.size).toBe(TABLES.traits[family].length);
    expect(suffixes.size).toBe(TABLES.suffixes.length);
  });
});
