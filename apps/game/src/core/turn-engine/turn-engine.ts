import type {
  Action,
  MoveAction,
  AttackAction,
  UseAbilityAction,
  UseItemAction,
  WaitAction,
  EndTurnAction,
  SurrenderAction,
} from '@shared-types/action';
import type { RunState } from '@shared-types/run-state';
import type { Mulberry32 } from '../rng/mulberry32';
import type { Effect } from './effect';
import type { TurnError } from './turn-error';
import { chebyshev, inBounds, tileAt } from './grid';

/** AP cost to move one tile (GDD §4.4 / §6.3). */
const MOVE_AP_COST = 1;

// ── Basic attack tuning (GDD §6.3, §6.6) ─────────────────────────────────────
const ATTACK_AP_COST = 1;
/** Melee basic-attack reach in tiles (Chebyshev). Ranged needs equipment — not modeled yet. */
const MELEE_RANGE = 1;
/** Damage = STR × this (melee). Ranged would be 0.8 once equipment lands. */
const MELEE_DAMAGE_MULT = 1.0;
const BASE_CRIT_CHANCE = 0.05;
const CRIT_MULTIPLIER = 1.5;
const BASE_AGI = 10;
/** Crit chance gained per point of AGI above base. Tunable pending Economy.xlsx balance pass. */
const CRIT_PER_AGI_OVER_BASE = 0.005;

export interface TurnResult {
  readonly state: RunState;
  readonly effects: readonly Effect[];
  readonly errors: readonly TurnError[];
}

function ok(state: RunState, effects: readonly Effect[] = []): TurnResult {
  return { state, effects, errors: [] };
}

function err(state: RunState, code: TurnError['code'], message: string): TurnResult {
  return { state, effects: [], errors: [{ code, message }] };
}

function applyMove(
  state: RunState,
  action: MoveAction,
  _rng: Mulberry32,
): TurnResult {
  if (state.phase !== 'player') {
    return err(state, 'INVALID_PHASE', 'move requires player phase');
  }

  const from = state.player.pos;
  const to = action.targetPos;

  if (!inBounds(state.grid, to)) {
    return err(state, 'OUT_OF_RANGE', `target (${to.x},${to.y}) is outside the grid`);
  }

  // One tile per action; diagonals allowed (GDD §6.3).
  if (chebyshev(from, to) !== 1) {
    return err(state, 'OUT_OF_RANGE', 'move must target an adjacent tile (1 tile per action)');
  }

  if (tileAt(state.grid, to) === 'wall') {
    return err(state, 'INVALID_TARGET', `target (${to.x},${to.y}) is a wall`);
  }

  const blocked = state.enemies.some(
    (e) => e.hp > 0 && e.pos.x === to.x && e.pos.y === to.y,
  );
  if (blocked) {
    return err(state, 'INVALID_TARGET', 'target tile is occupied by an enemy');
  }

  if (state.player.ap < MOVE_AP_COST) {
    return err(
      state,
      'INSUFFICIENT_AP',
      `move costs ${MOVE_AP_COST} AP, player has ${state.player.ap}`,
    );
  }

  const remaining = state.player.ap - MOVE_AP_COST;
  const nextState: RunState = {
    ...state,
    player: { ...state.player, pos: to, ap: remaining },
  };

  return ok(nextState, [
    { type: 'entityMoved', entityId: 'player', from, to },
    { type: 'apSpent', amount: MOVE_AP_COST, remaining },
  ]);
}

