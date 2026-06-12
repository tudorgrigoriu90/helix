import type { MutationDef } from '@shared-types/mutation';
import { zoneForFloor } from '@shared-types/campaign';
import { makeRng } from '../rng/mulberry32';
import {
  drawMutationCards,
  drawProtoStrandCards,
  rerollCard,
  applyMutation,
  resolveStrandEvent,
  gainMutationSig,
  unlockedDominantTraits,
  type StrandOutcome,
} from '../mutation';
import { bankVein } from './session-economy';
import { PROTO_STRAND_FLOOR, type SessionConfig, type SessionState } from './run-session-types';

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

/** True when this floor's boss clear should open the Floor 2 Proto-Strand
 *  (DR-009b, T-511) — only when the floor isn't already a cadence floor. */
export function protoStrandDue(cfg: SessionConfig, st: SessionState): boolean {
  return (
    cfg.mutationPool.length > 0 &&
    st.floorNumber === PROTO_STRAND_FLOOR &&
    !strandEventDue(cfg, st)
  );
}

/** True while the open Strand Event is the Floor 2 Proto-Strand (DR-009b):
 *  2 Minor cards, uniform families, no reroll, +5 SIG, no S072 checkpoint. */
export function isProtoStrand(cfg: SessionConfig, st: SessionState): boolean {
  return st.status === 'strand_event' && protoStrandDue(cfg, st);
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
  // The Proto-Strand (DR-009b) is always a draw — at Floor 2 the mutation cap
  // is unreachable, and its offer is the 2-card Minor/uniform variant.
  if (isProtoStrand(cfg, st)) {
    st.strandRng = makeRng((cfg.masterSeed ^ Math.imul(st.floorNumber, 0x9e3779b1)) >>> 0, 'mutationdraw');
    st.strandCards = drawProtoStrandCards({ pool: cfg.mutationPool, owned, rng: st.strandRng });
    st.strandOutcome = { kind: 'draw' };
    return st.strandOutcome;
  }
  const outcome = resolveStrandEvent(owned.length);
  if (outcome.kind === 'draw') {
    st.strandRng = makeRng((cfg.masterSeed ^ Math.imul(st.floorNumber, 0x9e3779b1)) >>> 0, 'mutationdraw');
    // Early Adaptation (T-306): the first weighted card matches the family of
    // the most recently acquired mutation — meaningless with nothing owned.
    const lastFamily =
      cfg.strainFx.firstCardMatchesLastFamily && owned.length > 0
        ? owned[owned.length - 1]!.family
        : undefined;
    st.strandCards = drawMutationCards({
      pool: cfg.mutationPool,
      owned,
      floor: st.floorNumber,
      rng: st.strandRng,
      // Origin familyAffinity nudges cadence draws (T-301); the Proto-Strand
      // above stays uniform by design (DR-009b).
      affinity: cfg.origin?.perk.kind === 'familyAffinity' ? cfg.origin.perk.family : undefined,
      // True Convergence (T-306): one extra wild card on cadence draws only.
      extraWildCards: cfg.strainFx.extraWildCard ? 1 : 0,
      ...(lastFamily !== undefined ? { forceFirstFamily: lastFamily } : {}),
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
  if (isProtoStrand(cfg, st)) {
    throw new Error('rerollStrandCard: the Proto-Strand offers no reroll (DR-009b)');
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
  // A Proto-Strand pick fills the run's bonus slot at the +5 room rate
  // (DR-009b); a cadence pick grants the full +10 (DR-007).
  const proto = isProtoStrand(cfg, st);
  st.sig = gainMutationSig(st.sig, card.mutation, proto ? 'lace_event' : 'strand');
  if (proto) st.bonusMutationTaken = true;
  refreshDominantTraits(cfg, st);
  endStrandEvent(cfg, st);
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
  st.bonusMutationTaken = true; // the run's one bonus slot (DR-009b)
  refreshDominantTraits(cfg, st);
}

/** Acknowledges a VEIN Intermission: banks its VEIN Crystals, ends the event. */
export function acceptIntermission(cfg: SessionConfig, st: SessionState): void {
  if (st.status !== 'strand_event') {
    throw new Error(`acceptIntermission: not at a Strand Event (status: ${st.status})`);
  }
  const outcome = beginStrandEvent(cfg, st);
  if (outcome.kind === 'intermission') bankVein(cfg, st, outcome.veinCrystals);
  endStrandEvent(cfg, st);
}

export function endStrandEvent(cfg: SessionConfig, st: SessionState): void {
  // The Proto-Strand is an early taste, not an act end — no S072 checkpoint
  // (DR-009b). Decide before the status flips out of 'strand_event'.
  const proto = isProtoStrand(cfg, st);
  st.strandRng = null;
  st.strandOutcome = null;
  st.strandCards = [];
  st.status = 'floor_complete';
  // DR-009 (T-510): resolving a cadence Strand Event is the act-end pause
  // point — the player now chooses Descend or Rest (S072). The Floor 20
  // Warden never reaches here (it transitions straight to victory).
  if (!proto && st.floorNumber < cfg.finalFloor) {
    st.checkpoint = { floor: st.floorNumber, act: zoneForFloor(st.floorNumber) };
  }
}

/** Recomputes the active Dominant Trait families onto the player (GDD §5.5) so
 *  the turn engine can read trait effects without a content registry. */
export function refreshDominantTraits(cfg: SessionConfig, st: SessionState): void {
  const families = unlockedDominantTraits(ownedMutationDefs(cfg, st)).map((t) => t.family);
  st.player = { ...st.player, dominantTraits: families };
}
