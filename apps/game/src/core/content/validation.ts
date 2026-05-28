/**
 * Shared content-loader plumbing — the error model and type predicates reused by
 * every content loader (enemies T-283, items T-284, and onward). Mirrors the
 * floor-template loader's discriminated-union, never-throw style (TDD §7.1) so
 * all content parses the same way.
 */

export type ContentErrorCode =
  | 'INVALID_JSON'
  | 'NOT_AN_OBJECT'
  | 'MISSING_FIELD'
  | 'WRONG_TYPE'
  | 'INVALID_VALUE'
  | 'UNSUPPORTED_SCHEMA_VERSION';

export interface ContentError {
  readonly code: ContentErrorCode;
  readonly message: string;
  /** Dotted path of the offending field when applicable (e.g. `stats.str`). */
  readonly field?: string;
}

export function contentError(
  code: ContentErrorCode,
  message: string,
  field?: string,
): ContentError {
  return field === undefined ? { code, message } : { code, message, field };
}

/** True for an error value (used to narrow `T | ContentError` reader returns). */
export function isContentError(v: unknown): v is ContentError {
  return typeof v === 'object' && v !== null && 'code' in v && 'message' in v;
}

// ── Type predicates ──────────────────────────────────────────────────────────

export function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

export function isFiniteNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

export function isString(v: unknown): v is string {
  return typeof v === 'string';
}

export function isNonEmptyString(v: unknown): v is string {
  return typeof v === 'string' && v.length > 0;
}

export function isArrayOfStrings(v: unknown): v is readonly string[] {
  return Array.isArray(v) && v.every(isString);
}

// ── Common field readers ─────────────────────────────────────────────────────

/** Normalises a JSON string or pre-parsed value into a plain object. */
export function asObject(input: unknown): Record<string, unknown> | ContentError {
  let payload: unknown = input;
  if (typeof input === 'string') {
    try {
      payload = JSON.parse(input);
    } catch (e) {
      return contentError('INVALID_JSON', `not valid JSON: ${(e as Error).message}`);
    }
  }
  if (!isPlainObject(payload)) {
    return contentError('NOT_AN_OBJECT', 'content payload must be an object');
  }
  return payload;
}

/** Validates `schemaVersion` is present and matches the supported version. */
export function readSchemaVersion(
  payload: Record<string, unknown>,
  current: number,
): number | ContentError {
  const v = payload['schemaVersion'];
  if (v === undefined) return contentError('MISSING_FIELD', 'schemaVersion is required', 'schemaVersion');
  if (!isFiniteNumber(v) || !Number.isInteger(v)) {
    return contentError('WRONG_TYPE', 'schemaVersion must be an integer', 'schemaVersion');
  }
  if (v !== current) {
    return contentError(
      'UNSUPPORTED_SCHEMA_VERSION',
      `schemaVersion ${v} is not supported (current: ${current}); migrations not yet implemented`,
      'schemaVersion',
    );
  }
  return v;
}

/** Reads a required non-empty string field. */
export function readNonEmptyString(
  payload: Record<string, unknown>,
  field: string,
): string | ContentError {
  const v = payload[field];
  if (v === undefined) return contentError('MISSING_FIELD', `${field} is required`, field);
  if (!isNonEmptyString(v)) {
    return contentError('INVALID_VALUE', `${field} must be a non-empty string`, field);
  }
  return v;
}

/** Reads a required positive integer field. */
export function readPositiveInt(
  payload: Record<string, unknown>,
  field: string,
): number | ContentError {
  const v = payload[field];
  if (v === undefined) return contentError('MISSING_FIELD', `${field} is required`, field);
  if (!isFiniteNumber(v) || !Number.isInteger(v) || v < 1) {
    return contentError('INVALID_VALUE', `${field} must be a positive integer`, field);
  }
  return v;
}

/** Reads a required value that must be a member of `allowed`. */
export function readEnum<T extends string>(
  payload: Record<string, unknown>,
  field: string,
  allowed: ReadonlySet<T>,
): T | ContentError {
  const v = payload[field];
  if (v === undefined) return contentError('MISSING_FIELD', `${field} is required`, field);
  if (!isString(v) || !allowed.has(v as T)) {
    return contentError(
      'INVALID_VALUE',
      `${field} must be one of: ${[...allowed].join(', ')}`,
      field,
    );
  }
  return v as T;
}
