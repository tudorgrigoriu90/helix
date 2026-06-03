import type { AdResult } from '../platform/ads-adapter';

/** Default budget for a rewarded-ad load+show before we give up (UFD E030). */
export const AD_TIMEOUT_MS = 10_000;

/**
 * Races a rewarded-ad request against a timeout (T-240). If the ad doesn't
 * resolve within `timeoutMs`, we resolve `timed_out` and move on — graceful
 * degradation with **no retry and no goodwill grant** (UFD E030). The underlying
 * ad promise is left to settle on its own (we don't cancel it); the late result
 * is simply ignored because this race has already resolved.
 *
 * The timer is injectable so tests can drive it deterministically without real
 * time or fake-timer plumbing.
 */
export function withAdTimeout(
  request: Promise<AdResult>,
  timeoutMs: number = AD_TIMEOUT_MS,
  schedule: (cb: () => void, ms: number) => void = (cb, ms) => { setTimeout(cb, ms); },
): Promise<AdResult> {
  return new Promise<AdResult>((resolve) => {
    let settled = false;
    const finish = (result: AdResult): void => {
      if (settled) return;
      settled = true;
      resolve(result);
    };
    schedule(() => finish('timed_out'), timeoutMs);
    request.then(finish, () => finish('error'));
  });
}
