import type { Position } from '@shared-types/action';
import type { DamageType, DeathCause, StatusEffect } from '@shared-types/run-state';

export type Effect =
  | { readonly type: 'entityMoved'; readonly entityId: string; readonly from: Position; readonly to: Position }
  | { readonly type: 'damageDealt'; readonly targetId: string; readonly amount: number; readonly isCrit: boolean; readonly damageType: DamageType }
  | { readonly type: 'healingApplied'; readonly targetId: string; readonly amount: number }
  | { readonly type: 'entityDied'; readonly entityId: string }
  | { readonly type: 'statusApplied'; readonly targetId: string; readonly status: StatusEffect; readonly turns: number }
  | { readonly type: 'statusExpired'; readonly targetId: string; readonly status: StatusEffect }
  | { readonly type: 'apSpent'; readonly amount: number; readonly remaining: number }
  | { readonly type: 'phaseChanged'; readonly from: string; readonly to: string }
  | { readonly type: 'floorComplete' }
  | { readonly type: 'victory' }
  | { readonly type: 'defeat'; readonly cause: DeathCause }
  | { readonly type: 'telegraphUpdated'; readonly enemyId: string; readonly telegraph: string | null }
  | { readonly type: 'enemyAlerted'; readonly enemyId: string }
  | { readonly type: 'abilityUsed'; readonly entityId: string; readonly abilityId: string }
  | { readonly type: 'itemUsed'; readonly itemId: string };
