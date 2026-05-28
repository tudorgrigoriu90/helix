import type { ActiveStatus, RunState } from '@shared-types/run-state';
import type { Effect } from './effect';

// Per-turn HP deltas (GDD §6.5).
const BURN_DAMAGE = 5;
const OVERHEATED_DAMAGE = 8;
const REGEN_HEAL = 5;

export interface StatusTickResult {
  readonly state: RunState;
  readonly effects: readonly Effect[];
}

/**
 * Ticks every active status once: applies per-turn HP effects (Burn,
 * Overheated, Regenerating), then decrements all timers and expires those that
 * reach zero (GDD §6.5, TDD §5.3). Runs once per turn cycle on the player and
 * every living enemy.
 *
 * The non-damaging status *modifiers* (Infected −RES, Stagger −AP, Fractured
 * +dmg taken, Crushed move-range) are applied at their point of use as combat
 * integration lands; this step only handles ticking and expiry. Rooted's
 * move-block and Phased/Suppressed gating are enforced in the action handlers.
 */
export function tickStatuses(state: RunState): StatusTickResult {
  const effects: Effect[] = [];

  const p = tickOne(state.player.hp, state.player.maxHp, state.player.statuses, 'player', effects);
  const player = { ...state.player, hp: p.hp, statuses: p.statuses };

  const enemies = state.enemies.map((e) => {
    if (e.hp <= 0) return e;
    const r = tickOne(e.hp, e.maxHp, e.statuses, e.id, effects);
    return { ...e, hp: r.hp, statuses: r.statuses };
  });

  return { state: { ...state, player, enemies }, effects };
}

function tickOne(
  hp0: number,
  maxHp: number,
  statuses0: readonly ActiveStatus[],
  id: string,
  effects: Effect[],
): { hp: number; statuses: ActiveStatus[] } {
  let hp = hp0;

  for (const s of statuses0) {
    if (s.effect === 'burn' || s.effect === 'overheated') {
      const raw = s.effect === 'burn' ? BURN_DAMAGE : OVERHEATED_DAMAGE;
      const dealt = Math.min(hp, raw);
      hp -= dealt;
      effects.push({ type: 'damageDealt', targetId: id, amount: dealt, isCrit: false, damageType: 'thermal' });
    } else if (s.effect === 'regenerating') {
      const healed = Math.min(maxHp - hp, REGEN_HEAL);
      hp += healed;
      effects.push({ type: 'healingApplied', targetId: id, amount: healed });
    }
  }

  const statuses: ActiveStatus[] = [];
  for (const s of statuses0) {
    const turnsRemaining = s.turnsRemaining - 1;
    if (turnsRemaining > 0) statuses.push({ ...s, turnsRemaining });
    else effects.push({ type: 'statusExpired', targetId: id, status: s.effect });
  }

  if (hp <= 0 && hp0 > 0 && id !== 'player') {
    effects.push({ type: 'entityDied', entityId: id });
  }

  return { hp, statuses };
}
