import type { LaceContext, LaceLine, LaceMood } from '@shared-types/lace-line';
import type { Mulberry32 } from '../rng/mulberry32';
import { LaceMoodMachine, type MoodPressure, type MoodSignal } from './lace-mood';
import { selectLine } from './lace-select';

/**
 * LACE narrator — the stateful run-scoped wrapper around {@link selectLine},
 * carrying the "spoken-this-run" tracker (T-103) and the mood state machine
 * (T-99). The scene calls {@link narrate} on run events; the narrator selects a
 * line for the *current mood*, records it so it won't repeat this run, and
 * returns it (or null when the pools are dry). Player behaviour feeds the mood
 * via {@link signalMood}.
 *
 * {@link reset} clears the spoken set on death / new run (TDD §9.3) — but *not*
 * the mood, which persists across runs and only drifts toward neutral over time
 * (TDD §9.4; persistence + drift land in T-100).
 */
export class LaceNarrator {
  private readonly lines: readonly LaceLine[];
  private readonly rng: Mulberry32;
  private readonly moodMachine: LaceMoodMachine;
  private spoken = new Set<string>();

  constructor(lines: readonly LaceLine[], rng: Mulberry32, moodMachine: LaceMoodMachine = new LaceMoodMachine()) {
    this.lines = lines;
    this.rng = rng;
    this.moodMachine = moodMachine;
  }

  /** Feed a player-behaviour signal to the mood machine; returns the new mood. */
  signalMood(signal: MoodSignal): LaceMood {
    return this.moodMachine.signal(signal);
  }

  /** LACE's current mood (drives which lines {@link narrate} prefers). */
  get mood(): LaceMood {
    return this.moodMachine.mood;
  }

  /** Accumulated mood pressures — the unit T-100 persists across runs. */
  get moodPressures(): MoodPressure {
    return this.moodMachine.pressures;
  }

  /** Selects + records a line for the given event, or null if none remain. */
  narrate(context: LaceContext): LaceLine | null {
    const line = selectLine(this.lines, { context, mood: this.mood, spoken: this.spoken, rng: this.rng });
    if (line !== null) this.spoken.add(line.id);
    return line;
  }

  /** Clears the spoken-this-run tracker (death / new run). Mood is unaffected. */
  reset(): void {
    this.spoken = new Set<string>();
  }

  get spokenIds(): readonly string[] {
    return [...this.spoken];
  }
}
