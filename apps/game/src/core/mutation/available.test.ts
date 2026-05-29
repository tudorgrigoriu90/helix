import { describe, it, expect } from 'vitest';
import { availableMutations } from './available';
import { makeMutation } from './test-fixtures';

describe('no-duplicates filter — T-87 (GDD §5.4 Rule 4)', () => {
  const pool = [
    makeMutation({ id: 'a' }),
    makeMutation({ id: 'b' }),
    makeMutation({ id: 'c' }),
    makeMutation({ id: 'd' }),
  ];

  it('returns the whole pool when nothing is excluded', () => {
    expect(availableMutations(pool, new Set()).map((m) => m.id)).toEqual(['a', 'b', 'c', 'd']);
  });

  it('excludes owned/drawn ids', () => {
    const out = availableMutations(pool, new Set(['b', 'd']));
    expect(out.map((m) => m.id)).toEqual(['a', 'c']);
  });

  it('returns empty when every id is excluded', () => {
    expect(availableMutations(pool, new Set(['a', 'b', 'c', 'd']))).toHaveLength(0);
  });

  it('preserves pool order', () => {
    const out = availableMutations(pool, new Set(['a']));
    expect(out.map((m) => m.id)).toEqual(['b', 'c', 'd']);
  });

  it('de-duplicates a pool that contains the same id twice', () => {
    const dupes = [makeMutation({ id: 'x' }), makeMutation({ id: 'x' }), makeMutation({ id: 'y' })];
    const out = availableMutations(dupes, new Set());
    expect(out.map((m) => m.id)).toEqual(['x', 'y']);
  });

  it('ignores exclude ids that are not in the pool', () => {
    const out = availableMutations(pool, new Set(['ghost']));
    expect(out).toHaveLength(4);
  });
});
