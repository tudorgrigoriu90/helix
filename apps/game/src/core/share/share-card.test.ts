import { describe, it, expect } from 'vitest';
import { buildShareCard, SHARE_FORMATS, type ShareCardInput, type ShareText } from './share-card';
import { renderShareCard, type Canvas2DSurface } from './build-share-image';
import { buildShareUrl, plainShareUrlBuilder, setShareUrlBuilder, SHARE_LANDING_URL } from './share-url';
import { getShareAdapter, noopShareAdapter, setShareAdapter } from './share-adapter';

const input: ShareCardInput = {
  organismName: 'The Pale Devourer',
  won: false,
  floorReached: 13,
  finalFloor: 20,
  mutations: ['Chitin Plating', 'Spore Cloud', 'Abyssal Sight'],
  dominantTraits: ['abyssal'],
  enemiesKilled: 87,
  playtimeMs: 754_000,
  shareUrl: 'https://play.empathy.software/?s=post_run',
};

function texts(spec: ReturnType<typeof buildShareCard>): ShareText[] {
  return spec.elements.filter((e): e is ShareText => e.kind === 'text');
}

describe('buildShareCard — T-331 (UFD S143)', () => {
  it('produces both locked formats at the exact pixel sizes', () => {
    expect(SHARE_FORMATS.vertical).toEqual({ width: 1080, height: 1920 });
    expect(SHARE_FORMATS.square).toEqual({ width: 1080, height: 1080 });
    for (const format of ['vertical', 'square'] as const) {
      const spec = buildShareCard(input, format);
      expect(spec.width).toBe(SHARE_FORMATS[format].width);
      expect(spec.height).toBe(SHARE_FORMATS[format].height);
    }
  });

  it('carries the organism name, depth, build, and attribution URL', () => {
    const t = texts(buildShareCard(input, 'vertical')).map((e) => e.text);
    expect(t).toContain('THE PALE DEVOURER');
    expect(t).toContain('REACHED FLOOR 13 / 20');
    expect(t).toContain('Chitin Plating');
    expect(t).toContain('DOMINANT: ABYSSAL');
    expect(t).toContain('87 kills · 12:34');
    expect(t).toContain(input.shareUrl);
  });

  it('a victory reads as the full descent', () => {
    const t = texts(buildShareCard({ ...input, won: true }, 'square')).map((e) => e.text);
    expect(t).toContain('FULL DESCENT — FLOOR 20');
  });

  it('caps the build at the four mutation slots and tolerates an empty one', () => {
    const many = { ...input, mutations: ['a', 'b', 'c', 'd', 'e', 'f'] };
    const mutationLines = texts(buildShareCard(many, 'vertical')).filter((e) =>
      ['a', 'b', 'c', 'd', 'e', 'f'].includes(e.text),
    );
    expect(mutationLines).toHaveLength(4);

    const none = buildShareCard({ ...input, mutations: [], dominantTraits: [] }, 'square');
    expect(texts(none).some((e) => e.text === '— STRANDS —')).toBe(false);
  });

  it('every element stays inside the canvas bounds', () => {
    for (const format of ['vertical', 'square'] as const) {
      const spec = buildShareCard(input, format);
      for (const el of spec.elements) {
        expect(el.x).toBeGreaterThanOrEqual(0);
        expect(el.y).toBeGreaterThanOrEqual(0);
        expect(el.x).toBeLessThanOrEqual(spec.width);
        expect(el.y).toBeLessThanOrEqual(spec.height);
      }
    }
  });
});

describe('renderShareCard — T-331', () => {
  it('replays the spec onto a 2D surface in order', () => {
    const calls: string[] = [];
    const ctx: Canvas2DSurface = {
      fillStyle: '', font: '', textAlign: '', textBaseline: '',
      fillRect: (x, y, w, h) => calls.push(`rect ${x},${y},${w},${h}`),
      fillText: (text) => calls.push(`text ${text}`),
    };
    const spec = buildShareCard(input, 'square');
    renderShareCard(spec, ctx);
    expect(calls[0]).toBe('rect 0,0,1080,1080'); // background first
    expect(calls).toContain('text THE PALE DEVOURER');
    expect(calls.filter((c) => c.startsWith('text'))).toHaveLength(
      spec.elements.filter((e) => e.kind === 'text').length,
    );
  });
});

describe('share URL + adapter seams — T-331/T-340', () => {
  it('the default builder lands on the web page with query attribution', () => {
    const url = plainShareUrlBuilder.buildShareUrl({ source: 'post_run', organismName: 'The Pale Devourer' });
    expect(url.startsWith(`${SHARE_LANDING_URL}/?`)).toBe(true);
    expect(url).toContain('s=post_run');
  });

  it('the builder is swappable without touching callers (Branch.io seam)', () => {
    setShareUrlBuilder({ buildShareUrl: () => 'https://strand.app.link/x' });
    expect(buildShareUrl({ source: 'post_run', organismName: 'X' })).toBe('https://strand.app.link/x');
    setShareUrlBuilder(plainShareUrlBuilder); // restore
  });

  it('the share adapter registry defaults to the no-op and accepts installs', async () => {
    expect(getShareAdapter().canShare()).toBe(false);
    await expect(getShareAdapter().share({ title: 't', text: 'x', url: 'u' })).resolves.toBe('unavailable');
    const fake = { canShare: () => true, share: () => Promise.resolve('shared' as const) };
    setShareAdapter(fake);
    expect(getShareAdapter().canShare()).toBe(true);
    setShareAdapter(noopShareAdapter); // restore
  });
});