function applyAttack(
  state: RunState,
  action: AttackAction,
  rng: Mulberry32,
): TurnResult {
  if (state.phase !== 'player') {
    return err(state, 'INVALID_PHASE', 'attack requires player phase');
  }

  const targetIndex = state.enemies.findIndex((e) => e.id === action.targetId);
  if (targetIndex === -1) {
    return err(state, 'TARGET_NOT_FOUND', `no enemy with id "${action.targetId}"`);
  }

  const target = state.enemies[targetIndex]!;
  if (target.hp <= 0) {
    return err(state, 'INVALID_TARGET', 'target is already dead');
  }

  if (target.statuses.some((s) => s.effect === 'phased')) {
    return err(state, 'INVALID_TARGET', 'target is phased (untargetable)');
  }

  if (chebyshev(state.player.pos, target.pos) > MELEE_RANGE) {
    return err(state, 'OUT_OF_RANGE', 'target is beyond melee range');
  }

  if (state.player.ap < ATTACK_AP_COST) {
    return err(
      state,
      'INSUFFICIENT_AP',
      `attack costs ${ATTACK_AP_COST} AP, player has ${state.player.ap}`,
    );
  }

  // Damage = STR × melee mult, ×1.5 on crit, then flat RES mitigation (GDD §6.4/§6.6).
  const baseDamage = Math.floor(state.player.stats.str * MELEE_DAMAGE_MULT);
  const critChance =
    BASE_CRIT_CHANCE + Math.max(0, state.player.stats.agi - BASE_AGI) * CRIT_PER_AGI_OVER_BASE;
  const isCrit = rng.next() < critChance;
  const rawDamage = isCrit ? Math.floor(baseDamage * CRIT_MULTIPLIER) : baseDamage;
  const dealt = Math.max(0, rawDamage - target.stats.res);
  const newHp = Math.max(0, target.hp - dealt);

  const nextEnemies = state.enemies.map((e, i) =>
    i === targetIndex ? { ...e, hp: newHp } : e,
  );
  const remaining = state.player.ap - ATTACK_AP_COST;

  const effects: Effect[] = [
    { type: 'damageDealt', targetId: target.id, amount: dealt, isCrit, damageType: 'physical' },
  ];
  if (newHp === 0) {
    effects.push({ type: 'entityDied', entityId: target.id });
  }
  effects.push({ type: 'apSpent', amount: ATTACK_AP_COST, remaining });

  const nextState: RunState = {
    ...state,
    enemies: nextEnemies,
    player: { ...state.player, ap: remaining },
  };

  return ok(nextState, effects);
}

function applyUseAbility(
  state: RunState,
  _action: UseAbilityAction,
  _rng: Mulberry32,
): TurnResult {
  if (state.phase !== 'player') return err(state, 'INVALID_PHASE', 'useAbility requires player phase');
  return ok(state);
}

function applyUseItem(
  state: RunState,
  _action: UseItemAction,
  _rng: Mulberry32,
): TurnResult {
  if (state.phase !== 'player') return err(state, 'INVALID_PHASE', 'useItem requires player phase');
  return ok(state);
}

function applyWait(
  state: RunState,
  _action: WaitAction,
  _rng: Mulberry32,
): TurnResult {
  if (state.phase !== 'player') return err(state, 'INVALID_PHASE', 'wait requires player phase');
  return ok(state);
}

function applyEndTurn(
  state: RunState,
  _action: EndTurnAction,
  _rng: Mulberry32,
): TurnResult {
  if (state.phase !== 'player') return err(state, 'INVALID_PHASE', 'endTurn requires player phase');
  return ok(state);
}

function applySurrender(
  state: RunState,
  _action: SurrenderAction,
  _rng: Mulberry32,
): TurnResult {
  if (state.phase === 'defeat') return err(state, 'ALREADY_SURRENDERED', 'already in defeat phase');
  return ok(state);
}

export const TurnEngine = {
  apply(state: RunState, action: Action, rng: Mulberry32): TurnResult {
    switch (action.type) {
      case 'move':       return applyMove(state, action, rng);
      case 'attack':     return applyAttack(state, action, rng);
      case 'useAbility': return applyUseAbility(state, action, rng);
      case 'useItem':    return applyUseItem(state, action, rng);
      case 'wait':       return applyWait(state, action, rng);
      case 'endTurn':    return applyEndTurn(state, action, rng);
      case 'surrender':  return applySurrender(state, action, rng);
    }
  },
};
