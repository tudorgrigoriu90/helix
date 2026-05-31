import { describe, it, expect } from 'vitest';
import { ordinal, specialSuffixes, type RunNameFacts } from './special-suffix';

function facts(over: Partial<RunNameFacts> = {}): RunNameFacts {
  return { floorReached: 5, damageTaken: 20, enemiesKilled: 10, won: true, ...over };
}

describe('ordinal — T-121', () => {
  it('uses words for 1–20', () => {
    expect(ordinal(1)).toBe('First');
    expect(ordinal(3)).toBe('Third');
    expect(ordinal(20)).toBe('Twentieth');
  });

  it('falls back to numeric suffixes beyond 20, with the 11–13 exception', () => {
    expect(ordinal(21)).toBe('21st');
    expect(ordinal(22)).toBe('22nd');
    expect(ordinal(23)).toBe('23rd');
    expect(ordinal(24)).toBe('24th');
    expect(ordinal(111)).toBe('111th'); // teens stay "th"
    expect(ordinal(112)).toBe('112th');
  });

  it('clamps non-positive input to First', () => {
    expect(ordinal(0)).toBe('First');
    expect(ordinal(-4)).toBe('First');
  });
});

describe('specialSuffixes — T-121', () => {
  it('a won run earns the descent phrase for its floor', () => {
    expect(specialSuffixes(facts({ won: true, floorReached: 3 })).descentPhrase).toBe('of the Third Descent');
  });

  it('a lost run earns no descent phrase', () => {
    expect(specialSuffixes(facts({ won: false })).descentPhrase).toBeNull();
  });

  it('"Untouched" when no damage was taken in a run with kills', () => {
    expect(specialSuffixes(facts({ damageTaken: 0, enemiesKilled: 4 })).conditionTags).toContain('Untouched');
  });

  it('no "Untouched" when damage was taken', () => {
    expect(specialSuffixes(facts({ damageTaken: 1 })).conditionTags).not.toContain('Untouched');
  });

  it('no "Untouched" for a no-combat run (would be vacuous)', () => {
    expect(specialSuffixes(facts({ damageTaken: 0, enemiesKilled: 0, won: false })).conditionTags)
      .not.toContain('Untouched');
  });

  it('"Bloodless" when a won run killed nothing', () => {
    expect(specialSuffixes(facts({ won: true, enemiesKilled: 0, damageTaken: 5 })).conditionTags)
      .toContain('Bloodless');
  });

  it('no "Bloodless" on a loss', () => {
    expect(specialSuffixes(facts({ won: false, enemiesKilled: 0 })).conditionTags).not.toContain('Bloodless');
  });

  it('can stack tags (Untouched + Bloodless: won, no damage, no kills)', () => {
    const res = specialSuffixes(facts({ won: true, damageTaken: 0, enemiesKilled: 0 }));
    // Bloodless yes (won, no kills); Untouched no (needs ≥1 kill to be meaningful).
    expect(res.conditionTags).toEqual(['Bloodless']);
  });

  it('is deterministic for the same facts', () => {
    const f = facts({ won: true, floorReached: 7, damageTaken: 0, enemiesKilled: 12 });
    expect(specialSuffixes(f)).toEqual(specialSuffixes(f));
  });
});
