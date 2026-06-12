/**
 * ShareAdapter — T-531 (DR-011, TDD §5.2 adapter pattern; S-5.6).
 *
 * Behind-the-interface so the share *flow* is platform-agnostic: web uses the
 * Web Share API with download fallback (share-web.ts); the Capacitor native
 * share plugin slots in later without touching the scenes. Share URLs ride on
 * the payload text, so the attribution provider (T-540: Branch vs store-native)
 * stays swappable too.
 */

export interface SharePayload {
  readonly title: string;
  readonly text: string;
  /** The rendered share card (PNG), when the platform can attach files. */
  readonly file?: Blob;
  readonly fileName?: string;
}

/** How the payload actually left the device (drives share_completed analytics). */
export type ShareOutcome = 'shared' | 'downloaded' | 'copied' | 'cancelled' | 'unavailable';

export interface ShareAdapter {
  share(payload: SharePayload): Promise<ShareOutcome>;
}

let _adapter: ShareAdapter | null = null;

/** Install the active share adapter (boot, or lazily by the first share). */
export function setShareAdapter(adapter: ShareAdapter): void {
  _adapter = adapter;
}

export function getShareAdapter(): ShareAdapter | null {
  return _adapter;
}

/** Share through the installed adapter; 'unavailable' when none is installed. */
export async function share(payload: SharePayload): Promise<ShareOutcome> {
  if (_adapter === null) return 'unavailable';
  return _adapter.share(payload);
}
