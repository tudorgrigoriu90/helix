import type { MutationFamily } from '@shared-types/mutation';
import type { ContentError } from '../content/validation';
import { asObject, contentError, isContentError, readSchemaVersion } from '../content/validation';

/**
 * Organism-name content tables — S-3.8 (UFD Share Flow, GDD §12.8).
 *
 * The "What You Became" screen shows a memorable, deterministic organism name
 * assembled as `{prefix} {trait} {suffix}` (e.g. "The Mycelial Sovereign"),
 * optionally tailed by a special-condition suffix ("…, Untouched"). Prefixes and
 * suffixes are shared pools; traits are per-family so the name reflects the
 * dominant mutation family (GDD §5). These loaders parse the authored JSON the
 * same never-throw, discriminated-union way as the other content loaders
 * (TDD §7.1).
 *
 * Pool sizing (T-123): 20 prefixes × 20 traits/family × 10 suffixes = 4,000
 * distinct names per family — large enough that runs feel individually named.
 */

/** Current schema version for every organism-name table. */
export const CURRENT_NAME_TABLE_SCHEMA_VERSION = 1;

/** The five mutation families, in canonical ring order (mirrors FAMILY_RING). */
export const NAME_TABLE_FAMILIES: readonly MutationFamily[] = [
  'abyssal',
  'mycelial',
  'lithic',
  'voidborn',
  'thermal',
];

export type PrefixTableResult =
  | { readonly ok: true; readonly prefixes: readonly string[] }
  | { readonly ok: false; readonly error: ContentError };

/** Reads a required array of unique, non-empty strings under `field`. */
function readStringPool(
  payload: Record<string, unknown>,
  field: string,
): readonly string[] | ContentError {
  const v = payload[field];
  if (v === undefined) return contentError('MISSING_FIELD', `${field} is required`, field);
  if (!Array.isArray(v) || v.length === 0) {
    return contentError('INVALID_VALUE', `${field} must be a non-empty array`, field);
  }
  const seen = new Set<string>();
  for (const [i, entry] of v.entries()) {
    if (typeof entry !== 'string' || entry.trim().length === 0) {
      return contentError('INVALID_VALUE', `${field}[${i}] must be a non-empty string`, `${field}[${i}]`);
    }
    if (seen.has(entry)) {
      return contentError('INVALID_VALUE', `${field}[${i}] is a duplicate: "${entry}"`, `${field}[${i}]`);
    }
    seen.add(entry);
  }
  return v as readonly string[];
}

/** Parses the prefix table (T-118): `{ schemaVersion, prefixes: string[] }`. */
export function parsePrefixTable(input: unknown): PrefixTableResult {
  const payload = asObject(input);
  if (isContentError(payload)) return { ok: false, error: payload };

  const version = readSchemaVersion(payload, CURRENT_NAME_TABLE_SCHEMA_VERSION);
  if (isContentError(version)) return { ok: false, error: version };

  const prefixes = readStringPool(payload, 'prefixes');
  if (isContentError(prefixes)) return { ok: false, error: prefixes };

  return { ok: true, prefixes };
}
