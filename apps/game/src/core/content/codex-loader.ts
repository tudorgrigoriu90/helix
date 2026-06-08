import type { CodexCategory, CodexEntry } from '@shared-types/codex-entry';
import { CURRENT_CODEX_SCHEMA_VERSION } from '@shared-types/codex-entry';
import type { ContentError } from './validation';
import {
  asObject,
  contentError,
  isContentError,
  isFiniteNumber,
  isNonEmptyString,
  isPlainObject,
  readSchemaVersion,
} from './validation';

/**
 * Codex entry loader — T-294 (GDD §2.7).
 *
 * Parses a `{ schemaVersion, entries: [...] }` bundle into typed
 * {@link CodexEntry}s, validating every field, the `category` enum, the
 * `floor` (non-negative integer), and id uniqueness. Returns a discriminated
 * union — never throws — mirroring the LACE line loader (T-97).
 */

export type CodexLoaderResult =
  | { readonly ok: true; readonly entries: readonly CodexEntry[] }
  | { readonly ok: false; readonly error: ContentError };

const VALID_CATEGORIES = new Set<CodexCategory>(['organism', 'phenomenon', 'location', 'lore']);

function readEntry(raw: unknown, index: number): CodexEntry | ContentError {
  if (!isPlainObject(raw)) {
    return contentError('WRONG_TYPE', `entries[${index}] must be an object`, `entries.${index}`);
  }
  if (!isNonEmptyString(raw['id'])) {
    return contentError('INVALID_VALUE', `entries[${index}].id must be a non-empty string`, `entries.${index}.id`);
  }
  if (!isNonEmptyString(raw['title'])) {
    return contentError('INVALID_VALUE', `entries[${index}].title must be a non-empty string`, `entries.${index}.title`);
  }
  if (!VALID_CATEGORIES.has(raw['category'] as CodexCategory)) {
    return contentError('INVALID_VALUE', `entries[${index}].category is not a valid category`, `entries.${index}.category`);
  }
  const floor = raw['floor'];
  if (!isFiniteNumber(floor) || !Number.isInteger(floor) || floor < 0) {
    return contentError('INVALID_VALUE', `entries[${index}].floor must be a non-negative integer`, `entries.${index}.floor`);
  }
  if (!isNonEmptyString(raw['body'])) {
    return contentError('INVALID_VALUE', `entries[${index}].body must be a non-empty string`, `entries.${index}.body`);
  }
  return {
    id: raw['id'],
    title: raw['title'],
    category: raw['category'] as CodexCategory,
    floor,
    body: raw['body'],
  };
}

export function parseCodexEntries(input: unknown): CodexLoaderResult {
  const payload = asObject(input);
  if (isContentError(payload)) return { ok: false, error: payload };

  const schemaVersion = readSchemaVersion(payload, CURRENT_CODEX_SCHEMA_VERSION);
  if (isContentError(schemaVersion)) return { ok: false, error: schemaVersion };

  const rawEntries = payload['entries'];
  if (!Array.isArray(rawEntries)) {
    return { ok: false, error: contentError('WRONG_TYPE', 'entries must be an array', 'entries') };
  }

  const entries: CodexEntry[] = [];
  const seenIds = new Set<string>();
  for (let i = 0; i < rawEntries.length; i++) {
    const entry = readEntry(rawEntries[i], i);
    if (isContentError(entry)) return { ok: false, error: entry };
    if (seenIds.has(entry.id)) {
      return { ok: false, error: contentError('INVALID_VALUE', `duplicate entry id "${entry.id}"`, `entries.${i}.id`) };
    }
    seenIds.add(entry.id);
    entries.push(entry);
  }

  return { ok: true, entries };
}
