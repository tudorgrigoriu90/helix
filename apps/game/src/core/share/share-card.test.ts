import { describe, it, expect } from 'vitest';
import { shareCardSpec, verdictLine, SHARE_FORMATS, FAMILY_ACCENT, type ShareCardData } from './share-card';

const run: ShareCardData = {
  organismName: 'The Crystalline Threshold Walker',
  won: false,
  floorReached: 13,
  finalFloor: 20,
  mutations: ['Crystal Lattice', 'Seismic Slam', 'Phase Skin'],
  dominantTraits: ['lithic'],
  enemiesKilled: 84,
};

describe('share card spec — T-531 (DR-011)', () => {
  it('exports at exactly the DR-011 formats: 1080×1920 story, 1080×1080 square', () => {
    expect(SHARE_FORMATS.story).toEqual({ w: 1080, h: 1920 });
    expect(SHARE_FORMATS.square).toEqual({ w: 1080, h: 1080 });
    expect(shareCardSpec(run, 'story')).toMatchObject({ width: 1080, height: 1920 });
    expect(shareCardSpec(run, 'square')).toMatchObject({ width: 1080, height: 1080 });
  });

  it('shows the identity payload: name, verdict, mutations, wordmark', () => {
    const texts = shareCardSpec(run, 'story').texts.map((t) => t.text);
    expect(texts).toContain('WHAT YOU BECAME');
    expect(texts).toContain('THE CRYSTALLINE THRESHOLD WALKER');
    expect(texts).toContain('THE STRAND SEVERED — FLOOR 13 OF 20');
    expect(texts).toContain('Crystal Lattice');
    expect(texts).toContain('STRAND DESCENT');
  });

  it('never says "you died" — the verdict uses the LACE-sanctioned phrasing', () => {
    expect(verdictLine(run).toLowerCase()).not.toContain('you died');
    expect(verdictLine({ ...run, won: true })).toBe('REACHED THE CONVERGENCE');
  });

  it('accents with the dominant family colour and chips every dominant trait', () => {
    const spec = shareCardSpec({ ...run, dominantTraits: ['lithic', 'thermal'] }, 'square');
    expect(spec.accent).toBe(FAMILY_ACCENT.lithic);
    expect(spec.chips).toHaveLength(2);
    expect(spec.chips[1]!.color).toBe(FAMILY_ACCENT.thermal);
  });

  it('every text block sits inside the card bounds in both formats', () => {
    for (const format of ['story', 'square'] as const) {
      const spec = shareCardSpec(run, format);
      for (const t of spec.texts) {
        expect(t.x, `${format} "${t.text}" x`).toBeGreaterThanOrEqual(0);
        expect(t.x, `${format} "${t.text}" x`).toBeLessThanOrEqual(spec.width);
        expect(t.y, `${format} "${t.text}" y`).toBeGreaterThanOrEqual(0);
        expect(t.y + t.size, `${format} "${t.text}" y`).toBeLessThanOrEqual(spec.height);
      }
    }
  });

  it('caps the mutation list at 6 names', () => {
    const many = { ...run, mutations: Array.from({ length: 9 }, (_, i) => `Mut ${i}`) };
    const texts = shareCardSpec(many, 'story').texts.filter((t) => t.text.startsWith('Mut '));
    expect(texts).toHaveLength(6);
  });
});
