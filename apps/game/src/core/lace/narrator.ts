import type { LaceContext, LaceLine, LaceMood } from '@shared-types/lace-line';
import type { Mulberry32 } from '../rng/mulberry32';
import { selectLine } from './lace-select';

/**
 * LACE narrator — the stateful run-scoped wrapper around {@link selectLine},
 * carrying the "spoken-this-run" tracker (T-103). The scene calls
 * {@link narrate} on run events; the narrator selects a line, records it so it
 * won't repeat this run, and returns it (or null when the pools are dry).
 *
 * {@link reset} clears the spoken set — call it on death / new run (TDD §9.3).
 * Mood is held here (default neutral); the full mood state machine is T-99.
 */
export class LaceNarrator {
  private readonly lines: readonly LaceLine[];
  private readonly rng: Mulberry32;
  private mood: LaceMood;
  private spoken = new Set<string>();

  constructor(lines: readonly LaceLine[], rng: Mulberry32, mood: LaceMood = 'neutral') {
    this.lines = lines;
    this.rng = rng;
    this.mood = mood;
  }

  setMood(mood: LaceMood): void {
    this.mood = mood;
  }

  /** Selects + records a line for the given event, or null if none remain. */
  narrate(context: LaceContext): LaceLine | null {
    const line = selectLine(this.lines, { context, mood: this.mood, spoken: this.spoken, rng: this.rng });
    if (line !== null) this.spoken.add(line.id);
    return line;
  }

  /** Clears the spoken-this-run tracker (death / new run). */
  reset(): void {
    this.spoken = new Set<string>();
  }

  get spokenIds(): readonly string[] {
    return [...this.spoken];
  }
}
