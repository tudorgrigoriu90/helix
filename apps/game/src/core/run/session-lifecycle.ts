import { Mulberry32 } from '../rng/mulberry32';
import { buildAdjacency, generateFloor } from '../floor-gen';
import {
  CURRENT_RUN_SESSION_SAVE_VERSION,
  autoClearIfTrivial,
  restIfSafe,
  type RunSessionSave,
  type SessionConfig,
  type SessionState,
} from './run-session-types';

/**
 * Run-session lifecycle (T-520): floor loading and the save/resume shape.
 * Pure delegation target of the {@link import('./run-session').RunSession}
 * facade — same behaviour as the pre-decomposition monolith.
 */

/** Per-floor RNG derived from the master seed — independent and deterministic. */
function floorRng(cfg: SessionConfig, n: number): Mulberry32 {
  return new Mulberry32((cfg.masterSeed ^ Math.imul(n, 0x9e3779b1)) >>> 0);
}

/** (Re)generates floor `n` and resets the per-floor state onto it. */
export function loadFloor(cfg: SessionConfig, st: SessionState, n: number): void {
  st.floorNumber = n;
  // Each floor uses its own template when one is supplied (zones drive the
  // enemy pool/boss/room mix), falling back to the base template otherwise.
  const template = cfg.floorTemplates.get(n) ?? cfg.template;
  // Floor 0 is the fixed tutorial floor (T-137); every other floor generates.
  st.floorData =
    n === 0 && cfg.floorZero !== null
      ? cfg.floorZero
      : generateFloor({ ...template, floor: n }, floorRng(cfg, n));
  st.adjacency = buildAdjacency(st.floorData.rooms, st.floorData.edges);
  st.current = st.floorData.startRoomId;
  st.cleared = new Set<string>();
  st.dispenserStockByRoom = new Map(); // fresh shelves each floor (GDD §10.3)
  st.combatState = null; // a new floor is never mid-combat
  st.combatRngState = 0;
  st.pendingLoot = []; // uncollected loot doesn't follow you down a floor
  st.checkpoint = null; // descending consumes the act-end checkpoint (DR-009)
  restIfSafe(st, st.current); // before auto-clear (once-per-room guard applies)
  autoClearIfTrivial(st, st.current);
  st.status = 'exploring';
}

/**
 * Serialisable snapshot for save/resume. When the scene has synced a live
 * encounter (T-114), an in-combat save carries the full combat state so the
 * run resumes mid-fight; otherwise an in-combat save degrades to resuming at
 * the room (exploring). A Strand Event is preserved — its offer regenerates
 * deterministically on resume.
 */
export function toSave(cfg: SessionConfig, st: SessionState): RunSessionSave {
  const persistCombat = st.status === 'in_combat' && st.combatState !== null;
  return {
    schemaVersion: CURRENT_RUN_SESSION_SAVE_VERSION,
    seed: cfg.masterSeed,
    floorNumber: st.floorNumber,
    currentRoomId: st.current,
    clearedRoomIds: [...st.cleared],
    status: st.status === 'in_combat' && !persistCombat ? 'exploring' : st.status,
    player: st.player,
    sig: st.sig,
    veinCrystals: st.veinCrystals,
    veinEarned: st.veinEarned,
    xp: st.xp,
    pendingStatPoints: st.pendingStatPoints,
    ...(persistCombat ? { combat: st.combatState!, combatRngState: st.combatRngState } : {}),
    ...(st.pendingLoot.length > 0 ? { pendingLoot: [...st.pendingLoot] } : {}),
    ...(st.checkpoint !== null ? { checkpoint: st.checkpoint } : {}),
    ...(st.bonusMutationTaken ? { bonusMutationTaken: true } : {}),
  };
}

/** Restores a saved run: regenerates the floor deterministically, then
 *  overlays the saved position, cleared set, player, status, currencies, and —
 *  when present — the live combat encounter (T-114). */
export function applySave(cfg: SessionConfig, st: SessionState, save: RunSessionSave): void {
  loadFloor(cfg, st, save.floorNumber);
  st.current = save.currentRoomId;
  st.cleared = new Set(save.clearedRoomIds);
  st.player = save.player;
  st.sig = save.sig ?? 0; // absent in v1 saves
  st.veinCrystals = save.veinCrystals ?? 0;
  st.xp = save.xp ?? 0; // absent in pre-v3 saves
  st.pendingStatPoints = save.pendingStatPoints ?? 0;
  // Pre-v4 saves lack veinEarned; fall back to the spendable balance as a
  // lower-bound estimate of income so resumed runs still convert some Shards.
  st.veinEarned = save.veinEarned ?? st.veinCrystals;
  st.pendingLoot = save.pendingLoot !== undefined ? [...save.pendingLoot] : [];
  // Pre-v7 saves lack the DR-009 checkpoint (T-510) — loadFloor cleared it.
  st.checkpoint = save.checkpoint ?? null;
  // Pre-v8 saves lack the DR-009b bonus slot (T-511) — treated as free.
  st.bonusMutationTaken = save.bonusMutationTaken ?? false;
  // A mid-combat save (v5+) carries the encounter; restore it so the run
  // resumes mid-fight. Otherwise an in-combat status degrades to exploring.
  if (save.status === 'in_combat' && save.combat !== undefined) {
    st.status = 'in_combat';
    st.combatState = save.combat;
    st.combatRngState = (save.combatRngState ?? 0) >>> 0;
  } else {
    st.status = save.status === 'in_combat' ? 'exploring' : save.status;
    st.combatState = null;
    st.combatRngState = 0;
  }
}
