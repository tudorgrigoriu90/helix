export type { AdGateState, AdGateDecision } from './ad-gatekeeper';
export {
  MAX_ADS_PER_RUN,
  AD_COOLDOWN_MS,
  newAdGateState,
  canShowAd,
  recordAdAttempt,
  isAdCapReached,
} from './ad-gatekeeper';
export { AD_TIMEOUT_MS, withAdTimeout } from './ad-timeout';
export type { RewardOutcome, AdServiceOptions } from './ad-service';
export { AdService } from './ad-service';
export type { RewardUiAction } from './reward-outcome';
export { classifyRewardOutcome } from './reward-outcome';
