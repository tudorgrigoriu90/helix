import { describe, it, expect, beforeEach } from 'vitest';
import { makeWebShareAdapter } from './share-web';
import { setShareAdapter, share, getShareAdapter } from '../core/platform/share-adapter';
import type { SharePayload } from '../core/platform/share-adapter';

const payload: SharePayload = {
  title: 'Strand Descent — What I Became',
  text: 'The Crystalline Threshold Walker — floor 13 of 20.',
  file: new Blob(['png-bytes'], { type: 'image/png' }),
  fileName: 'strand-descent-story.png',
};

describe('web share adapter — T-531 (S-5.6)', () => {
  it('uses the Web Share API with the file when canShare accepts files', async () => {
    const calls: unknown[] = [];
    const adapter = makeWebShareAdapter({
      nav: {
        share: (data) => { calls.push(data); return Promise.resolve(); },
        canShare: () => true,
      },
      download: () => { throw new Error('should not download'); },
    });
    expect(await adapter.share(payload)).toBe('shared');
    expect(calls).toHaveLength(1);
    expect((calls[0] as { files?: File[] }).files).toHaveLength(1);
  });

  it('shares text-only when the platform cannot attach files', async () => {
    const calls: unknown[] = [];
    const adapter = makeWebShareAdapter({
      nav: {
        share: (data) => { calls.push(data); return Promise.resolve(); },
        canShare: () => false,
      },
      download: () => { throw new Error('should not download'); },
    });
    expect(await adapter.share(payload)).toBe('shared');
    expect((calls[0] as { files?: File[] }).files).toBeUndefined();
  });

  it('treats a rejected share sheet as cancelled', async () => {
    const adapter = makeWebShareAdapter({
      nav: { share: () => Promise.reject(new Error('AbortError')), canShare: () => true },
      download: () => { throw new Error('should not download'); },
    });
    expect(await adapter.share(payload)).toBe('cancelled');
  });

  it('falls back to a PNG download when the Web Share API is absent', async () => {
    const downloads: string[] = [];
    const adapter = makeWebShareAdapter({
      nav: {},
      download: (_blob, fileName) => downloads.push(fileName),
    });
    expect(await adapter.share(payload)).toBe('downloaded');
    expect(downloads).toEqual(['strand-descent-story.png']);
  });

  it('reports unavailable with no API and no file to download', async () => {
    const adapter = makeWebShareAdapter({ nav: {}, download: () => undefined });
    expect(await adapter.share({ title: 't', text: 'x' })).toBe('unavailable');
  });
});

describe('share adapter registry — T-531', () => {
  beforeEach(() => {
    // No public reset — installing a fresh fake per test isolates them.
  });

  it('routes share() through the installed adapter', async () => {
    const seen: SharePayload[] = [];
    setShareAdapter({ share: (p) => { seen.push(p); return Promise.resolve('shared' as const); } });
    expect(getShareAdapter()).not.toBeNull();
    expect(await share(payload)).toBe('shared');
    expect(seen[0]!.title).toContain('Strand Descent');
  });
});
