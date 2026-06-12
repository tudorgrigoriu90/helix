import type { RunState } from '@shared-types/run-state';
import { FLOOR_VEIN_CONSTANT } from '../economy';
import { buildEncounterState } from './encounter';
import { hashString, roomById, type SessionConfig, type SessionState } from './run-session-types';
import * as economy from './session-economy';
import * as strand from './session-strand';

/**
 * Run-session combat orchestration (T-520): entering an encounter, the
 * mid-fight save sync, and applying the terminal result (rewards + the
 * boss-clear floor transition). Pure delegation target of the
 * {@link import('./run-session').RunSession} facade — same behaviour as the
 * pre-decomposition monolith.
 */

/** True when the current room holds a fight the player hasn't cleared yet. */
export function needsCombat(st: SessionState): boolean {
  return !st.cleared.has(st.current) && roomById(st, st.current).enemies.length > 0;
}

/**
 * Builds the combat RunState for the current room, or returns null if the
 * room needs no fight (already cleared / no enemies). On a real encounter the
 * session enters `in_combat` until {@link endEncounter}.
 */
export function beginEncounter(cfg: SessionConfig, st: SessionState): RunState | null {
  if (st.status !== 'exploring') {
    throw new Error(`beginEncounter: not exploring (status: ${st.status})`);
  }
  if (!needsCombat(st)) return null;
  st.status = 'in_combat';
  const seed =
    (cfg.masterSeed ^ Math.imul(st.floorNumber, 0x85ebca6b) ^ hashString(st.current)) >>> 0;
  return buildEncounterState({
    room: roomById(st, st.current),
    registry: cfg.registry,
    player: st.player,
    floorNumber: st.floorNumber,
    seed,
  });
}

/**
 * The save-on-action hook (T-114, TDD §5.5): the scene calls this after every
 * combat action with the new state and the combat RNG's state word, so a save
 * taken mid-fight captures exact progress (and resumes deterministically).
 */
export function syncCombat(st: SessionState, state: RunState, rngState: number): void {
  if (st.status !== 'in_combat') {
    throw new Error(`syncCombat: not in combat (status: ${st.status})`);
  }
  st.combatState = state;
  st.combatRngState = rngState >>> 0;
}

/** Applies a terminal combat result: carry the player, clear the room, or end the run. */
export function endEncounter(cfg: SessionConfig, st: SessionState, finalState: RunState): void {
  if (st.status !== 'in_combat') {
    throw new Error(`endEncounter: not in combat (status: ${st.status})`);
  }
  // The encounter is over — drop the persisted combat state.
  st.combatState = null;
  st.combatRngState = 0;
  if (finalState.phase === 'defeat') {
    st.player = finalState.player;
    st.status = 'defeat';
    return;
  }
  if (finalState.phase !== 'floor_complete' && finalState.phase !== 'victory') {
    throw new Error(`endEncounter: combat is not terminal (phase: ${finalState.phase})`);
  }

  // Win: persist the player (statuses don't survive leaving the room), clear the room.
  st.player = { ...finalState.player, statuses: [] };
  st.cleared.add(st.current);

  // Kill rewards (Economy.xlsx): every defeated enemy drops VEIN (T-110) and
  // grants XP (T-111) by tier; item drops roll onto the pending pile (T-445).
  economy.bankVein(cfg, st, economy.veinFromKills(finalState.enemies, cfg.registry));
  economy.grantXp(st, economy.xpFromKills(finalState.enemies, cfg.registry));
  economy.rollKillLoot(cfg, st, finalState.enemies);

  if (st.current === st.floorData.bossRoomId) {
    // Floor loot: the ambient per-floor VEIN constant (loot rooms, GDD §9) banks
    // once the floor's boss falls.
    economy.bankVein(cfg, st, FLOOR_VEIN_CONSTANT);
    if (st.floorNumber >= cfg.finalFloor) st.status = 'victory';
    else if (strand.strandEventDue(cfg, st)) st.status = 'strand_event';
    else if (strand.protoStrandDue(cfg, st)) st.status = 'strand_event'; // DR-009b
    else st.status = 'floor_complete';
  } else {
    st.status = 'exploring';
  }
}
