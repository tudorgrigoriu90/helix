export type TurnErrorCode =
  | 'INVALID_PHASE'
  | 'TARGET_NOT_FOUND'
  | 'OUT_OF_RANGE'
  | 'INSUFFICIENT_AP'
  | 'ABILITY_ON_COOLDOWN'
  | 'INVALID_TARGET'
  | 'ITEM_NOT_FOUND'
  | 'ALREADY_SURRENDERED';

export interface TurnError {
  readonly code: TurnErrorCode;
  readonly message: string;
}
