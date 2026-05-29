import type { MutationTier } from '@shared-types/mutation';
import { STRAND_CARD_COUNT } from './constants';

/**
 * Tier progression — T-88 (GDD §5.4 Rule 3).
 *
 * Strand Events fire every five floors; the tier mix of the three offered cards
 * escalates with depth:
 *
 *   - **Floor 5–9:**  3× Minor
 *   - **Floor 10–14:** 2× Minor + 1× Major
 *   - **Floor 15+:**   1× Minor + 1× Major + 1× Dominant
 *
 * The escalating tier lands on the *last* slot(s) — i.e. the wild card is the
 * one that becomes Major then Dominant — so the rarest tier rides the
 * full-random slot. Returned array length always equals {@link STRAND_CARD_COUNT}.
 */

/** First floor whose Strand Event includes a Major card. */
export const STRAND_MAJOR_FLOOR = 10;
/** First floor whose Strand Event includes a Dominant card. */
export const STRAND_DOMINANT_FLOOR = 15;

export function tiersForFloor(floor: number): readonly MutationTier[] {
  if (floor >= STRAND_DOMINANT_FLOOR) return ['minor', 'major', 'dominant'];
  if (floor >= STRAND_MAJOR_FLOOR) return ['minor', 'minor', 'major'];
  return Array.from({ length: STRAND_CARD_COUNT }, () => 'minor' as MutationTier);
}
