import { describe, it, expect } from 'vitest';
import type { RoomType } from '@shared-types/floor-template';
import { roomGlyph } from './room-glyph';

const ALL: RoomType[] = ['combat', 'loot', 'safe', 'merchant', 'trap', 'lace_event', 'boss'];

describe('roomGlyph — T-156', () => {
  it('returns a non-empty glyph for every room type', () => {
    for (const t of ALL) {
      expect(roomGlyph(t).length).toBeGreaterThan(0);
    }
  });

  it('assigns a unique shape to every room type (no colour-only encoding)', () => {
    const glyphs = ALL.map(roomGlyph);
    expect(new Set(glyphs).size).toBe(ALL.length);
  });

  it('is stable for a given type', () => {
    expect(roomGlyph('boss')).toBe(roomGlyph('boss'));
    expect(roomGlyph('safe')).toBe('✚');
  });
});
