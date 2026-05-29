import type { RunState } from '@shared-types/run-state';

/**
 * RunState (de)serialisation + migration — T-110/T-115 (TDD §5.6).
 *
 * Saves are our own serialised JSON, so this isn't a hostile-content validator
 * like the loaders — it guards against corruption and *version drift*: a save
 * written by an older build is upgraded through a sequential migration chain to
 * the current schema before use. Never throws.
 */

export const CURRENT_RUN_SCHEMA_VERSION = 1;

export type SaveErrorCode =
  | 'INVALID_JSON'
  | 'NOT_AN_OBJECT'
  | 'MISSING_VERSION'
  | 'UNMIGRATABLE'
  | 'CORRUPT';

export interface SaveError {
  readonly code: SaveErrorCode;
  readonly message: string;
}

export type RunLoadResult =
  | { readonly ok: true; readonly state: RunState }
  | { readonly ok: false; readonly error: SaveError };

/** Upgrades a save one schema version forward. Keyed by the version it migrates FROM. */
export type Migration = (data: Record<string, unknown>) => Record<string, unknown>;

/** Registered RunState migrations. Empty today (v1 is current); add `0: v0→v1` etc. as the shape evolves. */
export const RUN_MIGRATIONS: Readonly<Record<number, Migration>> = {};

const err = (code: SaveErrorCode, message: string): RunLoadResult => ({ ok: false, error: { code, message } });

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

export function serializeRunState(state: RunState): string {
  return JSON.stringify(state);
}

/**
 * Applies migrations sequentially from `fromVersion` up to `toVersion`. Pure and
 * generic so the migration chain itself is testable in isolation.
 */
export function migrate(
  data: Record<string, unknown>,
  fromVersion: number,
  toVersion: number,
  migrations: Readonly<Record<number, Migration>>,
): { ok: true; data: Record<string, unknown> } | { ok: false; error: SaveError } {
  let version = fromVersion;
  let current = data;
  while (version < toVersion) {
    const step = migrations[version];
    if (step === undefined) {
      return { ok: false, error: { code: 'UNMIGRATABLE', message: `no migration registered from schema v${version}` } };
    }
    current = step(current);
    version += 1;
  }
  return { ok: true, data: current };
}

/** Minimal structural sanity check — catches truncated/corrupt saves. */
function isRunStateShape(d: Record<string, unknown>): boolean {
  if (typeof d['seed'] !== 'number' || typeof d['floorNumber'] !== 'number') return false;
  if (typeof d['turn'] !== 'number' || typeof d['phase'] !== 'string') return false;
  if (!isObject(d['player']) || !Array.isArray(d['enemies'])) return false;
  const grid = d['grid'];
  if (!isObject(grid) || typeof grid['width'] !== 'number' || typeof grid['height'] !== 'number') return false;
  if (!Array.isArray(grid['tiles']) || grid['tiles'].length !== grid['width'] * grid['height']) return false;
  const player = d['player'];
  return typeof player['hp'] === 'number' && typeof player['maxHp'] === 'number';
}

export function deserializeRunState(json: string): RunLoadResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch (e) {
    return err('INVALID_JSON', `save is not valid JSON: ${(e as Error).message}`);
  }
  if (!isObject(parsed)) return err('NOT_AN_OBJECT', 'save payload must be an object');

  const version = parsed['schemaVersion'];
  if (typeof version !== 'number' || !Number.isInteger(version)) {
    return err('MISSING_VERSION', 'save is missing an integer schemaVersion');
  }
  if (version > CURRENT_RUN_SCHEMA_VERSION) {
    return err('UNMIGRATABLE', `save schema v${version} is newer than this build (v${CURRENT_RUN_SCHEMA_VERSION})`);
  }

  const migrated = migrate(parsed, version, CURRENT_RUN_SCHEMA_VERSION, RUN_MIGRATIONS);
  if (!migrated.ok) return { ok: false, error: migrated.error };
  if (!isRunStateShape(migrated.data)) return err('CORRUPT', 'save failed the RunState structural check');

  return { ok: true, state: migrated.data as unknown as RunState };
}
