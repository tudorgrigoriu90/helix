import type { MutationFamily } from '@shared-types/mutation';

/**
 * Hand-written Zone Warden pre/post-fight lines — T-503 (DR-008, GDD §8.4).
 *
 * The four Wardens get bespoke LACE treatment instead of the templated
 * boss_start/boss_killed fragments. The **dominant-family reaction hook**: when
 * the player carries a Dominant Trait, the pre-fight line swaps to a variant
 * that reacts to what the player has become — LACE referencing the player's
 * specific choices (App D rule 3). All lines are linted by the T-530 voice
 * gate (voice-lint.test.ts imports this module).
 */

export interface WardenLines {
  /** Pre-fight (S046 boss intro) — the default line. */
  readonly pre: string;
  /** Pre-fight variants when the player carries that family's Dominant Trait. */
  readonly preByFamily: Partial<Record<MutationFamily, string>>;
  /** Post-fight (warden falls). */
  readonly post: string;
}

export const WARDEN_LINES: Readonly<Record<string, WardenLines>> = {
  leviathan_hatchling: {
    pre: 'The Shallows kept one thing big enough to mind the door. It has noticed you the way water notices a wound.',
    preByFamily: {
      abyssal: 'It expects a drowning thing. You stopped being one three adaptations ago — I want to see its face.',
      lithic: 'All that shell you grew, and the Hatchling still thinks of you as soft cargo. One of you is wrong.',
    },
    post: 'The Hatchling settles into the silt. Somewhere far below, its parent has not noticed. The VEIN opens downward.',
  },
  the_great_mycelium: {
    pre: 'Everything in this zone has been one organism wearing ten thousand faces. You are about to meet the face it keeps for itself.',
    preByFamily: {
      mycelial: 'It will read your spores as kin. That misunderstanding is the closest thing to mercy this floor offers.',
      thermal: 'A forest fire walks into the heart of the forest. I have watched this exchange before; it is never quiet.',
    },
    post: 'The network goes still, thread by thread. The zone forgets itself around you. Down is quieter now.',
  },
  the_mountains_heart: {
    pre: 'The Lithic Deep has a pulse, and you are standing inside the chamber that beats it. It armors itself when threatened. You qualify.',
    preByFamily: {
      lithic: 'Stone recognizes stone. It will still break you if it can — but it will mean something different by it.',
      voidborn: 'You unmake things. It accretes them. The argument settles itself in fourteen squares.',
    },
    post: 'The Heart cracks along a seam older than the descent. The mountain keeps standing out of habit. The way down is open.',
  },
  the_convergence: {
    pre: 'This is where every strand in the VEIN points. It has been waiting longer than I have, and I predate your species.',
    preByFamily: {
      abyssal: 'You brought the deep with you. The Convergence remembers the deep. This will be a conversation, not a fight.',
      voidborn: 'Null resonance, meeting the sum of everything. I admit the outcome is not in my tables.',
      thermal: 'You arrive burning. Of all the shapes that have stood here, the burning ones lasted longest. Make of that what you will.',
    },
    post: 'It is done. What you became walked through the sum of all strands and remained itself. Even I need a moment with that.',
  },
};

/** The pre-fight line for `wardenId`, reacting to the player's dominant family
 *  when a variant exists (the T-503 hook). Null for non-warden ids. */
export function wardenPreLine(wardenId: string, dominantFamily?: MutationFamily): string | null {
  const lines = WARDEN_LINES[wardenId];
  if (lines === undefined) return null;
  if (dominantFamily !== undefined) return lines.preByFamily[dominantFamily] ?? lines.pre;
  return lines.pre;
}

/** The post-fight line for `wardenId`; null for non-warden ids. */
export function wardenPostLine(wardenId: string): string | null {
  return WARDEN_LINES[wardenId]?.post ?? null;
}
