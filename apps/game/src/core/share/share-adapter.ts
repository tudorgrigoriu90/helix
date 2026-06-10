/**
 * Share adapter — T-331 (UFD S149, native share sheet).
 *
 * The platform seam for handing a generated card to the OS share sheet:
 * Capacitor's Share plugin on-device, the Web Share API in capable browsers,
 * and a graceful 'unavailable' otherwise (the scene then offers copy-link).
 * Mirrors the ads/analytics adapter pattern — core defines the interface,
 * `src/platform/` provides implementations, a module-level registry binds one
 * at boot.
 */

export interface SharePayload {
  readonly title: string;
  readonly text: string;
  readonly url: string;
  /** PNG data URL of the generated card, when the platform can attach files. */
  readonly imageDataUrl?: string;
}

export type ShareOutcome = 'shared' | 'dismissed' | 'unavailable';

export interface ShareAdapter {
  /** True when a native share surface exists on this platform. */
  canShare(): boolean;
  share(payload: SharePayload): Promise<ShareOutcome>;
}

/** Dev/headless fallback: nothing to share into. */
export const noopShareAdapter: ShareAdapter = {
  canShare: () => false,
  share: () => Promise.resolve('unavailable'),
};

let _adapter: ShareAdapter = noopShareAdapter;

export function setShareAdapter(adapter: ShareAdapter): void {
  _adapter = adapter;
}

export function getShareAdapter(): ShareAdapter {
  return _adapter;
}
