/**
 * Share attribution URLs — T-331, behind a swappable builder (T-340).
 *
 * Every share carries a URL that lands on the web page (mobile UA → store
 * redirect, desktop UA → the Floors 1–2 web demo). v1 ships the plain
 * landing-page URL with lightweight query attribution; the Branch.io (or
 * successor) integration swaps the builder at boot without touching callers —
 * the T-340 scale-cliff mitigation.
 */

export interface ShareUrlParams {
  /** Where the share started — e.g. 'post_run', 'daily', 'weekly'. */
  readonly source: string;
  /** The shared organism's name (campaign colour, not PII). */
  readonly organismName: string;
}

export interface ShareUrlBuilder {
  buildShareUrl(params: ShareUrlParams): string;
}

/** The landing page (UFD Scope 8 LANDING). */
export const SHARE_LANDING_URL = 'https://play.empathy.software';

/** v1 builder: landing page + minimal query attribution. */
export const plainShareUrlBuilder: ShareUrlBuilder = {
  buildShareUrl(params: ShareUrlParams): string {
    const q = new URLSearchParams({ s: params.source, o: params.organismName });
    return `${SHARE_LANDING_URL}/?${q.toString()}`;
  },
};

let _builder: ShareUrlBuilder = plainShareUrlBuilder;

/** Installs an attribution provider (Branch.io etc.) at boot. */
export function setShareUrlBuilder(builder: ShareUrlBuilder): void {
  _builder = builder;
}

export function buildShareUrl(params: ShareUrlParams): string {
  return _builder.buildShareUrl(params);
}
