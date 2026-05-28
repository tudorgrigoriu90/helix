export type TurnErrorCode =
  | 'INVALID_PHASE'
  | 'TARGET_NOT_FOUND'
  | 'OUT_OF_RANGE'
  | 'INSUFFICIENT_AP'
  | 'ROOTED'
  | 'ABILITY_NOT_FOUND'
  | 'ABILITY_ON_COOLDOWN'
  | 'ABILITY_SUPPRESSED'
  | 'INVALID_TARGET'
  | 'ITEM_NOT_FOUND'
  | 'ITEM_NOT_CONSUMABLE'
  | 'ALREADY_SURRENDERED';

export interface TurnError {
  readonly code: TurnErrorCode;
  readonly message: string;
}
