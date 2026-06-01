import type { LaceMood, LaceMoodPressure } from '@shared-types/lace-line';

/**
 * LACE mood state machine — T-99 (GDD §10.1, TDD §9.4).
 *
 * LACE's mood is a *deterministic* function of accumulated player-behaviour
 * signals — no RNG (TDD §9.4: "deterministic given player behavior history").
 * Each signal adds `pressure` to the mood it evokes; the active mood is the
 * highest-pressure mood once it clears {@link MOOD_THRESHOLD}, otherwise the
 * resting {@link RESTING_MOOD} (`neutral`).
 *
 * Accumulating pressure — rather than switching on a single event — is what
 * models the spec's "many defensive choices" / "death loops": one stray signal
 * doesn't flip LACE, a sustained pattern does. Strong, rare signals (Floor 16+,
 * Hybrid Synergy) carry enough weight to land the mood in a single hit.
 *
 * Persistence across runs and drift back toward neutral are layered on in T-100;
 * this module owns only the transition logic. The thresholds/weights below are
 * authored tuning — the design docs give the triggers, not the numbers.
 */

/** The resting baseline LACE relaxes toward when no mood dominates. */
export const RESTING_MOOD = 'neutral' satisfies LaceMood;

/** The five behaviour-driven moods (everything except the resting baseline). */
export type BehaviourMood = Exclude<LaceMood, 'neutral'>;

/** Player-behaviour signals that move LACE's mood (the GDD §10.1 trigger table). */
export type MoodSignal =
  | 'unexpected_build' // unexpected build choice          → curious
  | 'new_floor' //        first time reaching a new floor  → curious
  | 'defensive_play' //   optimal / safe / defensive play  → clinical
  | 'risky_play' //       risky / creative play            → amused
  | 'death_loop' //       repeated death to the same thing → contemptuous
  | 'deep_floor' //       Floor 16+ reached                → reverent
  | 'hybrid_synergy'; //  Hybrid Synergy unlocked          → reverent

/** Which mood each signal evokes, and how hard it pushes toward it. */
const SIGNALS: Readonly<Record<MoodSignal, { readonly mood: BehaviourMood; readonly weight: number }>> = {
  unexpected_build: { mood: 'curious', weight: 2 },
  new_floor: { mood: 'curious', weight: 1 },
  defensive_play: { mood: 'clinical', weight: 1 },
  risky_play: { mood: 'amused', weight: 1 },
  death_loop: { mood: 'contemptuous', weight: 2 },
  deep_floor: { mood: 'reverent', weight: 3 },
  hybrid_synergy: { mood: 'reverent', weight: 3 },
};

/** Pressure a mood must reach to overtake the resting baseline. */
export const MOOD_THRESHOLD = 3;

/**
 * Deterministic tie-break when two moods share the top pressure — the more
 * intense / rarer mood wins, so a single Floor-16 `reverent` isn't masked by an
 * equal pile of routine `curious`.
 */
const MOOD_PRIORITY: readonly BehaviourMood[] = ['reverent', 'contemptuous', 'amused', 'clinical', 'curious'];

/**
 * Accumulated pressure per behaviour-driven mood. Alias of the persisted
 * {@link LaceMoodPressure} contract (shared-types owns the serialised shape).
 */
export type MoodPressure = LaceMoodPressure;

/** A mood machine with no accumulated pressure — the resting state. */
export const ZERO_MOOD_PRESSURE: MoodPressure = { curious: 0, clinical: 0, amused: 0, contemptuous: 0, reverent: 0 };

/**
 * Fraction of each mood's pressure retained per drift step; the remainder
 * decays toward neutral (GDD §10.1: "drifts toward neutral over time"). Authored
 * tuning. At 0.5 a mood resting at the threshold falls below it after one quiet
 * run and reaches zero after two — intense moods fade proportionally slower.
 */
export const MOOD_DRIFT_RETENTION = 0.5;

/**
 * Drift mood pressures `steps` runs toward neutral (T-100). Deterministic: each
 * step multiplies by {@link MOOD_DRIFT_RETENTION} and floors, so pressure decays
 * to exactly zero rather than lingering asymptotically. Pure.
 */
export function driftPressure(pressure: MoodPressure, steps = 1): MoodPressure {
  const out = { ...ZERO_MOOD_PRESSURE } as Record<BehaviourMood, number>;
  for (const mood of Object.keys(out) as BehaviourMood[]) {
    let p = Math.max(0, pressure[mood]);
    for (let i = 0; i < steps; i++) p = Math.floor(p * MOOD_DRIFT_RETENTION);
    out[mood] = p;
  }
  return out;
}

/**
 * Stateful mood machine. Pure aside from its own accumulator — no RNG, no clock.
 * Seed it from a persisted {@link MoodPressure} (T-100) or start fresh.
 */
export class LaceMoodMachine {
  private readonly pressure: Record<BehaviourMood, number>;

  constructor(initial: Partial<MoodPressure> = {}) {
    this.pressure = { ...ZERO_MOOD_PRESSURE, ...initial };
  }

  /** Apply a behaviour signal and return the (possibly unchanged) current mood. */
  signal(signal: MoodSignal): LaceMood {
    const { mood, weight } = SIGNALS[signal];
    this.pressure[mood] += weight;
    return this.mood;
  }

  /** The active mood: the dominant pressure if it clears the threshold, else resting. */
  get mood(): LaceMood {
    let best: BehaviourMood | null = null;
    let bestScore = MOOD_THRESHOLD - 1; // a mood must strictly exceed this → reach MOOD_THRESHOLD
    for (const mood of MOOD_PRIORITY) {
      if (this.pressure[mood] > bestScore) {
        bestScore = this.pressure[mood];
        best = mood;
      }
    }
    return best ?? RESTING_MOOD;
  }

  /** Snapshot of accumulated pressures — the unit T-100 persists and drifts. */
  get pressures(): MoodPressure {
    return { ...this.pressure };
  }
}
