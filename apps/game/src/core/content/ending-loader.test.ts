import { describe, it, expect } from 'vitest';
import type { EndingDef } from '@shared-types/ending';
import { parseEndingDef, pickEnding, endingFamilyForRun } from './ending-loader';

/** T-309 — ending loader + Convergence selection (GDD §2.8). */

function valid(): Record<string, unknown> {
  return {
    schemaVersion: 1,
    id: 'ending_abyssal',
    family: 'abyssal',
    title: 'The Ocean Remembers',
    lines: ['One.', 'Two.', 'Three.'],
  };
}

describe('parseEndingDef — T-309', () => {
  it('parses a valid ending', () => {
    const res = parseEndingDef(valid());
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.ending.family).toBe('abyssal');
      expect(res.ending.lines).toHaveLength(3);
    }
  });

  it('rejects bad families, empty/missing/over-long lines, and bad versions', () => {
    expect(parseEndingDef({ ...valid(), family: 'cosmic' }).ok).toBe(false);
    expect(parseEndingDef({ ...valid(), lines: [] }).ok).toBe(false);
    expect(parseEndingDef({ ...valid(), lines: ['One.', ''] }).ok).toBe(false);
    expect(parseEndingDef({ ...valid(), lines: Array.from({ length: 13 }, () => 'x.') }).ok).toBe(false);
    expect(parseEndingDef({ ...valid(), schemaVersion: 9 }).ok).toBe(false);
    const noTitle = valid();
    delete noTitle['title'];
    expect(parseEndingDef(noTitle).ok).toBe(false);
  });
});

describe('endingFamilyForRun / pickEnding — T-309', () => {
  const ENDINGS: EndingDef[] = (['abyssal', 'mycelial', 'lithic', 'voidborn', 'thermal'] as const).map(
    (family) => ({ schemaVersion: 1, id: `ending_${family}`, family, title: family, lines: ['a.', 'b.', 'c.'] }),
  );

  it('the first Dominant Trait wins outright', () => {
    expect(endingFamilyForRun(['thermal', 'lithic'], ['abyssal', 'abyssal'])).toBe('thermal');
  });

  it('without a trait, the most-stacked family wins; FAMILY_RING breaks ties', () => {
    expect(endingFamilyForRun([], ['lithic', 'mycelial', 'lithic'])).toBe('lithic');
    // 1–1 tie: abyssal precedes voidborn in the ring.
    expect(endingFamilyForRun([], ['voidborn', 'abyssal'])).toBe('abyssal');
  });

  it('a mutationless victory falls back to the abyssal reading', () => {
    expect(endingFamilyForRun([], [])).toBe('abyssal');
    expect(pickEnding(ENDINGS, [], [])?.id).toBe('ending_abyssal');
  });

  it('pickEnding resolves the def; degrades to first / null on thin content', () => {
    expect(pickEnding(ENDINGS, ['voidborn'], [])?.id).toBe('ending_voidborn');
    expect(pickEnding([ENDINGS[1]!], ['thermal'], [])?.id).toBe('ending_mycelial'); // missing family → first
    expect(pickEnding([], ['thermal'], [])).toBeNull();
  });
});
