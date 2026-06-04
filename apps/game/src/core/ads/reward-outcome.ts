import type { RewardOutcome } from './ad-service';

/**
 * Maps a {@link RewardOutcome} to the UI action a scene should take (UFD §07
 * E030–E032 / S135). Pure and exhaustive so the rewarded-ad error handling is
 * unit-testable without a live scene.
 *
 *  - `grant`     reward earned — apply it.
 *  - `silent`    user cancelled mid-watch (E031) — null reward, **no popup**.
 *  - `ad_failed` load timeout / no fill / error (E030) — show the S135 ad-failed
 *                 modal (no reward, no retry button — graceful degradation).
 *  - `capped`    gate refused: 3/run cap spent (E032) — caller offers the SC path.
 *  - `cooldown`  gate refused: still cooling down — caller keeps the SC path.
 */
export type RewardUiAction = 'grant' | 'silent' | 'ad_failed' | 'capped' | 'cooldown';

export function classifyRewardOutcome(outcome: RewardOutcome): RewardUiAction {
  if (outcome.granted) return 'grant';
  if (outcome.result === 'blocked') {
    return outcome.blockReason === 'cap_reached' ? 'capped' : 'cooldown';
  }
  // E031: a user-cancelled ad returns no reward and shows nothing.
  if (outcome.result === 'dismissed') return 'silent';
  // E030: timeout / no fill / error all degrade gracefully to the S135 modal.
  return 'ad_failed';
}
