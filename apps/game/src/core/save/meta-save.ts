import type { MetaState } from '@shared-types/meta-state';
import { CURRENT_META_SCHEMA_VERSION } from '@shared-types/meta-state';
import { ZERO_MOOD_PRESSURE } from '../lace';
import { migrate, type Migration, type SaveError } from './run-save';
import type { LoadResult, SaveCodec } from './save-manager';

/**
 * MetaState (de)serialisation + migration — T-111 (TDD §4.2). Reuses the
 * generic migration chain from run-save.ts. Never throws.
 */

export type MetaLoadResult =
  | { readonly ok: true; readonly meta: MetaState }
  | { readonly ok: false; readonly error: SaveError };

/** Registered MetaState migrations. Each step bumps `schemaVersion` and back-fills its new field. */
export const META_MIGRATIONS: Readonly<Record<number, Migration>> = {
  // v1 → v2: the Shard Crystal balance was added (T-113). Default to 0.
  1: (d) => ({ ...d, schemaVersion: 2, shardCrystals: typeof d['shardCrystals'] === 'number' ? d['shardCrystals'] : 0 }),
  // v2 → v3: LACE mood now persists across runs (T-100). Default to no accumulated pressure.
  2: (d) => ({ ...d, schemaVersion: 3, laceMood: { ...ZERO_MOOD_PRESSURE } }),
  // v3 → v4: the Floor 0 tutorial-complete flag (T-143). Existing profiles have
  // already played, so default them to "tutorial done" — they shouldn't be sent
  // back through it on update.
  3: (d) => ({ ...d, schemaVersion: 4, tutorialComplete: typeof d['tutorialComplete'] === 'boolean' ? d['tutorialComplete'] : true }),
};

/** A fresh profile for a first-time player. */
export function newMetaState(): MetaState {
  return {
    schemaVersion: CURRENT_META_SCHEMA_VERSION,
    codexEntryIds: [],
    sigmaStrainIds: [],
    achievementIds: [],
    cosmeticIds: [],
    shardCrystals: 0,
    laceMood: { ...ZERO_MOOD_PRESSURE },
    tutorialComplete: false, // a first-time player plays Floor 0
    lifetime: { runs: 0, wins: 0, deepestFloor: 0, enemiesKilled: 0, totalPlaytimeMs: 0 },
  };
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function isStringArray(v: unknown): v is string[] {
  return Array.isArray(v) && v.every((s) => typeof s === 'string');
}

const err = (code: SaveError['code'], message: string): MetaLoadResult => ({ ok: false, error: { code, message } });

export function serializeMetaState(meta: MetaState): string {
  return JSON.stringify(meta);
}

function isMetaShape(d: Record<string, unknown>): boolean {
  return (
    isStringArray(d['codexEntryIds']) &&
    isStringArray(d['sigmaStrainIds']) &&
    isStringArray(d['achievementIds']) &&
    isStringArray(d['cosmeticIds']) &&
    isObject(d['laceMood']) &&
    typeof d['tutorialComplete'] === 'boolean' &&
    isObject(d['lifetime']) &&
    typeof d['lifetime']['runs'] === 'number'
  );
}

export function deserializeMetaState(json: string): MetaLoadResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch (e) {
    return err('INVALID_JSON', `meta save is not valid JSON: ${(e as Error).message}`);
  }
  if (!isObject(parsed)) return err('NOT_AN_OBJECT', 'meta payload must be an object');

  const version = parsed['schemaVersion'];
  if (typeof version !== 'number' || !Number.isInteger(version)) {
    return err('MISSING_VERSION', 'meta save is missing an integer schemaVersion');
  }
  if (version > CURRENT_META_SCHEMA_VERSION) {
    return err('UNMIGRATABLE', `meta schema v${version} is newer than this build (v${CURRENT_META_SCHEMA_VERSION})`);
  }

  const migrated = migrate(parsed, version, CURRENT_META_SCHEMA_VERSION, META_MIGRATIONS);
  if (!migrated.ok) return { ok: false, error: migrated.error };
  if (!isMetaShape(migrated.data)) return err('CORRUPT', 'meta save failed the structural check');

  return { ok: true, meta: migrated.data as unknown as MetaState };
}

/** {@link SaveCodec} for persisting MetaState through the SaveManager. */
export const metaCodec: SaveCodec<MetaState> = {
  serialize: serializeMetaState,
  deserialize: (json): LoadResult<MetaState> => {
    const res = deserializeMetaState(json);
    return res.ok ? { ok: true, value: res.meta } : { ok: false, error: res.error };
  },
};
