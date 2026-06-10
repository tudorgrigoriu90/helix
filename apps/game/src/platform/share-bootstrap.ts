import { Capacitor } from '@capacitor/core';
import { Share } from '@capacitor/share';
import type { ShareAdapter, SharePayload, ShareOutcome } from '../core/share';
import { setShareAdapter } from '../core/share';

/**
 * Platform share adapter — T-331 (UFD S149).
 *
 * Native (iOS/Android): the Capacitor Share plugin opens the OS share sheet
 * (with the generated card attached when the platform supports files).
 * Web: the Web Share API where available. Otherwise the adapter reports
 * 'unavailable' and the scene degrades to copy-link (S150).
 */

/** Writes a data-URL PNG to the app cache so the native sheet can attach it. */
async function cacheImageForNativeShare(dataUrl: string): Promise<string | undefined> {
  try {
    const { Filesystem, Directory } = await import('@capacitor/filesystem');
    const base64 = dataUrl.split(',')[1];
    if (base64 === undefined) return undefined;
    const result = await Filesystem.writeFile({
      path: 'share-card.png',
      data: base64,
      directory: Directory.Cache,
    });
    return result.uri;
  } catch {
    return undefined; // no Filesystem plugin → share text + URL only
  }
}

export const capacitorShareAdapter: ShareAdapter = {
  canShare(): boolean {
    return Capacitor.isNativePlatform() || typeof navigator.share === 'function';
  },

  async share(payload: SharePayload): Promise<ShareOutcome> {
    try {
      if (Capacitor.isNativePlatform()) {
        const files =
          payload.imageDataUrl !== undefined
            ? await cacheImageForNativeShare(payload.imageDataUrl)
            : undefined;
        await Share.share({
          title: payload.title,
          text: payload.text,
          url: payload.url,
          ...(files !== undefined ? { files: [files] } : {}),
        });
        return 'shared';
      }
      if (typeof navigator.share === 'function') {
        await navigator.share({ title: payload.title, text: payload.text, url: payload.url });
        return 'shared';
      }
      return 'unavailable';
    } catch {
      // The OS rejects with AbortError when the player dismisses the sheet.
      return 'dismissed';
    }
  },
};

setShareAdapter(capacitorShareAdapter);
