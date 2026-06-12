import type { MutationDef } from '@shared-types/mutation';
import { makeRng } from '../rng/mulberry32';
import {
  drawMutationCards,
  rerollCard,
  applyMutation,
  resolveStrandEvent,
  gainMutationSig,
  unlockedDominantTraits,
  type StrandOutcome,
} from '../mutation';
import { bankVein } from './session-economy';
import type { SessionConfig, SessionState } from './run-session-types';

/**
 * Run-session Strand Event subsystem (T-520): the post-boss mutation draw
 * (GDD §5), the VEIN Intermission at the cap, and the out-of-cadence mutation
 * grants (tutorial / LACE event rooms). Pure delegation target of the
 * {@link import('./run-session').RunSession} facade — same behaviour as the
 * pre-decomposition monolith.
 */

/** True when this floor's boss clear should open a Strand Event. Floor 0 is
 *  excluded — its Strand is the scripted tutorial room, not the boss cadence. */
export function strandEventDue(cfg: SessionConfig, st: SessionState): boolean {
  return cfg.mutationPool.length > 0 && st.floorNumber >= 1 && st.floorNumber % cfg.strandInterval === 0;
}

/** The owned mutations resolved to their defs (for weighting + application). */
export function ownedMutationDefs(cfg: SessionConfig, st: SessionState): MutationDef[] {
  const byId = new Map(cfg.mutationPool.map((m) => [m.id, m]));
  return st.player.mutations.flatMap((id) => {
    const def = byId.get(id);
    return def === undefined ? [] : [def];
  });
}

/**
 * Opens the current floor's Strand Event, returning whether it's a card draw
 * or a VEIN Intermission (at the mutation cap). Idempotent for the floor — the
 * offer is computed once (deterministically from the seed) and cached, so the
 * scene can call it freely and it survives a resume.
 */
export function beginStrandEvent(cfg: SessionConfig, st: SessionState): StrandOutcome {
  if (st.status !== 'strand_event') {
    throw new Error(`beginStrandEvent: not at a Strand Event (status: ${st.status})`);
  }
  if (st.strandOutcome !== null) return st.strandOutcome;

  const owned = ownedMutationDefs(cfg, st);
  const outcome = resolveStrandEvent(owned.length);
  if (outcome.kind === 'draw') {
    st.strandRng = makeRng((cfg.masterSeed ^ Math.imul(st.floorNumber, 0x9e3779b1)) >>> 0, 'mutationdraw');
    st.strandCards = drawMutationCards({
      pool: cfg.mutationPool,
      owned,
      floor: st.floorNumber,
      rng: st.strandRng,
    });
  }
  st.strandOutcome = outcome;
  return outcome;
}

/** Rerolls one offered card on the same RNG sub-stream (GDD §5.4 Rule 5). */
export function rerollStrandCard(cfg: SessionConfig, st: SessionState, index: number): void {
  if (st.status !== 'strand_event' || st.strandRng === null) {
    throw new Error('rerollStrandCard: no active Strand Event draw');
  }
  st.strandCards = rerollCard({
    offer: st.strandCards,
    index,
    pool: cfg.mutationPool,
    owned: ownedMutationDefs(cfg, st),
    rng: st.strandRng,
  });
}

/** Takes a card: applies its mutation, accrues SIG, then ends the event. */
export function chooseStrandMutation(cfg: SessionConfig, st: SessionState, mutationId: string): void {
  if (st.status !== 'strand_event') {
    throw new Error(`chooseStrandMutation: not at a Strand Event (status: ${st.status})`);
  }
  const card = st.strandCards.find((c) => c.mutation.id === mutationId);
  if (card === undefined) {
    throw new Error(`chooseStrandMutation: "${mutationId}" is not in the current offer`);
  }
  st.player = applyMutation(st.player, card.mutation);
  st.sig = gainMutationSig(st.sig, card.mutation, 'strand');
  refreshDominantTraits(cfg, st);
  endStrandEvent(st);
}

/**
 * Applies a mutation chosen *outside* the post-boss Strand flow — the scripted
 * Floor 0 tutorial Strand (T-140) and LACE event rooms (GDD §18.6). Carries the
 * mutation onto the run player, accrues SIG at the room rate, and refreshes
 * Dominant Traits — the same effects as a Strand pick, without the cadence gate.
 */
export function applyMutationChoice(cfg: SessionConfig, st: SessionState, mutation: MutationDef): void {
  st.player = applyMutation(st.player, mutation);
  st.sig = gainMutationSig(st.sig, mutation, 'lace_event');
  refreshDominantTraits(cfg, st);
}

/** Acknowledges a VEIN Intermission: banks its VEIN Crystals, ends the event. */
export function acceptIntermission(cfg: SessionConfig, st: SessionState): void {
  if (st.status !== 'strand_event') {
    throw new Error(`acceptIntermission: not at a Strand Event (status: ${st.status})`);
  }
  const outcome = beginStrandEvent(cfg, st);
  if (outcome.kind === 'intermission') bankVein(st, outcome.veinCrystals);
  endStrandEvent(st);
}

export function endStrandEvent(st: SessionState): void {
  st.strandRng = null;
  st.strandOutcome = null;
  st.strandCards = [];
  st.status = 'floor_complete';
}

/** Recomputes the active Dominant Trait families onto the player (GDD §5.5) so
 *  the turn engine can read trait effects without a content registry. */
export function refreshDominantTraits(cfg: SessionConfig, st: SessionState): void {
  const families = unlockedDominantTraits(ownedMutationDefs(cfg, st)).map((t) => t.family);
  st.player = { ...st.player, dominantTraits: families };
}
