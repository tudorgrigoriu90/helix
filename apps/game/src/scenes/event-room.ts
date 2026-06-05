/**
 * Pure Strand-Room event content + resolution (T-176, S024, GDD §6.1/§12.8).
 *
 * The Event Room is a LACE-narrated narrative beat: the player is shown an
 * anomaly and picks one of three responses, each with a known reward. The data
 * and the deterministic selection live here (Phaser-free, unit-tested); the
 * scene only draws it and applies the resolved {@link EventOutcome} to the run.
 *
 * Reward amounts are intentionally the same the room paid before this refactor,
 * so the run economy/balance is unchanged — this task is the *UI + content*
 * layer, not an economy change.
 */

/** What a choice grants. `sig` is currently a lesser VEIN grant (a richer SIG
 *  economy lands with T-282+); kept as its own kind so the copy can differ. */
export type EventReward = 'vein' | 'heal' | 'sig';

export interface EventChoice {
  readonly label: string;
  readonly desc: string;
  readonly reward: EventReward;
}

export interface EventDef {
  readonly id: string;
  readonly title: string;
  readonly sub: string;
  /** Always exactly three options (the S024 contract). */
  readonly choices: readonly EventChoice[];
}

/** VEIN granted by the bold choice. */
export const EVENT_VEIN_GRANT = 20;
/** VEIN granted by the cautious choice. */
export const EVENT_SIG_GRANT = 15;
/** Fraction of max HP restored by the patient choice. */
export const EVENT_HEAL_FRACTION = 0.25;

export const EVENT_DEFS: readonly EventDef[] = [
  {
    id: 'anomalous_signal',
    title: 'ANOMALOUS SIGNAL',
    sub: 'LACE detects a residual broadcast from before the first descent.',
    choices: [
      { label: 'TAP THE FREQUENCY', desc: '+20 VEIN Crystals — the signal rewards contact.', reward: 'vein' },
      { label: 'FILTER THE NOISE', desc: 'Recover 25% HP — discipline has its own dividend.', reward: 'heal' },
      { label: 'LOG AND LEAVE', desc: '+15 VEIN — prudence over curiosity.', reward: 'sig' },
    ],
  },
  {
    id: 'sealed_alcove',
    title: 'SEALED ALCOVE',
    sub: 'A recess in the wall, untouched. LACE cannot read what is inside.',
    choices: [
      { label: 'FORCE IT OPEN', desc: '+20 VEIN — whatever was sealed is now yours.', reward: 'vein' },
      { label: 'LISTEN FIRST', desc: 'Recover 25% HP — patience costs nothing here.', reward: 'heal' },
      { label: 'LEAVE IT SEALED', desc: '+15 VEIN — some debts stay closed.', reward: 'sig' },
    ],
  },
  {
    id: 'strand_echo',
    title: 'STRAND ECHO',
    sub: "A previous Sigma-carrier's mutation left an imprint in the floor.",
    choices: [
      { label: 'ABSORB THE ECHO', desc: '+20 VEIN — borrowed memory, real reward.', reward: 'vein' },
      { label: 'REINFORCE YOUR CELLS', desc: 'Recover 25% HP — your biology asserts itself.', reward: 'heal' },
      { label: 'PASS THROUGH QUICKLY', desc: '+15 VEIN — no inheritance today.', reward: 'sig' },
    ],
  },
];

/**
 * Pick an event for a room, deterministically from its id — so the same room on
 * the same seed always presents the same anomaly (and a save/resume is stable).
 */
export function pickEvent(roomId: string): EventDef {
  let sum = 0;
  for (const ch of roomId) sum += ch.charCodeAt(0);
  return EVENT_DEFS[sum % EVENT_DEFS.length]!;
}

export interface EventOutcome {
  readonly reward: EventReward;
  /** Concrete amount applied — VEIN crystals granted, or HP restored. */
  readonly amount: number;
  /** Headline shown on the resolved panel, e.g. "+20 VEIN CRYSTALS". */
  readonly headline: string;
  /** LACE voice line reacting to the choice. */
  readonly lace: string;
}

/**
 * Resolve a choice into its concrete outcome (amount + copy). The scene applies
 * `amount` via the matching RunSession method; this stays pure so the numbers
 * and the displayed copy can never disagree.
 */
export function resolveEvent(reward: EventReward, maxHp: number): EventOutcome {
  switch (reward) {
    case 'vein':
      return {
        reward, amount: EVENT_VEIN_GRANT, headline: `+${EVENT_VEIN_GRANT} VEIN CRYSTALS`,
        lace: 'The VEIN answers in kind. Crystals settle into your reserve.',
      };
    case 'heal': {
      const amount = Math.floor(maxHp * EVENT_HEAL_FRACTION);
      return {
        reward, amount, headline: `+${amount} HP RESTORED`,
        lace: 'Your cells knit back toward whole. The floor lets you breathe.',
      };
    }
    case 'sig':
      return {
        reward, amount: EVENT_SIG_GRANT, headline: `+${EVENT_SIG_GRANT} VEIN CRYSTALS`,
        lace: 'Caution keeps its small reward. You move on intact.',
      };
  }
}
