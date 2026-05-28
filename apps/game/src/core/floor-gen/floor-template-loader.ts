import type {
  ConnectivityRule,
  FloorTemplate,
  RoomCountRange,
  RoomType,
  RoomTypeMinima,
  RoomTypeWeights,
  Zone,
} from '@shared-types/floor-template';
import { ROOM_WEIGHTS_TOLERANCE } from '@shared-types/floor-template';

/**
 * Floor template loader — T-70 (TDD §7.1).
 *
 * Parses untrusted JSON into a typed {@link FloorTemplate}, validating every
 * required field and enum value. Returns a discriminated union so callers can
 * branch on success/failure without throwing — pure, side-effect-free.
 *
 * Scope of validation:
 *   - structural (required fields present, types correct)
 *   - enum-bounded values (`zone`, `connectivity`, room type keys)
 *   - intra-template invariants (roomCount.min ≤ max; weights sum ≈ 1.0;
 *     minima don't exceed roomCount.max)
 *
 * **Not** in scope (lands in T-288, the cross-reference validator):
 *   - `enemyPool` ids point at real enemy defs
 *   - `bossId` points at a real boss def
 *   - The template's `floor` and `zone` are consistent with the floor → zone
 *     mapping (GDD §7.1).
 *
 * Schema versioning: when {@link FloorTemplate.schemaVersion} drifts from
 * the {@link CURRENT_FLOOR_TEMPLATE_SCHEMA_VERSION} export of shared-types,
 * a migration step lands here (mirrors RunState migrations per TDD §5.6).
 * Until then, only the current version is accepted.
 */

// ── Error model ──────────────────────────────────────────────────────────────

export type LoaderErrorCode =
  | 'INVALID_JSON'
  | 'NOT_AN_OBJECT'
  | 'MISSING_FIELD'
  | 'WRONG_TYPE'
  | 'INVALID_VALUE'
  | 'UNSUPPORTED_SCHEMA_VERSION';

export interface LoaderError {
  readonly code: LoaderErrorCode;
  readonly message: string;
  /** Dotted path of the offending field when applicable (e.g. `roomCount.min`). */
  readonly field?: string;
}

export type LoaderResult =
  | { readonly ok: true; readonly template: FloorTemplate }
  | { readonly ok: false; readonly error: LoaderError };

const fail = (code: LoaderErrorCode, message: string, field?: string): LoaderResult => ({
  ok: false,
  error: field === undefined ? { code, message } : { code, message, field },
});

// ── Enum tables ──────────────────────────────────────────────────────────────

const VALID_ZONES = new Set<Zone>(['shallows', 'mycosphere', 'lithic', 'convergence']);
const VALID_CONNECTIVITY = new Set<ConnectivityRule>(['linear', 'branching', 'loop']);
/** Room-type keys that participate in the weighted draw (boss is placed separately). */
const FILLABLE_ROOM_TYPES: readonly Exclude<RoomType, 'boss'>[] = [
  'combat',
  'loot',
  'safe',
  'merchant',
  'trap',
  'lace_event',
];

// ── Type predicates ──────────────────────────────────────────────────────────

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function isFiniteNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

function isString(v: unknown): v is string {
  return typeof v === 'string';
}

function isArrayOfStrings(v: unknown): v is readonly string[] {
  return Array.isArray(v) && v.every(isString);
}

// ── Field-level validators ───────────────────────────────────────────────────

function readRoomCount(raw: unknown): RoomCountRange | LoaderError {
  if (!isPlainObject(raw)) {
    return { code: 'WRONG_TYPE', message: 'roomCount must be an object', field: 'roomCount' };
  }
  const { min, max } = raw;
  if (!isFiniteNumber(min) || !Number.isInteger(min) || min < 1) {
    return { code: 'INVALID_VALUE', message: 'roomCount.min must be a positive integer', field: 'roomCount.min' };
  }
  if (!isFiniteNumber(max) || !Number.isInteger(max) || max < 1) {
    return { code: 'INVALID_VALUE', message: 'roomCount.max must be a positive integer', field: 'roomCount.max' };
  }
  if (min > max) {
    return { code: 'INVALID_VALUE', message: `roomCount.min (${min}) must not exceed roomCount.max (${max})`, field: 'roomCount' };
  }
  return { min, max };
}

