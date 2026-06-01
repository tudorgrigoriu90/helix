import type { LaceContext, LaceLine, LaceMood, LacePlayerState } from '@shared-types/lace-line';
import type { MutationFamily } from '@shared-types/mutation';
import type { Mulberry32 } from '../rng/mulberry32';
import { assembleLine, type LaceGrammar } from './lace-grammar';
import { LaceMoodMachine, type MoodPressure, type MoodSignal } from './lace-mood';
import { selectLine } from './lace-select';

/** Optional event detail that sharpens line selection / grammar assembly. */
export interface NarrateContextDetail {
  /** The run's dominant mutation family (selects family-flavoured grammar fragments). */
  readonly family?: MutationFamily;
  /** The player's health/standing bucket. */
  readonly state?: LacePlayerState;
}

/**
 * LACE narrator — the stateful run-scoped wrapper around {@link selectLine},
 * carrying the "spoken-this-run" tracker (T-103) and the mood state machine
 * (T-99). The scene calls {@link narrate} on run events; the narrator selects a
 * line for the *current mood*, records it so it won't repeat this run, and
 * returns it. Player behaviour feeds the mood via {@link signalMood}.
 *
 * When the authored pools are dry, an optional templated-grammar corpus (T-101,
 * DR-004 Layer 1) assembles a line as the fallback layer — so the narrator only
 * returns null when neither an authored line nor the grammar can produce one.
 *
 * {@link reset} clears the spoken set on death / new run (TDD §9.3) — but *not*
 * the mood, which persists across runs and only drifts toward neutral over time
 * (TDD §9.4 / T-100).
 */
export class LaceNarrator {
  private readonly lines: readonly LaceLine[];
  private readonly rng: Mulberry32;
  private readonly moodMachine: LaceMoodMachine;
  private readonly grammar?: LaceGrammar;
  private spoken = new Set<string>();

  constructor(
    lines: readonly LaceLine[],
    rng: Mulberry32,
    moodMachine: LaceMoodMachine = new LaceMoodMachine(),
    grammar?: LaceGrammar,
  ) {
    this.lines = lines;
    this.rng = rng;
    this.moodMachine = moodMachine;
    this.grammar = grammar;
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

  /**
   * Selects + records an authored line for the event; if the authored pools are
   * dry, assembles one from the grammar corpus (T-101). Returns null only when
   * neither layer can produce a line. Grammar lines are regenerative, so they're
   * not added to the spoken-this-run tracker.
   */
  narrate(context: LaceContext, detail: NarrateContextDetail = {}): LaceLine | null {
    const line = selectLine(this.lines, { context, mood: this.mood, spoken: this.spoken, rng: this.rng });
    if (line !== null) {
      this.spoken.add(line.id);
      return line;
    }
    if (this.grammar !== undefined) {
      const text = assembleLine(this.grammar, {
        context,
        mood: this.mood,
        family: detail.family,
        state: detail.state,
        rng: this.rng,
      });
      if (text !== null) return { id: `grammar:${context}`, text, context, mood: this.mood, weight: 1 };
    }
    return null;
  }

  /** Clears the spoken-this-run tracker (death / new run). Mood is unaffected. */
  reset(): void {
    this.spoken = new Set<string>();
  }

  get spokenIds(): readonly string[] {
    return [...this.spoken];
  }
}
