import type { EnemyDef, EnemyTier } from '@shared-types/enemy';
import { CURRENT_ENEMY_SCHEMA_VERSION, ZONE_WARDEN_IDS } from '@shared-types/enemy';
import type { DamageType, EntityStats } from '@shared-types/run-state';
import type { Zone } from '@shared-types/floor-template';
import type { ContentError } from './validation';
import {
  asObject,
  contentError,
  isContentError,
  isFiniteNumber,
  isPlainObject,
  readEnum,
  readNonEmptyString,
  readPositiveInt,
  readSchemaVersion,
} from './validation';

/**
 * Enemy loader — T-283 (GDD §8 / App B).
 *
 * Parses untrusted JSON into a typed {@link EnemyDef}, validating every field
 * and enum. Returns a discriminated union — never throws — mirroring the
 * floor-template loader (T-70).
 *
 * **Not** in scope (T-288, cross-reference validator): that `zone` matches the
 * floors that pool this enemy, or that ids are globally unique across the enemy
 * registry — those are bundle-level checks.
 */

export type EnemyLoaderResult =
  | { readonly ok: true; readonly enemy: EnemyDef }
  | { readonly ok: false; readonly error: ContentError };

const VALID_TIERS = new Set<EnemyTier>(['grunt', 'elite', 'floor_boss', 'zone_warden']);
const VALID_ZONES = new Set<Zone>(['shallows', 'mycosphere', 'lithic', 'convergence']);
const VALID_DAMAGE_TYPES = new Set<DamageType>([
  'physical',
  'thermal',
  'void',
  'spore',
  'seismic',
  'pressure',
  'true',
]);

const STAT_KEYS: readonly (keyof EntityStats)[] = ['str', 'res', 'agi', 'int'];

/** Reads the `stats` block — four non-negative integer attributes. */
function readStats(raw: unknown): EntityStats | ContentError {
  if (!isPlainObject(raw)) {
    return contentError('WRONG_TYPE', 'stats must be an object', 'stats');
  }
  const out: { -readonly [K in keyof EntityStats]: number } = { str: 0, res: 0, agi: 0, int: 0 };
  for (const key of STAT_KEYS) {
    const v = raw[key];
    if (v === undefined) {
      return contentError('MISSING_FIELD', `stats.${key} is required`, `stats.${key}`);
    }
    if (!isFiniteNumber(v) || !Number.isInteger(v) || v < 0) {
      return contentError('INVALID_VALUE', `stats.${key} must be a non-negative integer`, `stats.${key}`);
    }
    out[key] = v;
  }
  return out;
}

function readAestheticTags(raw: unknown): readonly string[] | ContentError {
  if (raw === undefined) return contentError('MISSING_FIELD', 'aestheticTags is required', 'aestheticTags');
  if (!Array.isArray(raw) || !raw.every((t) => typeof t === 'string')) {
    return contentError('WRONG_TYPE', 'aestheticTags must be an array of strings', 'aestheticTags');
  }
  return raw as readonly string[];
}

/**
 * v1 → v2 migration (T-501, DR-008): v1 had a single `boss` tier; v2 splits it
 * into `floor_boss` / `zone_warden`. The four authored Wardens are identified
 * by id ({@link ZONE_WARDEN_IDS}); every other v1 boss becomes a `floor_boss`.
 */
function migrateV1(payload: Record<string, unknown>): Record<string, unknown> {
  if (payload['schemaVersion'] !== 1) return payload;
  const migrated: Record<string, unknown> = { ...payload, schemaVersion: 2 };
  if (payload['tier'] === 'boss') {
    migrated['tier'] = ZONE_WARDEN_IDS.includes(payload['id'] as string)
      ? 'zone_warden'
      : 'floor_boss';
  }
  return migrated;
}

export function parseEnemyDef(input: unknown): EnemyLoaderResult {
  const raw = asObject(input);
  if (isContentError(raw)) return { ok: false, error: raw };
  const payload = migrateV1(raw);

  const schemaVersion = readSchemaVersion(payload, CURRENT_ENEMY_SCHEMA_VERSION);
  if (isContentError(schemaVersion)) return { ok: false, error: schemaVersion };

  const id = readNonEmptyString(payload, 'id');
  if (isContentError(id)) return { ok: false, error: id };

  const name = readNonEmptyString(payload, 'name');
  if (isContentError(name)) return { ok: false, error: name };

  const tier = readEnum<EnemyTier>(payload, 'tier', VALID_TIERS);
  if (isContentError(tier)) return { ok: false, error: tier };

  const zone = readEnum<Zone>(payload, 'zone', VALID_ZONES);
  if (isContentError(zone)) return { ok: false, error: zone };

  const maxHp = readPositiveInt(payload, 'maxHp');
  if (isContentError(maxHp)) return { ok: false, error: maxHp };

  const stats = readStats(payload['stats']);
  if (isContentError(stats)) return { ok: false, error: stats };

  const damageType = readEnum<DamageType>(payload, 'damageType', VALID_DAMAGE_TYPES);
  if (isContentError(damageType)) return { ok: false, error: damageType };

  const aestheticTags = readAestheticTags(payload['aestheticTags']);
  if (isContentError(aestheticTags)) return { ok: false, error: aestheticTags };

  return {
    ok: true,
    enemy: { schemaVersion, id, name, tier, zone, maxHp, stats, damageType, aestheticTags },
  };
}