function readRoomWeights(raw: unknown): RoomTypeWeights | LoaderError {
  if (!isPlainObject(raw)) {
    return { code: 'WRONG_TYPE', message: 'roomWeights must be an object', field: 'roomWeights' };
  }
  const out: Record<string, number> = {};
  let sum = 0;
  for (const key of FILLABLE_ROOM_TYPES) {
    const v = raw[key];
    if (!isFiniteNumber(v) || v < 0) {
      return {
        code: 'INVALID_VALUE',
        message: `roomWeights.${key} must be a non-negative number`,
        field: `roomWeights.${key}`,
      };
    }
    out[key] = v;
    sum += v;
  }
  if (Math.abs(sum - 1) > ROOM_WEIGHTS_TOLERANCE) {
    return {
      code: 'INVALID_VALUE',
      message: `roomWeights must sum to 1.0 (±${ROOM_WEIGHTS_TOLERANCE}); got ${sum.toFixed(4)}`,
      field: 'roomWeights',
    };
  }
  return out as unknown as RoomTypeWeights;
}

function readRoomMinima(raw: unknown, maxRooms: number): RoomTypeMinima | LoaderError {
  if (raw === undefined) return {};
  if (!isPlainObject(raw)) {
    return { code: 'WRONG_TYPE', message: 'roomMinima must be an object', field: 'roomMinima' };
  }
  const allowedMinKeys: readonly (keyof RoomTypeMinima)[] = ['safe', 'merchant', 'loot', 'trap', 'lace_event'];
  const out: { -readonly [K in keyof RoomTypeMinima]: number } = {};
  let totalMin = 0;
  for (const key of allowedMinKeys) {
    const v = raw[key];
    if (v === undefined) continue;
    if (!isFiniteNumber(v) || !Number.isInteger(v) || v < 0) {
      return {
        code: 'INVALID_VALUE',
        message: `roomMinima.${key} must be a non-negative integer`,
        field: `roomMinima.${key}`,
      };
    }
    out[key] = v;
    totalMin += v;
  }
  if (totalMin > maxRooms) {
    return {
      code: 'INVALID_VALUE',
      message: `roomMinima sum (${totalMin}) exceeds roomCount.max (${maxRooms}) — template is unsatisfiable`,
      field: 'roomMinima',
    };
  }
  return out;
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Parse and validate a floor-template payload. Accepts either:
 *   - a JSON string, or
 *   - a pre-parsed JSON object (`unknown`),
 * and returns a discriminated union — never throws.
 */
export function parseFloorTemplate(input: unknown): LoaderResult {
  // 1. Normalise input → object.
  let payload: unknown = input;
  if (typeof input === 'string') {
    try {
      payload = JSON.parse(input);
    } catch (e) {
      return fail('INVALID_JSON', `not valid JSON: ${(e as Error).message}`);
    }
  }
  if (!isPlainObject(payload)) {
    return fail('NOT_AN_OBJECT', 'floor-template payload must be an object');
  }

  // 2. schemaVersion — must match the currently supported version.
  const schemaVersion = payload['schemaVersion'];
  if (schemaVersion === undefined) {
    return fail('MISSING_FIELD', 'schemaVersion is required', 'schemaVersion');
  }
  if (!isFiniteNumber(schemaVersion) || !Number.isInteger(schemaVersion)) {
    return fail('WRONG_TYPE', 'schemaVersion must be an integer', 'schemaVersion');
  }
  if (schemaVersion !== 1) {
    return fail(
      'UNSUPPORTED_SCHEMA_VERSION',
      `schemaVersion ${schemaVersion} is not supported (current: 1); migrations not yet implemented`,
      'schemaVersion',
    );
  }

  // 3. floor.
  const floor = payload['floor'];
  if (floor === undefined) return fail('MISSING_FIELD', 'floor is required', 'floor');
  if (!isFiniteNumber(floor) || !Number.isInteger(floor) || floor < 1) {
    return fail('INVALID_VALUE', 'floor must be a positive integer', 'floor');
  }

  // 4. zone.
  const zone = payload['zone'];
  if (zone === undefined) return fail('MISSING_FIELD', 'zone is required', 'zone');
  if (!isString(zone)) return fail('WRONG_TYPE', 'zone must be a string', 'zone');
  if (!VALID_ZONES.has(zone as Zone)) {
    return fail('INVALID_VALUE', `zone must be one of: ${[...VALID_ZONES].join(', ')}`, 'zone');
  }

  // 5. roomCount.
  if (payload['roomCount'] === undefined) return fail('MISSING_FIELD', 'roomCount is required', 'roomCount');
  const rcOrErr = readRoomCount(payload['roomCount']);
  if ('code' in rcOrErr) return { ok: false, error: rcOrErr };
  const roomCount = rcOrErr;

  // 6. roomWeights.
  if (payload['roomWeights'] === undefined) return fail('MISSING_FIELD', 'roomWeights is required', 'roomWeights');
  const rwOrErr = readRoomWeights(payload['roomWeights']);
  if ('code' in rwOrErr) return { ok: false, error: rwOrErr };
  const roomWeights = rwOrErr;

  // 7. roomMinima — optional.
  const rmOrErr = readRoomMinima(payload['roomMinima'], roomCount.max);
  if ('code' in rmOrErr) return { ok: false, error: rmOrErr };
  const roomMinima = rmOrErr;

  // 8. connectivity.
  const connectivity = payload['connectivity'];
  if (connectivity === undefined) return fail('MISSING_FIELD', 'connectivity is required', 'connectivity');
  if (!isString(connectivity)) return fail('WRONG_TYPE', 'connectivity must be a string', 'connectivity');
  if (!VALID_CONNECTIVITY.has(connectivity as ConnectivityRule)) {
    return fail(
      'INVALID_VALUE',
      `connectivity must be one of: ${[...VALID_CONNECTIVITY].join(', ')}`,
      'connectivity',
    );
  }

  // 9. enemyPool — non-empty string array.
  const enemyPool = payload['enemyPool'];
  if (enemyPool === undefined) return fail('MISSING_FIELD', 'enemyPool is required', 'enemyPool');
  if (!isArrayOfStrings(enemyPool)) {
    return fail('WRONG_TYPE', 'enemyPool must be an array of strings', 'enemyPool');
  }
  if (enemyPool.length === 0) {
    return fail('INVALID_VALUE', 'enemyPool must not be empty', 'enemyPool');
  }

  // 10. bossId.
  const bossId = payload['bossId'];
  if (bossId === undefined) return fail('MISSING_FIELD', 'bossId is required', 'bossId');
  if (!isString(bossId) || bossId.length === 0) {
    return fail('INVALID_VALUE', 'bossId must be a non-empty string', 'bossId');
  }

  // 11. aestheticTags — array of strings (may be empty).
  const aestheticTags = payload['aestheticTags'];
  if (aestheticTags === undefined) {
    return fail('MISSING_FIELD', 'aestheticTags is required', 'aestheticTags');
  }
  if (!isArrayOfStrings(aestheticTags)) {
    return fail('WRONG_TYPE', 'aestheticTags must be an array of strings', 'aestheticTags');
  }

  // 12. Assemble. Spreads are deliberate — the loader returns a fresh,
  // frozen-shape value the caller can safely treat as readonly.
  const template: FloorTemplate = {
    schemaVersion,
    floor,
    zone: zone as Zone,
    roomCount,
    roomWeights,
    roomMinima,
    connectivity: connectivity as ConnectivityRule,
    enemyPool: [...enemyPool],
    bossId,
    aestheticTags: [...aestheticTags],
  };
  return { ok: true, template };
}
