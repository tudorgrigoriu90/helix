import { describe, it, expect } from 'vitest';
import type { MutationFamily } from '@shared-types/mutation';
import { nameHash, generateOrganismName, type NameTables, type OrganismNameInput } from './name-gen';
import { NAME_TABLE_FAMILIES, type TraitTable } from './name-tables';
import type { RunNameFacts } from './special-suffix';

function tables(): NameTables {
  const traits = {} as { [K in MutationFamily]: readonly string[] };
  for (const f of NAME_TABLE_FAMILIES) traits[f] = [`${f}A`, `${f}B`, `${f}C`];
  return {
    prefixes: ['The', 'Pale', 'Deep'],
    traits: traits as TraitTable,
    suffixes: ['Sovereign', 'Warden', 'Saint'],
  };
}

function input(over: Partial<OrganismNameInput> = {}): OrganismNameInput {
  return {
    runSeed: 0xc0ffee,
    buildSignature: 'm_ab1,m_my1',
    family: 'mycelial',
    facts: { floorReached: 5, damageTaken: 20, enemiesKilled: 10, won: false },
    tables: tables(),
    ...over,
  };
}

describe('nameHash — T-122', () => {
  it('is deterministic', () => {
    expect(nameHash(123, 'abc')).toBe(nameHash(123, 'abc'));
  });

  it('depends on both the seed and the signature', () => {
    expect(nameHash(123, 'abc')).not.toBe(nameHash(124, 'abc'));
    expect(nameHash(123, 'abc')).not.toBe(nameHash(123, 'abd'));
  });

  it('returns an unsigned 32-bit integer', () => {
    const h = nameHash(0xffffffff, 'long-signature-string');
    expect(Number.isInteger(h)).toBe(true);
    expect(h).toBeGreaterThanOrEqual(0);
    expect(h).toBeLessThanOrEqual(0xffffffff);
  });
});

describe('generateOrganismName — T-122', () => {
  it('is deterministic for the same input', () => {
    expect(generateOrganismName(input())).toBe(generateOrganismName(input()));
  });

  it('produces a {prefix} {trait} {suffix} structure from the pools', () => {
    const t = tables();
    const name = generateOrganismName(input({ tables: t }));
    const [prefix, trait, suffix] = name.split(' ');
    expect(t.prefixes).toContain(prefix);
    expect(t.traits.mycelial).toContain(trait);
    expect(t.suffixes).toContain(suffix);
  });

  it('draws the trait from the dominant family pool', () => {
    const name = generateOrganismName(input({ family: 'thermal' }));
    const trait = name.split(' ')[1]!;
    expect(trait.startsWith('thermal')).toBe(true);
  });

  it('a different build signature can change the name', () => {
    const a = generateOrganismName(input({ buildSignature: 'm_ab1' }));
    const b = generateOrganismName(input({ buildSignature: 'm_th1,m_th2,m_th3' }));
    // Not strictly guaranteed to differ, but with these signatures it does.
    expect(a).not.toBe(b);
  });

  it('appends the descent phrase for a won run', () => {
    const facts: RunNameFacts = { floorReached: 3, damageTaken: 5, enemiesKilled: 2, won: true };
    expect(generateOrganismName(input({ facts }))).toMatch(/ of the Third Descent$/);
  });

  it('comma-appends condition tags (Untouched)', () => {
    const facts: RunNameFacts = { floorReached: 2, damageTaken: 0, enemiesKilled: 4, won: false };
    expect(generateOrganismName(input({ facts }))).toMatch(/, Untouched$/);
  });

  it('stacks descent phrase then tags in order (won, no damage, with kills)', () => {
    const facts: RunNameFacts = { floorReached: 4, damageTaken: 0, enemiesKilled: 6, won: true };
    expect(generateOrganismName(input({ facts }))).toMatch(/ of the Fourth Descent, Untouched$/);
  });

  it('throws on a structurally empty pool', () => {
    const bad = { ...tables(), prefixes: [] as readonly string[] };
    expect(() => generateOrganismName(input({ tables: bad }))).toThrow(/empty pool/);
  });

  it('works for every family', () => {
    for (const family of NAME_TABLE_FAMILIES) {
      expect(generateOrganismName(input({ family })).length).toBeGreaterThan(0);
    }
  });
});
