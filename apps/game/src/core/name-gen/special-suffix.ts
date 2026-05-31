/**
 * Special-condition name suffixes — T-121 (GDD §12.8).
 *
 * Beyond the random {prefix}/{trait}/{suffix} assembly, a run can earn
 * *condition* adornments that reflect what actually happened — these are
 * deterministic functions of run facts, not RNG. Two shapes, matching the GDD
 * examples:
 *   - a **descent phrase** joined into the title with a space —
 *     "Pressure Saint of the Third Descent";
 *   - **condition tags** comma-appended — "Pale Crystal Warden, Untouched".
 *
 * The exact trigger conditions aren't enumerated in the docs (only the example
 * strings), so the rules below are an authored interpretation, flagged as such:
 *   - descent phrase: a *won* run earns "of the {ordinal} Descent" for the floor
 *     it cleared (lost runs don't — you didn't complete a descent);
 *   - "Untouched": finished without taking a single point of damage, in a run
 *     where combat actually happened (≥1 kill), so it means something;
 *   - "Bloodless": *won* without killing anything — a pacifist completion.
 */

/** The run facts the special-suffix rules read. Pure inputs, no engine coupling. */
export interface RunNameFacts {
  /** Deepest floor the run reached (1-based). */
  readonly floorReached: number;
  /** Total damage the player took across the run. */
  readonly damageTaken: number;
  /** Enemies defeated across the run. */
  readonly enemiesKilled: number;
  /** Whether the run was won (final boss cleared). */
  readonly won: boolean;
}

export interface SpecialSuffixes {
  /** Title tail joined with a space, e.g. "of the Third Descent" (null = none). */
  readonly descentPhrase: string | null;
  /** Comma-appended condition tags, e.g. ["Untouched"]. Order is stable. */
  readonly conditionTags: readonly string[];
}

const ORDINAL_WORDS: readonly string[] = [
  'First', 'Second', 'Third', 'Fourth', 'Fifth', 'Sixth', 'Seventh', 'Eighth',
  'Ninth', 'Tenth', 'Eleventh', 'Twelfth', 'Thirteenth', 'Fourteenth', 'Fifteenth',
  'Sixteenth', 'Seventeenth', 'Eighteenth', 'Nineteenth', 'Twentieth',
];

/** Word ordinal for 1–20 ("First".."Twentieth"); numeric ("21st") beyond. */
export function ordinal(n: number): string {
  if (n >= 1 && n <= ORDINAL_WORDS.length) return ORDINAL_WORDS[n - 1]!;
  if (n < 1) return ordinal(1);
  // Numeric fallback with correct English suffix (handles the 11–13 exception).
  const mod100 = n % 100;
  const mod10 = n % 10;
  const suffix = mod100 >= 11 && mod100 <= 13 ? 'th' : mod10 === 1 ? 'st' : mod10 === 2 ? 'nd' : mod10 === 3 ? 'rd' : 'th';
  return `${n}${suffix}`;
}

/** Derives the special-condition suffixes a run has earned (deterministic). */
export function specialSuffixes(facts: RunNameFacts): SpecialSuffixes {
  const descentPhrase = facts.won ? `of the ${ordinal(facts.floorReached)} Descent` : null;

  const conditionTags: string[] = [];
  if (facts.damageTaken === 0 && facts.enemiesKilled > 0) conditionTags.push('Untouched');
  if (facts.won && facts.enemiesKilled === 0) conditionTags.push('Bloodless');

  return { descentPhrase, conditionTags };
}
