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
import type { ActiveStatus, EnemyState, RunState } from '@shared-types/run-state';
import type { Mulberry32 } from '../rng/mulberry32';
import type { Effect } from './effect';
import type { TurnError } from './turn-error';
import { chebyshev, inBounds, tileAt } from './grid';
import { applyCrit, rollCrit, HAZARD_DAMAGE } from './combat';
import { damageTo, effectiveMaxAp, hasDominantTrait, isImmobilized } from './effective-stats';
import { resolveEnemyPhase } from './enemy-phase';
import { tickStatuses } from './status-tick';
import { detectOutcome } from './outcome';

/** AP cost to move one tile (GDD §4.4 / §6.3). */
const MOVE_AP_COST = 1;

// ── Basic attack tuning (GDD §6.3) ───────────────────────────────────────────
const ATTACK_AP_COST = 1;
/** Melee basic-attack reach in tiles (Chebyshev). Ranged needs equipment — not modeled yet. */
const MELEE_RANGE = 1;
/** Damage = STR × this (melee). Ranged would be 0.8 once equipment lands. */
const MELEE_DAMAGE_MULT = 1.0;

/** AP cost to use a consumable (GDD §4.4 / §6.3). */
const ITEM_AP_COST = 1;

/** Combustion Engine (Thermal dominant): every damaging player attack also
 *  applies Burn (5 dmg/turn via status-tick) for this many turns (GDD §5.5). */
