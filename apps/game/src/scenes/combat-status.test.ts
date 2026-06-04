import { describe, it, expect } from 'vitest';
import type { ActiveStatus, StatusEffect } from '@shared-types/run-state';
import { statusBadges, statusGlyph, statusHex } from './combat-status';

const ALL: StatusEffect[] = [
  'burn', 'infected', 'stagger', 'suppressed', 'fractured',
  'crushed', 'rooted', 'phased', 'regenerating', 'overheated',
];

describe('statusGlyph / statusHex — T-172', () => {
  it('assigns a unique glyph to every status', () => {
    const glyphs = ALL.map(statusGlyph);
    expect(new Set(glyphs).size).toBe(ALL.length);
  });

  it('returns a defined hex colour for every status', () => {
    for (const s of ALL) {
      expect(typeof statusHex(s)).toBe('number');
      expect(statusHex(s)).toBeGreaterThanOrEqual(0);
    }
  });
});

describe('statusBadges — T-172', () => {
  const st = (effect: StatusEffect, turnsRemaining: number): ActiveStatus => ({ effect, turnsRemaining });

  it('returns one badge per active status, in order', () => {
    const badges = statusBadges([st('burn', 3), st('infected', 2)]);
    expect(badges.map((b) => b.glyph)).toEqual(['B', 'I']);
    expect(badges.map((b) => b.turns)).toEqual([3, 2]);
  });

  it('formats the colour as a 6-digit hex string', () => {
    const [badge] = statusBadges([st('burn', 1)]);
    expect(badge?.color).toMatch(/^#[0-9a-f]{6}$/);
    expect(badge?.color).toBe('#ff6600');
  });

  it('drops statuses whose timer has run out', () => {
    expect(statusBadges([st('burn', 0), st('rooted', -1)])).toEqual([]);
  });

  it('returns an empty list for no statuses', () => {
    expect(statusBadges([])).toEqual([]);
  });

  it('carries the matching hex through to the badge', () => {
    const [badge] = statusBadges([st('regenerating', 2)]);
    expect(badge?.hex).toBe(statusHex('regenerating'));
  });
});
