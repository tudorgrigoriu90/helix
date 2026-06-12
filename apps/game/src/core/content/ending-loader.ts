import type { EndingDef } from '@shared-types/ending';
import { CURRENT_ENDING_SCHEMA_VERSION } from '@shared-types/ending';
import type { MutationFamily } from '@shared-types/mutation';
import { FAMILY_RING } from '@shared-types/mutation';
import type { ContentError } from './validation';
import {
  asObject,
  contentError,
  isContentError,
  isNonEmptyString,
  readEnum,
  readNonEmptyString,
  readSchemaVersion,
} from './validation';

/**
 * Ending loader + selection — T-309 (GDD §2.8).
 *
 * Parses untrusted JSON into a typed {@link EndingDef} (never throws, like the
 * other content loaders) and resolves which of the five family endings a
 * finished run earns: the build's mutations answer LACE's question, so the
 * ending keys off the first Dominant Trait when one is active, else the
 * most-stacked family, with the FAMILY_RING order as the deterministic
 * tie-break. A mutationless victory falls back to the abyssal ending — the
 * default reading of an unchanged diver who reached the bottom of an ocean.
 */

export type EndingLoaderResult =
  | { readonly ok: true; readonly ending: EndingDef }
  | { readonly ok: false; readonly error: ContentError };

const VALID_FAMILIES = new Set<MutationFamily>(FAMILY_RING);
/** Bounds on an ending's beat count (GDD §10.2 — 4–6 budgeted, slack allowed). */
export const MIN_ENDING_LINES = 3;
export const MAX_ENDING_LINES = 12;

export function parseEndingDef(input: unknown): EndingLoaderResult {
  const payload = asObject(input);
  if (isContentError(payload)) return { ok: false, error: payload };

  const schemaVersion = readSchemaVersion(payload, CURRENT_ENDING_SCHEMA_VERSION);
  if (isContentError(schemaVersion)) return { ok: false, error: schemaVersion };

  const id = readNonEmptyString(payload, 'id');
  if (isContentError(id)) return { ok: false, error: id };

  const family = readEnum<MutationFamily>(payload, 'family', VALID_FAMILIES);
  if (isContentError(family)) return { ok: false, error: family };

  const title = readNonEmptyString(payload, 'title');
  if (isContentError(title)) return { ok: false, error: title };

  const rawLines = payload['lines'];
  if (!Array.isArray(rawLines) || !rawLines.every(isNonEmptyString)) {
    return { ok: false, error: contentError('INVALID_VALUE', 'lines must be an array of non-empty strings', 'lines') };
  }
  if (rawLines.length < MIN_ENDING_LINES || rawLines.length > MAX_ENDING_LINES) {
    return {
      ok: false,
      error: contentError(
        'INVALID_VALUE',
        `lines must have ${MIN_ENDING_LINES}–${MAX_ENDING_LINES} entries (got ${rawLines.length})`,
        'lines',
      ),
    };
  }

  return { ok: true, ending: { schemaVersion, id, family, title, lines: rawLines } };
}

/** The most-stacked family, ties broken by FAMILY_RING order; null when empty. */
function modeFamily(families: readonly MutationFamily[]): MutationFamily | null {
  if (families.length === 0) return null;
  const counts = new Map<MutationFamily, number>();
  for (const f of families) counts.set(f, (counts.get(f) ?? 0) + 1);
  let best: MutationFamily | null = null;
  for (const f of FAMILY_RING) {
    if ((counts.get(f) ?? 0) > (best === null ? 0 : counts.get(best) ?? 0)) best = f;
  }
  return best;
}

/** Which family's Convergence this run earned (GDD §2.8). */
export function endingFamilyForRun(
  dominantTraits: readonly MutationFamily[],
  ownedFamilies: readonly MutationFamily[],
): MutationFamily {
  return dominantTraits[0] ?? modeFamily(ownedFamilies) ?? 'abyssal';
}

/** Resolves the run's ending from the loaded pool; null only on empty content. */
export function pickEnding(
  endings: readonly EndingDef[],
  dominantTraits: readonly MutationFamily[],
  ownedFamilies: readonly MutationFamily[],
): EndingDef | null {
  const family = endingFamilyForRun(dominantTraits, ownedFamilies);
  return endings.find((e) => e.family === family) ?? endings[0] ?? null;
}
