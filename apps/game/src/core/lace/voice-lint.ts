import type { LaceLine } from '@shared-types/lace-line';

/**
 * LACE voice linter — T-530 (GDD Appendix D, the voice bible).
 *
 * Machine-checks the rules a writer (or a templated fragment generator) can
 * silently break:
 *
 *   1. **No exclamation marks** (bible rule 6).
 *   2. **No command-mood openings** (rule 2 — LACE never commands): a sentence
 *      may not open with a bare imperative from the banned-verb list.
 *   3. **Banned phrases** (the "what LACE never says" list, plus meta-UI words
 *      — LACE narrates a place, not an app): "good job", "well done",
 *      "you died", "try again", "you win", "tap", "button", "screen".
 *   4. **Contractions stay rare** (rule 6) — a *corpus-level* ceiling rather
 *      than a per-line ban, because "when LACE uses one, something unusual is
 *      happening" is a frequency property.
 *
 * Wired into `pnpm validate` via voice-lint.test.ts so a violating line fails
 * CI the moment it's authored.
 */

export interface VoiceLintIssue {
  /** Offending line id (or a caller-supplied label for ad-hoc text). */
  readonly id: string;
  readonly rule: 'exclamation' | 'command_opening' | 'banned_phrase';
  readonly detail: string;
}

/** Imperatives that read as commands when they open a sentence (rule 2). */
const COMMAND_OPENERS = new Set([
  'go', 'walk', 'run', 'move', 'press', 'tap', 'click', 'choose', 'pick',
  'select', 'take', 'grab', 'use', 'attack', 'fight', 'kill', 'open', 'stop',
  'hurry', 'try', 'do',
]);

/** "What LACE never says" (GDD App D) + meta-UI vocabulary. */
const BANNED_PHRASES: readonly RegExp[] = [
  /\bgood job\b/i,
  /\bwell done\b/i,
  /\byou died\b/i, // LACE says "the strand severed" / "adaptation failed"
  /\btry again\b/i,
  /\byou win\b/i,
  /\btap\b/i,
  /\bbutton\b/i,
  /\bscreen\b/i,
];

/** Sentence-initial words: the first word of the text and of each sentence. */
function sentenceOpeners(text: string): string[] {
  return text
    .split(/[.!?…]+\s+/)
    .map((sentence) => /[a-z']+/i.exec(sentence)?.[0]?.toLowerCase() ?? '')
    .filter((w) => w.length > 0);
}

/** True when the text contains a contraction (possessive 's excluded). */
export function hasContraction(text: string): boolean {
  return (
    /\b\w+n't\b/i.test(text) || // don't / won't / hasn't …
    /'(re|ll|ve|m|d)\b/i.test(text) || // you're / it'll / I've / I'm / he'd
    /\b(it|that|there|what|who|here)'s\b/i.test(text) // …'s as "is", not possessive
  );
}

/** Lints one line against the per-line rules (1–3). */
export function lintLaceText(id: string, text: string): VoiceLintIssue[] {
  const issues: VoiceLintIssue[] = [];

  if (text.includes('!')) {
    issues.push({ id, rule: 'exclamation', detail: 'LACE never uses exclamation marks (App D rule 6)' });
  }

  for (const opener of sentenceOpeners(text)) {
    if (COMMAND_OPENERS.has(opener)) {
      issues.push({
        id,
        rule: 'command_opening',
        detail: `sentence opens with the imperative "${opener}" — LACE never commands (App D rule 2)`,
      });
    }
  }

  for (const phrase of BANNED_PHRASES) {
    if (phrase.test(text)) {
      issues.push({ id, rule: 'banned_phrase', detail: `contains banned phrase ${String(phrase)}` });
    }
  }

  return issues;
}

/**
 * Corpus contraction ceiling (rule 4). The shipped corpus sits ~30% with the
 * hand-authored prototype lines; the ceiling keeps "rarely" from drifting into
 * "usually" as the corpus grows toward 400–500 lines.
 */
export const MAX_CONTRACTION_RATE = 0.45;

export interface CorpusLintResult {
  readonly issues: readonly VoiceLintIssue[];
  /** Fraction of lines containing at least one contraction. */
  readonly contractionRate: number;
}

/** Lints a whole line corpus: per-line rules + the corpus contraction rate. */
export function lintLaceCorpus(lines: readonly Pick<LaceLine, 'id' | 'text'>[]): CorpusLintResult {
  const issues = lines.flatMap((l) => lintLaceText(l.id, l.text));
  const withContraction = lines.filter((l) => hasContraction(l.text)).length;
  return {
    issues,
    contractionRate: lines.length === 0 ? 0 : withContraction / lines.length,
  };
}
