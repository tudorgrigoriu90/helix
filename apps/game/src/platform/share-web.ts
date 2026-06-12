import type { ShareAdapter, ShareOutcome, SharePayload } from '../core/platform/share-adapter';

/**
 * Web share adapter — T-531 (S-5.6). Web Share API first (with the file when
 * `canShare` accepts it), then a PNG download fallback so Gate-1 desktop
 * testers can still post the card anywhere. Dependencies are injected so the
 * decision tree is unit-testable in node.
 */

export interface WebShareDeps {
  /** `navigator`-shaped: share/canShare may be absent (desktop browsers). */
  readonly nav: {
    share?: (data: { title?: string; text?: string; files?: File[] }) => Promise<void>;
    canShare?: (data: { files?: File[] }) => boolean;
  };
  /** Triggers a client-side download of `blob` as `fileName`. */
  readonly download: (blob: Blob, fileName: string) => void;
}

/** Browser-default download via a transient object-URL anchor. */
export function domDownload(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}

export function makeWebShareAdapter(deps: WebShareDeps): ShareAdapter {
  return {
    async share(payload: SharePayload): Promise<ShareOutcome> {
      const files =
        payload.file !== undefined
          ? [new File([payload.file], payload.fileName ?? 'strand-descent.png', { type: 'image/png' })]
          : undefined;

      if (deps.nav.share !== undefined) {
        const withFiles = files !== undefined && deps.nav.canShare?.({ files }) === true;
        try {
          await deps.nav.share(
            withFiles
              ? { title: payload.title, text: payload.text, files }
              : { title: payload.title, text: payload.text },
          );
          return 'shared';
        } catch {
          // AbortError (user closed the sheet) and NotAllowedError both land
          // here — treat as cancelled and fall through to no further action.
          return 'cancelled';
        }
      }

      if (payload.file !== undefined) {
        deps.download(payload.file, payload.fileName ?? 'strand-descent.png');
        return 'downloaded';
      }
      return 'unavailable';
    },
  };
}

/** The production adapter, bound to the real browser environment. */
export function installWebShareAdapter(): ShareAdapter {
  return makeWebShareAdapter({
    nav: navigator as WebShareDeps['nav'],
    download: domDownload,
  });
}