const COMBUSTION_BURN_TURNS = 2;

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

  if (isImmobilized(state.player)) {
    return err(state, 'ROOTED', 'player is immobilised (rooted/crushed) and cannot move');
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
  // Hazard tiles damage on entry (GDD §6.1) — unmitigated `true` damage.
  const hazardDmg = tileAt(state.grid, to) === 'hazard' ? HAZARD_DAMAGE : 0;
  const newHp = Math.max(0, state.player.hp - hazardDmg);
  const nextState: RunState = {
    ...state,
    player: { ...state.player, pos: to, ap: remaining, hp: newHp },
  };

  const effects: Effect[] = [
    { type: 'entityMoved', entityId: 'player', from, to },
    { type: 'apSpent', amount: MOVE_AP_COST, remaining },
  ];
  if (hazardDmg > 0) {
    effects.push({ type: 'damageDealt', targetId: 'player', amount: hazardDmg, isCrit: false, damageType: 'true' });
  }
  return ok(nextState, effects);
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
  const isCrit = rollCrit(rng, state.player.stats.agi);
  const rawDamage = applyCrit(baseDamage, isCrit);
  const dealt = damageTo(target, rawDamage, 'physical');
  const newHp = Math.max(0, target.hp - dealt);

  // Combustion Engine: a surviving target also catches Burn (GDD §5.5).
  const burns = hasDominantTrait(state.player, 'thermal') && newHp > 0;
  const burn: ActiveStatus = { effect: 'burn', turnsRemaining: COMBUSTION_BURN_TURNS };

  const nextEnemies = state.enemies.map((e, i) => {
    if (i !== targetIndex) return e;
    const hit: EnemyState = { ...e, hp: newHp };
    return burns ? { ...hit, statuses: [...e.statuses, burn] } : hit;
  });
  const remaining = state.player.ap - ATTACK_AP_COST;

  const effects: Effect[] = [
    { type: 'damageDealt', targetId: target.id, amount: dealt, isCrit, damageType: 'physical' },
  ];
  if (newHp === 0) {
    effects.push({ type: 'entityDied', entityId: target.id });
  } else if (burns) {
    effects.push({ type: 'statusApplied', targetId: target.id, status: 'burn', turns: COMBUSTION_BURN_TURNS });
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
  action: UseAbilityAction,
  _rng: Mulberry32,
): TurnResult {
  if (state.phase !== 'player') {
    return err(state, 'INVALID_PHASE', 'useAbility requires player phase');
  }

  const slotIndex = state.player.abilities.findIndex((s) => s.def.id === action.abilityId);
  if (slotIndex === -1) {
    return err(state, 'ABILITY_NOT_FOUND', `player does not have ability "${action.abilityId}"`);
  }
  const slot = state.player.abilities[slotIndex]!;
  const def = slot.def;

  if (state.player.statuses.some((s) => s.effect === 'suppressed')) {
    return err(state, 'ABILITY_SUPPRESSED', 'abilities are suppressed');
  }
  if (slot.cooldownRemaining > 0) {
    return err(
      state,
      'ABILITY_ON_COOLDOWN',
      `"${def.id}" is on cooldown for ${slot.cooldownRemaining} more turn(s)`,
    );
  }
  if (state.player.ap < def.apCost) {
    return err(
      state,
      'INSUFFICIENT_AP',
      `"${def.id}" costs ${def.apCost} AP, player has ${state.player.ap}`,
    );
  }

  // ── Resolve targeting → set of affected living enemy indices, plus self flag.
  const affected: number[] = [];
  let affectsPlayer = false;

  if (def.targetType === 'self') {
    affectsPlayer = true;
  } else if (def.targetType === 'enemy') {
    if (action.targetId === undefined) {
      return err(state, 'INVALID_TARGET', 'ability requires an enemy target');
    }
    const idx = state.enemies.findIndex((e) => e.id === action.targetId);
    if (idx === -1) return err(state, 'TARGET_NOT_FOUND', `no enemy with id "${action.targetId}"`);
    const target = state.enemies[idx]!;
    if (target.hp <= 0) return err(state, 'INVALID_TARGET', 'target is already dead');
    if (target.statuses.some((s) => s.effect === 'phased')) {
      return err(state, 'INVALID_TARGET', 'target is phased (untargetable)');
    }
    if (chebyshev(state.player.pos, target.pos) > def.range) {
      return err(state, 'OUT_OF_RANGE', 'target is beyond ability range');
    }
    collectAoe(state, target.pos, def.aoeRadius, affected);
  } else {
    // 'tile'
    if (action.targetPos === undefined) {
      return err(state, 'INVALID_TARGET', 'ability requires a target tile');
    }
    if (!inBounds(state.grid, action.targetPos)) {
      return err(state, 'OUT_OF_RANGE', 'target tile is outside the grid');
    }
    if (chebyshev(state.player.pos, action.targetPos) > def.range) {
      return err(state, 'OUT_OF_RANGE', 'target tile is beyond ability range');
    }
    collectAoe(state, action.targetPos, def.aoeRadius, affected);
  }

  // ── Apply effects. No randomness in ability resolution yet (abilities don't
  // crit — crit is a basic-attack mechanic per GDD §6.6). _rng reserved.
  const damage = def.baseDamage + Math.floor(state.player.stats.int * def.intScaling);
  const status: ActiveStatus | null = def.appliesStatus
    ? { effect: def.appliesStatus, turnsRemaining: def.statusDuration }
    : null;

  const effects: Effect[] = [{ type: 'abilityUsed', entityId: 'player', abilityId: def.id }];
  const affectedSet = new Set(affected);

  // Combustion Engine: damaging abilities also ignite surviving targets (unless
  // the ability already applies Burn itself — no point double-stacking it).
  const combustionBurns = hasDominantTrait(state.player, 'thermal') && def.appliesStatus !== 'burn';
  const combustionBurn: ActiveStatus = { effect: 'burn', turnsRemaining: COMBUSTION_BURN_TURNS };

  const nextEnemies = state.enemies.map((e, i) => {
    if (!affectedSet.has(i)) return e;
    let next: EnemyState = e;
    if (damage > 0) {
      const dealt = damageTo(e, damage, def.damageType);
      const newHp = Math.max(0, e.hp - dealt);
      next = { ...next, hp: newHp };
      effects.push({ type: 'damageDealt', targetId: e.id, amount: dealt, isCrit: false, damageType: def.damageType });
      if (newHp === 0) effects.push({ type: 'entityDied', entityId: e.id });
    }
    if (status && next.hp > 0) {
      next = { ...next, statuses: [...next.statuses, status] };
      effects.push({ type: 'statusApplied', targetId: e.id, status: status.effect, turns: status.turnsRemaining });
    }
    if (combustionBurns && damage > 0 && next.hp > 0) {
      next = { ...next, statuses: [...next.statuses, combustionBurn] };
      effects.push({ type: 'statusApplied', targetId: e.id, status: 'burn', turns: COMBUSTION_BURN_TURNS });
    }
    return next;
  });

  let nextPlayer = {
    ...state.player,
    ap: state.player.ap - def.apCost,
    abilities: state.player.abilities.map((s, i) =>
      i === slotIndex ? { ...s, cooldownRemaining: def.cooldown } : s,
    ),
  };
  if (affectsPlayer && status) {
    nextPlayer = { ...nextPlayer, statuses: [...nextPlayer.statuses, status] };
    effects.push({ type: 'statusApplied', targetId: 'player', status: status.effect, turns: status.turnsRemaining });
  }

  effects.push({ type: 'apSpent', amount: def.apCost, remaining: nextPlayer.ap });

  return ok({ ...state, enemies: nextEnemies, player: nextPlayer }, effects);
}

/** Pushes indices of living enemies within `radius` (Chebyshev) of `center` into `out`. */
function collectAoe(
  state: RunState,
  center: { readonly x: number; readonly y: number },
  radius: number,
  out: number[],
): void {
  state.enemies.forEach((e, i) => {
    if (e.hp > 0 && chebyshev(e.pos, center) <= radius) out.push(i);
  });
}

function applyUseItem(
  state: RunState,
  action: UseItemAction,
  _rng: Mulberry32,
): TurnResult {
  if (state.phase !== 'player') {
    return err(state, 'INVALID_PHASE', 'useItem requires player phase');
  }

  const itemIndex = state.player.items.findIndex((it) => it.id === action.itemId);
  if (itemIndex === -1) {
    return err(state, 'ITEM_NOT_FOUND', `player does not have item "${action.itemId}"`);
  }
  const item = state.player.items[itemIndex]!;
  if (item.category !== 'consumable' || item.effect === null) {
    return err(state, 'ITEM_NOT_CONSUMABLE', `"${item.id}" is not a usable consumable`);
  }
  if (state.player.ap < ITEM_AP_COST) {
    return err(
      state,
      'INSUFFICIENT_AP',
      `using "${item.id}" costs ${ITEM_AP_COST} AP, player has ${state.player.ap}`,
    );
  }

  const effect = item.effect;

  // Tile-targeted effects (grenades) need a valid in-bounds target tile.
  if (effect.kind !== 'heal') {
    if (action.targetPos === undefined) {
      return err(state, 'INVALID_TARGET', `"${item.id}" requires a target tile`);
    }
    if (!inBounds(state.grid, action.targetPos)) {
      return err(state, 'OUT_OF_RANGE', 'target tile is outside the grid');
    }
  }

  // Consume one instance from inventory.
  const nextItems = state.player.items.filter((_, i) => i !== itemIndex);
  const effects: Effect[] = [{ type: 'itemUsed', itemId: item.id }];
  let nextPlayer = { ...state.player, items: nextItems };
  let nextEnemies = state.enemies;

  if (effect.kind === 'heal') {
    const newHp = Math.min(state.player.maxHp, state.player.hp + effect.amount);
    const healed = newHp - state.player.hp;
    nextPlayer = { ...nextPlayer, hp: newHp };
    effects.push({ type: 'healingApplied', targetId: 'player', amount: healed });
  } else {
    const center = action.targetPos!;
    const indices: number[] = [];
    collectAoe(state, center, effect.aoeRadius, indices);
    const hitSet = new Set(indices);

    nextEnemies = state.enemies.map((e, i) => {
      if (!hitSet.has(i)) return e;
      let next: EnemyState = e;
      if (effect.kind === 'damage') {
        const dealt = damageTo(e, effect.amount, effect.damageType);
        const newHp = Math.max(0, e.hp - dealt);
        next = { ...next, hp: newHp };
        effects.push({ type: 'damageDealt', targetId: e.id, amount: dealt, isCrit: false, damageType: effect.damageType });
        if (newHp === 0) effects.push({ type: 'entityDied', entityId: e.id });
      } else {
        next = { ...next, statuses: [...next.statuses, { effect: effect.status, turnsRemaining: effect.duration }] };
        effects.push({ type: 'statusApplied', targetId: e.id, status: effect.status, turns: effect.duration });
      }
      return next;
    });
  }

  nextPlayer = { ...nextPlayer, ap: nextPlayer.ap - ITEM_AP_COST };
  effects.push({ type: 'apSpent', amount: ITEM_AP_COST, remaining: nextPlayer.ap });

  return ok({ ...state, enemies: nextEnemies, player: nextPlayer }, effects);
}

function applyWait(
  state: RunState,
  _action: WaitAction,
  rng: Mulberry32,
): TurnResult {
  if (state.phase !== 'player') return err(state, 'INVALID_PHASE', 'wait requires player phase');
  return endPlayerTurn(state, rng);
}

function applyEndTurn(
  state: RunState,
  _action: EndTurnAction,
  rng: Mulberry32,
): TurnResult {
  if (state.phase !== 'player') return err(state, 'INVALID_PHASE', 'endTurn requires player phase');
  return endPlayerTurn(state, rng);
}

/**
 * Ends the player turn and runs the full cycle (TDD §5.3): transition to the
 * enemy phase, resolve every enemy's decide-and-act action (T-64), tick
 * statuses (T-65), check for a terminal outcome (T-66). If combat continues,
 * hand control back to the player with AP refreshed, ability cooldowns
 * decremented, and the turn counter advanced.
 */
function endPlayerTurn(state: RunState, rng: Mulberry32): TurnResult {
  const effects: Effect[] = [{ type: 'phaseChanged', from: 'player', to: 'enemy' }];

  const enemyPhase = resolveEnemyPhase({ ...state, phase: 'enemy' }, rng);
  effects.push(...enemyPhase.effects);

  const hpBeforeTick = enemyPhase.state.player.hp;
  const ticked = tickStatuses(enemyPhase.state);
  effects.push(...ticked.effects);

  const diedFromTick = hpBeforeTick > 0 && ticked.state.player.hp <= 0;
  const outcome = detectOutcome(ticked.state, diedFromTick ? 'status_tick' : 'enemy_kill');
  effects.push(...outcome.effects);

  // Terminal outcome (defeat / floor_complete / victory) — combat is over.
  if (outcome.state.phase !== 'enemy') {
    return ok(outcome.state, effects);
  }

  const nextPlayer = {
    ...outcome.state.player,
    ap: effectiveMaxAp(outcome.state.player),
    abilities: outcome.state.player.abilities.map((s) => ({
      ...s,
      cooldownRemaining: Math.max(0, s.cooldownRemaining - 1),
    })),
  };
  effects.push({ type: 'phaseChanged', from: 'enemy', to: 'player' });

  return ok(
    { ...outcome.state, player: nextPlayer, phase: 'player', turn: outcome.state.turn + 1 },
    effects,
  );
}

function applySurrender(
  state: RunState,
  _action: SurrenderAction,
  _rng: Mulberry32,
): TurnResult {
  if (state.phase === 'defeat') return err(state, 'ALREADY_SURRENDERED', 'already in defeat phase');
  return ok({ ...state, phase: 'defeat' }, [{ type: 'defeat', cause: 'surrender' }]);
}

function dispatch(state: RunState, action: Action, rng: Mulberry32): TurnResult {
  switch (action.type) {
    case 'move':       return applyMove(state, action, rng);
    case 'attack':     return applyAttack(state, action, rng);
    case 'useAbility': return applyUseAbility(state, action, rng);
    case 'useItem':    return applyUseItem(state, action, rng);
    case 'wait':       return applyWait(state, action, rng);
    case 'endTurn':    return applyEndTurn(state, action, rng);
    case 'surrender':  return applySurrender(state, action, rng);
  }
}

export const TurnEngine = {
  apply(state: RunState, action: Action, rng: Mulberry32): TurnResult {
    const result = dispatch(state, action, rng);
    if (result.errors.length > 0) return result;

    // Win/loss/floor-complete detection after every successful action — e.g. a
    // killing blow that clears the last enemy ends the floor immediately
    // (idempotent if the handler already set a terminal phase). A move that ended
    // on a hazard tile attributes a player death to `hazard` (GDD §6.7 enum).
    const cause = action.type === 'move' && tileAt(result.state.grid, result.state.player.pos) === 'hazard'
      ? 'hazard'
      : 'enemy_kill';
    const outcome = detectOutcome(result.state, cause);
    if (outcome.effects.length === 0) return result;
    return { state: outcome.state, effects: [...result.effects, ...outcome.effects], errors: [] };
  },
};
