export interface Position {
  readonly x: number;
  readonly y: number;
}

export interface MoveAction {
  readonly type: 'move';
  readonly targetPos: Position;
}

export interface AttackAction {
  readonly type: 'attack';
  readonly targetId: string;
}

export interface UseAbilityAction {
  readonly type: 'useAbility';
  readonly abilityId: string;
  readonly targetId?: string;
  readonly targetPos?: Position;
}

export interface UseItemAction {
  readonly type: 'useItem';
  readonly itemId: string;
  readonly targetId?: string;
  readonly targetPos?: Position;
}

export interface WaitAction {
  readonly type: 'wait';
}

export interface EndTurnAction {
  readonly type: 'endTurn';
}

export interface SurrenderAction {
  readonly type: 'surrender';
}

export type Action =
  | MoveAction
  | AttackAction
  | UseAbilityAction
  | UseItemAction
  | WaitAction
  | EndTurnAction
  | SurrenderAction;

export type ActionType = Action['type'];
