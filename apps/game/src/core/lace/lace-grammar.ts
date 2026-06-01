import type { LaceContext, LaceFragment, LaceMood, LacePlayerState, LaceTemplate } from '@shared-types/lace-line';
import type { MutationFamily } from '@shared-types/mutation';
import type { Mulberry32 } from '../rng/mulberry32';

/**
 * LACE templated grammar assembly — T-101 (DR-004 Layer 1, TDD §9.5).
 *
 * The fallback line layer: when no hand-authored line matches an event, assemble
 * one at runtime. A {@link LaceTemplate}'s `{slot}` tokens are filled with short
 * authored {@link LaceFragment}s tagged by `[event_type, mutation_family, mood,
 * player_state]`. The output is an ordinary line string — the narrator (T-103)
 * uses it exactly like an authored line, so Layer 2 (a writer's hand-crafted
 * lines) can later replace any category without the engine caring.
 *
 * Pure: the only entropy is the supplied RNG (the `events` sub-generator).
 * Tag-matching mirrors {@link selectLine} — a fragment/template whose tag is
 * `undefined` is a wildcard; a defined tag must equal the request's value; and
 * mood is *preferred* (exact-mood candidates win, else the whole matching pool).
 */

export interface GrammarRequest {
  readonly context: LaceContext;
  readonly mood: LaceMood;
  /** The run's dominant mutation family, if any (selects family-flavoured fragments). */
  readonly family?: MutationFamily;
  /** The player's health/standing bucket, if known. */
  readonly state?: LacePlayerState;
  readonly rng: Mulberry32;
}

/** A single grammar corpus: the templates and the fragments that fill them. */
export interface LaceGrammar {
  readonly templates: readonly LaceTemplate[];
  readonly fragments: readonly LaceFragment[];
}

/** `{slot}` tokens, e.g. `{opener}`. */
const SLOT_RE = /\{(\w+)\}/g;

interface Tagged {
  readonly context?: LaceContext;
  readonly family?: MutationFamily;
  readonly mood?: LaceMood;
  readonly state?: LacePlayerState;
}

/** A tag matches when it's a wildcard (`undefined`) or equals the request's value. */
function tagMatch<T>(tag: T | undefined, value: T | undefined): boolean {
  return tag === undefined || tag === value;
}

function matchesRequest(tagged: Tagged, req: GrammarRequest): boolean {
  return (
    tagMatch(tagged.context, req.context) &&
    tagMatch(tagged.family, req.family) &&
    tagMatch(tagged.mood, req.mood) &&
    tagMatch(tagged.state, req.state)
  );
}

/** Prefer exact-mood candidates; fall back to the whole pool when none match. */
function preferMood<T extends { readonly mood?: LaceMood }>(pool: readonly T[], mood: LaceMood): readonly T[] {
  const matched = pool.filter((x) => x.mood === mood);
  return matched.length > 0 ? matched : pool;
}

function weightedPick<T extends { readonly weight: number }>(pool: readonly T[], rng: Mulberry32): T {
  const total = pool.reduce((sum, x) => sum + x.weight, 0);
  let r = rng.next() * total;
  for (const x of pool) {
    r -= x.weight;
    if (r < 0) return x;
  }
  return pool[pool.length - 1]!; // float guard
}

/**
 * Assembles a line for the request, or null when no template matches or a slot
 * can't be filled (the caller then falls through to its next layer). The draw
 * order is fixed — template first, then slots in first-appearance order — so a
 * given RNG state always yields the same line.
 */
export function assembleLine(grammar: LaceGrammar, req: GrammarRequest): string | null {
  const templates = preferMood(grammar.templates.filter((t) => matchesRequest(t, req)), req.mood);
  if (templates.length === 0) return null;
  const template = weightedPick(templates, req.rng);

  const slots = [...new Set([...template.pattern.matchAll(SLOT_RE)].map((m) => m[1]!))];
  const fills = new Map<string, string>();
  for (const slot of slots) {
    const candidates = preferMood(
      grammar.fragments.filter((f) => f.slot === slot && matchesRequest(f, req)),
      req.mood,
    );
    if (candidates.length === 0) return null; // a slot we can't fill → bail to the caller
    fills.set(slot, weightedPick(candidates, req.rng).text);
  }

  return template.pattern.replace(SLOT_RE, (_, name: string) => fills.get(name) ?? '');
}
