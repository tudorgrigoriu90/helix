import type { MutationDef, MutationFamily } from '@shared-types/mutation';
import type { Mulberry32 } from '../rng/mulberry32';
import type { DrawnCard } from './card-draw';

/**
 * Proto-Strand draw — T-311 (DR-009b, GDD §5.4 Rule 6, UFD 04 amendment).
 *
 * The Floor 2 Proto-Strand is a reduced Strand Event that puts the run's first
 * build choice inside the first ~10 minutes: **two cards, Minor tier only,
 * families drawn uniformly** (no ownership weighting this early), **no
 * reroll**. The pick grants +5 SIG and fills the run's bonus mutation slot
 * (shared with the LACE event-room mutation — max one bonus per run).
 *
 * Deterministic: the only entropy is the supplied `mutationdraw` sub-generator,
 * mirroring the main card draw (T-85). A thin pool degrades to fewer cards
 * rather than repeating or throwing.
 */

/** The Proto-Strand always offers two cards (DR-009b). */
export const PROTO_STRAND_CARD_COUNT = 2;

/** The floor whose boss clear triggers the Proto-Strand (DR-009b). */
export const PROTO_STRAND_FLOOR = 2;

export interface ProtoStrandParams {
  /** Every mutation that can be offered (the loaded content registry). */
  readonly pool: readonly MutationDef[];
  /** Mutations the player already owns — excluded from the draw. */
  readonly owned: readonly MutationDef[];
  /** The `mutationdraw` sub-generator — `makeRng(seed, 'mutationdraw')`. */
  readonly rng: Mulberry32;
}

/** Draws the Proto-Strand offer: up to two distinct unowned Minor mutations,
 *  family sampled uniformly among families that still have candidates. */
export function drawProtoStrandCards(params: ProtoStrandParams): DrawnCard[] {
  const ownedIds = new Set(params.owned.map((m) => m.id));
  const candidates = params.pool.filter((m) => m.tier === 'minor' && !ownedIds.has(m.id));

  const cards: DrawnCard[] = [];
  for (let i = 0; i < PROTO_STRAND_CARD_COUNT; i++) {
    const drawnIds = new Set(cards.map((c) => c.mutation.id));
    const remaining = candidates.filter((m) => !drawnIds.has(m.id));
    if (remaining.length === 0) break;

    // Uniform over families first, then uniform within the family — so a
    // family with many Minors is no likelier than a sparse one.
    const byFamily = new Map<MutationFamily, MutationDef[]>();
    for (const m of remaining) {
      const list = byFamily.get(m.family) ?? [];
      list.push(m);
      byFamily.set(m.family, list);
    }
    const families = [...byFamily.keys()].sort();
    const family = families[params.rng.nextInt(families.length)]!;
    const inFamily = byFamily.get(family)!;
    const mutation = inFamily[params.rng.nextInt(inFamily.length)]!;

    cards.push({ mutation, slot: 'wild', tier: 'minor' });
  }
  return cards;
}
