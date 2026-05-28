import type { LaceContext, LaceLine, LaceMood } from '@shared-types/lace-line';
import { CURRENT_LACE_SCHEMA_VERSION } from '@shared-types/lace-line';
import type { ContentError } from '../content/validation';
import {
  asObject,
  contentError,
  isContentError,
  isFiniteNumber,
  isNonEmptyString,
  isPlainObject,
  readSchemaVersion,
} from '../content/validation';

/**
 * LACE line loader — T-97 (TDD §9.2).
 *
 * Parses a `{ schemaVersion, lines: [...] }` bundle into typed {@link LaceLine}s,
 * validating every field, enum, weight (> 0), and id uniqueness. Never throws.
 */

export type LaceLoaderResult =
  | { readonly ok: true; readonly lines: readonly LaceLine[] }
  | { readonly ok: false; readonly error: ContentError };

const VALID_MOODS = new Set<LaceMood>(['neutral', 'curious', 'hostile', 'affectionate', 'unstable']);
const VALID_CONTEXTS = new Set<LaceContext>([
  'run_start', 'floor_enter', 'combat_start', 'enemy_killed', 'player_hurt',
  'room_cleared', 'boss_start', 'boss_killed', 'floor_complete', 'player_death', 'generic',
]);

function readLine(raw: unknown, index: number): LaceLine | ContentError {
  if (!isPlainObject(raw)) {
    return contentError('WRONG_TYPE', `lines[${index}] must be an object`, `lines.${index}`);
  }
  if (!isNonEmptyString(raw['id'])) {
    return contentError('INVALID_VALUE', `lines[${index}].id must be a non-empty string`, `lines.${index}.id`);
  }
  if (!isNonEmptyString(raw['text'])) {
    return contentError('INVALID_VALUE', `lines[${index}].text must be a non-empty string`, `lines.${index}.text`);
  }
  if (!VALID_CONTEXTS.has(raw['context'] as LaceContext)) {
    return contentError('INVALID_VALUE', `lines[${index}].context is not a valid context`, `lines.${index}.context`);
  }
  if (!VALID_MOODS.has(raw['mood'] as LaceMood)) {
    return contentError('INVALID_VALUE', `lines[${index}].mood is not a valid mood`, `lines.${index}.mood`);
  }
  if (!isFiniteNumber(raw['weight']) || raw['weight'] <= 0) {
    return contentError('INVALID_VALUE', `lines[${index}].weight must be a positive number`, `lines.${index}.weight`);
  }
  return {
    id: raw['id'],
    text: raw['text'],
    context: raw['context'] as LaceContext,
    mood: raw['mood'] as LaceMood,
    weight: raw['weight'],
  };
}

export function parseLaceLines(input: unknown): LaceLoaderResult {
  const payload = asObject(input);
  if (isContentError(payload)) return { ok: false, error: payload };

  const schemaVersion = readSchemaVersion(payload, CURRENT_LACE_SCHEMA_VERSION);
  if (isContentError(schemaVersion)) return { ok: false, error: schemaVersion };

  const rawLines = payload['lines'];
  if (!Array.isArray(rawLines)) {
    return { ok: false, error: contentError('WRONG_TYPE', 'lines must be an array', 'lines') };
  }

  const lines: LaceLine[] = [];
  const seenIds = new Set<string>();
  for (let i = 0; i < rawLines.length; i++) {
    const line = readLine(rawLines[i], i);
    if (isContentError(line)) return { ok: false, error: line };
    if (seenIds.has(line.id)) {
      return { ok: false, error: contentError('INVALID_VALUE', `duplicate line id "${line.id}"`, `lines.${i}.id`) };
    }
    seenIds.add(line.id);
    lines.push(line);
  }

  return { ok: true, lines };
}
