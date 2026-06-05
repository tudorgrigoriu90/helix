import { describe, it, expect } from 'vitest';
import type { MutationFamily, MutationTier } from '@shared-types/mutation';
import {
  FAMILY_LOOK, TIER_LOOK,
  showStrandConfirmHint, STRAND_CONFIRM_GRACE_RUNS,
  familyCountIn,
} from './strand-event';

const FAMILIES: MutationFamily[] = ['abyssal', 'mycelial', 'lithic', 'voidborn', 'thermal'];
const TIERS: MutationTier[] = ['minor', 'major', 'dominant'];

// ── FAMILY_LOOK ───────────────────────────────────────────────────────────────

describe('FAMILY_LOOK — T-182/T-184', () => {
  it('defines a look for every family', () => {
    for (const f of FAMILIES) {
      const look = FAMILY_LOOK[f];
      expect(look).toBeDefined();
      expect(typeof look.bgHex).toBe('number');
      expect(typeof look.accentHex).toBe('number');
      expect(look.accentLabel).toMatch(/^#/);
      expect(look.lore.length).toBeGreaterThan(0);
    }
  });

  it('all accent colours are distinct (no two families share an accent)', () => {
    const accents = FAMILIES.map((f) => FAMILY_LOOK[f].accentHex);
    expect(new Set(accents).size).toBe(FAMILIES.length);
  });

  it('background and accent are different (bg is darker visually)', () => {
    for (const f of FAMILIES) {
      expect(FAMILY_LOOK[f].bgHex).not.toBe(FAMILY_LOOK[f].accentHex);
    }
  });
});

// ── TIER_LOOK ─────────────────────────────────────────────────────────────────

describe('TIER_LOOK — T-182', () => {
  it('defines a look for every tier', () => {
    for (const t of TIERS) {
      const look = TIER_LOOK[t];
      expect(look).toBeDefined();
      expect(typeof look.hex).toBe('number');
      expect(look.label).toMatch(/^#/);
      expect(look.badge.length).toBeGreaterThan(0);
    }
  });

  it('all tier badges are distinct', () => {
    const badges = TIERS.map((t) => TIER_LOOK[t].badge);
    expect(new Set(badges).size).toBe(TIERS.length);
  });

  it('dominant badge is visually distinct from minor (different hex)', () => {
    expect(TIER_LOOK['dominant'].hex).not.toBe(TIER_LOOK['minor'].hex);
  });
});

// ── showStrandConfirmHint ─────────────────────────────────────────────────────

describe('showStrandConfirmHint — T-185', () => {
  it('shows hint for new players (0 runs)', () => {
    expect(showStrandConfirmHint(0)).toBe(true);
  });

  it('shows hint below the grace threshold', () => {
    expect(showStrandConfirmHint(STRAND_CONFIRM_GRACE_RUNS - 1)).toBe(true);
  });

  it('hides hint once threshold is reached', () => {
    expect(showStrandConfirmHint(STRAND_CONFIRM_GRACE_RUNS)).toBe(false);
    expect(showStrandConfirmHint(100)).toBe(false);
  });
});

// ── familyCountIn ─────────────────────────────────────────────────────────────

describe('familyCountIn — T-184', () => {
  it('returns 0 for empty family list', () => {
    expect(familyCountIn('abyssal', [])).toBe(0);
  });

  it('counts only the target family', () => {
    const families: MutationFamily[] = ['abyssal', 'mycelial', 'abyssal', 'thermal'];
    expect(familyCountIn('abyssal', families)).toBe(2);
    expect(familyCountIn('mycelial', families)).toBe(1);
    expect(familyCountIn('lithic', families)).toBe(0);
  });

  it('counts all five families independently when mixed', () => {
    const mixed: MutationFamily[] = ['abyssal', 'mycelial', 'lithic', 'voidborn', 'thermal', 'abyssal'];
    for (const f of FAMILIES) {
      const expected = mixed.filter((x) => x === f).length;
      expect(familyCountIn(f, mixed)).toBe(expected);
    }
  });
});
