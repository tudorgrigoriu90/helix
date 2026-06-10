/**
 * LACE voice linter — T-330 (GDD Appendix D dialogue guidelines).
 *
 * Mechanical enforcement of the parts of the voice bible a regex can hold:
 *
 *   1. **No exclamation marks** — LACE's sentences are clean and measured.
 *   2. **No banned phrases** — "Good job" / "Well done" / "You died" /
 *      "try again" / "You win" (LACE has no stake in the outcome), and the
 *      UI words "tap" / "button" / "screen" (LACE narrates the VEIN, not the
 *      phone).
 *   3. **No command-mood openings** — LACE never commands; a sentence that
 *      opens with an imperative ("Walk to the door.") fails.
 *   4. **Contraction budget** — LACE rarely uses contractions; the corpus
 *      gate keeps the rate under {@link CONTRACTION_RATE_MAX} so "rarely"
 *      stays true as lines accumulate.
 *
 * Pure and Phaser-free; the content gate (lace-voice.content.test.ts) runs it
 * over every shipped line bundle via `pnpm validate`.
 */

export interface VoiceViolation {
  /** The offending line's id. */
  readonly id: string;
  readonly rule: 'exclamation' | 'banned_phrase' | 'command_opening';
  readonly detail: string;
}

/** Phrases LACE never says (GDD App D) + UI vocabulary it cannot know. */
const BANNED_PHRASES: readonly RegExp[] = [
  /good job/i,
  /well done/i,
  /you died/i,
  /try again/i,
  /you win/i,
  /\btap\b/i,
  /\bbutton\b/i,
  /\bscreen\b/i,
];

/** Imperative verbs that open a command — LACE does not say "do this". */
const COMMAND_OPENERS: ReadonlySet<string> = new Set([
  'walk', 'go', 'run', 'move', 'keep', 'stop', 'wait', 'rest', 'hurry',
  'choose', 'pick', 'select', 'take', 'grab', 'drop', 'use', 'press', 'tap',
  'click', 'strike', 'attack', 'fight', 'kill', 'look', 'listen', 'watch',
  'follow', 'stay', 'hold', 'try', 'remember', 'breathe', 'focus',
  'do', "don't",
]);

/** Unambiguous contraction shapes (possessive "'s" is deliberately excluded;
 *  the common "it's / that's / …" id-pronoun forms are listed explicitly). */
const CONTRACTION = /\b\w+'(?:t|re|ll|ve|d|m)\b|\b(?:it|that|there|what|here|who|let)'s\b/i;

/** Corpus-level ceiling on the fraction of lines containing a contraction. */
export const CONTRACTION_RATE_MAX = 0.15;

/** Splits a line into sentences for the command-opening check. */
function sentences(text: string): string[] {
  return text
    .split(/[.?!…]+/)
    .map((s) => s.replace(/^[\s"'“”—–-]+/, '').trim())
    .filter((s) => s.length > 0);
}

/** Lints one line against the per-line rules (1–3). */
export function lintLaceText(id: string, text: string): VoiceViolation[] {
  const out: VoiceViolation[] = [];

  if (text.includes('!')) {
    out.push({ id, rule: 'exclamation', detail: 'LACE does not use exclamation marks' });
  }

  for (const phrase of BANNED_PHRASES) {
    const match = text.match(phrase);
    if (match !== null) {
      out.push({ id, rule: 'banned_phrase', detail: `banned phrase "${match[0]}"` });
    }
  }

  for (const sentence of sentences(text)) {
    const first = sentence.split(/\s+/)[0]?.toLowerCase() ?? '';
    if (COMMAND_OPENERS.has(first)) {
      out.push({ id, rule: 'command_opening', detail: `command-mood opening "${sentence.split(/\s+/).slice(0, 3).join(' ')}…"` });
    }
  }

  return out;
}

/** True when the line contains a contraction (the corpus budget unit). */
export function hasContraction(text: string): boolean {
  return CONTRACTION.test(text);
}

export interface CorpusLintResult {
  readonly violations: readonly VoiceViolation[];
  /** Fraction of lines containing a contraction. */
  readonly contractionRate: number;
}

/** Lints a whole line corpus: per-line rules + the corpus contraction budget. */
export function lintLaceCorpus(lines: readonly { readonly id: string; readonly text: string }[]): CorpusLintResult {
  const violations = lines.flatMap((l) => lintLaceText(l.id, l.text));
  const withContraction = lines.filter((l) => hasContraction(l.text)).length;
  return {
    violations,
    contractionRate: lines.length === 0 ? 0 : withContraction / lines.length,
  };
}
