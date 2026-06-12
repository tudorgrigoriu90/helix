import type { MutationDef, MutationFamily, MutationModifier, MutationTier } from '@shared-types/mutation';
import { CURRENT_MUTATION_SCHEMA_VERSION } from '@shared-types/mutation';
import type { AbilityDef, AbilityTargetType } from '@shared-types/ability';
import type { DamageType, EntityStats, StatusEffect } from '@shared-types/run-state';
import type { ContentError } from './validation';
import {
  asObject,
  contentError,
  isContentError,
  isFiniteNumber,
  isPlainObject,
  isString,
  readEnum,
  readNonEmptyString,
  readNonNegativeInt,
  readSchemaVersion,
} from './validation';

/**
 * Mutation loader — T-83 (GDD §5 / TDD §8.1). Completes the content-side of
 * T-282 (mutation schema in the content pipeline) too.
 *
 * Parses untrusted JSON into a typed {@link MutationDef}, validating every
 * field, enum, and the nested modifier / granted-ability shapes. Discriminated
 * union, never throws — mirrors the enemy/item/floor loaders.
 *
 * **Not** in scope (cross-reference validator, T-288): mutation-id uniqueness
 * across the registry — that's a bundle-level check added alongside this.
 */

export type MutationLoaderResult =
  | { readonly ok: true; readonly mutation: MutationDef }
  | { readonly ok: false; readonly error: ContentError };

const VALID_FAMILIES = new Set<MutationFamily>(['abyssal', 'mycelial', 'lithic', 'voidborn', 'thermal']);
const VALID_TIERS = new Set<MutationTier>(['minor', 'major', 'dominant']);
const VALID_STATS = new Set<keyof EntityStats>(['str', 'res', 'agi', 'int']);
const VALID_TARGET_TYPES = new Set<AbilityTargetType>(['enemy', 'self', 'tile']);
const VALID_DAMAGE_TYPES = new Set<DamageType>([
  'physical', 'thermal', 'void', 'spore', 'seismic', 'pressure', 'true',
]);
const VALID_STATUSES = new Set<StatusEffect>([
  'burn', 'infected', 'stagger', 'suppressed', 'fractured',
  'crushed', 'rooted', 'phased', 'regenerating', 'overheated',
]);

/** A signed finite integer (modifier deltas may be negative — mutations can have downsides). */
function isSignedInt(v: unknown): v is number {
  return isFiniteNumber(v) && Number.isInteger(v);
}

// ── Modifier reader ────────────────────────────────────────────────────────

function readModifiers(raw: unknown): readonly MutationModifier[] | ContentError {
  if (raw === undefined) return contentError('MISSING_FIELD', 'modifiers is required', 'modifiers');
  if (!Array.isArray(raw)) return contentError('WRONG_TYPE', 'modifiers must be an array', 'modifiers');

  const out: MutationModifier[] = [];
  for (let i = 0; i < raw.length; i++) {
    const m: unknown = raw[i];
    const field = `modifiers[${i}]`;
    if (!isPlainObject(m)) return contentError('WRONG_TYPE', `${field} must be an object`, field);

    const kind = m['kind'];
    const delta = m['delta'];
    if (kind === 'stat') {
      const stat = m['stat'];
      if (!isString(stat) || !VALID_STATS.has(stat as keyof EntityStats)) {
        return contentError('INVALID_VALUE', `${field}.stat must be one of: ${[...VALID_STATS].join(', ')}`, `${field}.stat`);
      }
      if (!isSignedInt(delta)) {
        return contentError('INVALID_VALUE', `${field}.delta must be an integer`, `${field}.delta`);
      }
      out.push({ kind: 'stat', stat: stat as keyof EntityStats, delta });
    } else if (kind === 'maxHp' || kind === 'maxAp') {
      if (!isSignedInt(delta)) {
        return contentError('INVALID_VALUE', `${field}.delta must be an integer`, `${field}.delta`);
      }
      out.push({ kind, delta });
    } else {
      return contentError('INVALID_VALUE', `${field}.kind must be one of: stat, maxHp, maxAp`, `${field}.kind`);
    }
  }
  return out;
}

// ── Granted-ability reader ─────────────────────────────────────────────────

/** Validates the optional `grantsAbility` block: `null`, or a full AbilityDef. */
function readGrantsAbility(raw: unknown): AbilityDef | null | ContentError {
  if (raw === undefined) return contentError('MISSING_FIELD', 'grantsAbility is required (use null for passive-only mutations)', 'grantsAbility');
  if (raw === null) return null;
  if (!isPlainObject(raw)) return contentError('WRONG_TYPE', 'grantsAbility must be an object or null', 'grantsAbility');

  const id = readNonEmptyString(raw, 'id');
  if (isContentError(id)) return prefix(id, 'grantsAbility');

  const apCost = readIntInRange(raw, 'apCost', 1, 3);
  if (isContentError(apCost)) return prefix(apCost, 'grantsAbility');

  const cooldown = readIntInRange(raw, 'cooldown', 0, 5);
  if (isContentError(cooldown)) return prefix(cooldown, 'grantsAbility');

  const range = readNonNegativeInt(raw, 'range');
  if (isContentError(range)) return prefix(range, 'grantsAbility');

  const targetType = readEnum<AbilityTargetType>(raw, 'targetType', VALID_TARGET_TYPES);
  if (isContentError(targetType)) return prefix(targetType, 'grantsAbility');

  const baseDamage = readNonNegativeInt(raw, 'baseDamage');
  if (isContentError(baseDamage)) return prefix(baseDamage, 'grantsAbility');

  const damageType = readEnum<DamageType>(raw, 'damageType', VALID_DAMAGE_TYPES);
  if (isContentError(damageType)) return prefix(damageType, 'grantsAbility');

  const intScaling = raw['intScaling'];
  if (!isFiniteNumber(intScaling) || intScaling < 0) {
    return contentError('INVALID_VALUE', 'grantsAbility.intScaling must be a non-negative number', 'grantsAbility.intScaling');
  }

  const aoeRadius = readNonNegativeInt(raw, 'aoeRadius');
  if (isContentError(aoeRadius)) return prefix(aoeRadius, 'grantsAbility');

  const statusDuration = readNonNegativeInt(raw, 'statusDuration');
  if (isContentError(statusDuration)) return prefix(statusDuration, 'grantsAbility');

  // appliesStatus is StatusEffect | null.
  const appliesStatusRaw = raw['appliesStatus'];
  let appliesStatus: StatusEffect | null;
  if (appliesStatusRaw === null) {
    appliesStatus = null;
  } else if (isString(appliesStatusRaw) && VALID_STATUSES.has(appliesStatusRaw as StatusEffect)) {
    appliesStatus = appliesStatusRaw as StatusEffect;
  } else {
    return contentError('INVALID_VALUE', 'grantsAbility.appliesStatus must be a StatusEffect or null', 'grantsAbility.appliesStatus');
  }

  return {
    id, apCost, cooldown, range, targetType, baseDamage, damageType, intScaling, aoeRadius, appliesStatus, statusDuration,
  };
}

/** Reads a required integer within [min, max] inclusive. */
function readIntInRange(
  payload: Record<string, unknown>,
  field: string,
  min: number,
  max: number,
): number | ContentError {
  const v = payload[field];
  if (v === undefined) return contentError('MISSING_FIELD', `${field} is required`, field);
  if (!isSignedInt(v) || v < min || v > max) {
    return contentError('INVALID_VALUE', `${field} must be an integer in [${min}, ${max}]`, field);
  }
  return v;
}

/** Re-points a nested error's field path under `parent` so messages stay actionable. */
function prefix(err: ContentError, parent: string): ContentError {
  return contentError(err.code, err.message, err.field === undefined ? parent : `${parent}.${err.field}`);
}

function readTags(raw: unknown): readonly string[] | ContentError {
  if (raw === undefined) return contentError('MISSING_FIELD', 'tags is required', 'tags');
  if (!Array.isArray(raw) || !raw.every((t) => typeof t === 'string')) {
    return contentError('WRONG_TYPE', 'tags must be an array of strings', 'tags');
  }
  return raw as readonly string[];
}

// ── Public API ──────────────────────────────────────────────────────────────

export function parseMutationDef(input: unknown): MutationLoaderResult {
  const payload = asObject(input);
  if (isContentError(payload)) return { ok: false, error: payload };

  const schemaVersion = readSchemaVersion(payload, CURRENT_MUTATION_SCHEMA_VERSION);
  if (isContentError(schemaVersion)) return { ok: false, error: schemaVersion };

  const id = readNonEmptyString(payload, 'id');
  if (isContentError(id)) return { ok: false, error: id };

  const family = readEnum<MutationFamily>(payload, 'family', VALID_FAMILIES);
  if (isContentError(family)) return { ok: false, error: family };

  const tier = readEnum<MutationTier>(payload, 'tier', VALID_TIERS);
  if (isContentError(tier)) return { ok: false, error: tier };

  const name = readNonEmptyString(payload, 'name');
  if (isContentError(name)) return { ok: false, error: name };

  // T-525 (DR-007): the SIG-as-cost model is dead — reject its field names
  // outright so stale tooling or an old workbook export can't reintroduce them.
  for (const alias of ['sigCost', 'sigGrant'] as const) {
    if (payload[alias] !== undefined) {
      return {
        ok: false,
        error: contentError(
          'INVALID_VALUE',
          `"${alias}" is a retired SIG-as-cost field (DR-007) — mutations grant flat SIG via "sigBonus"`,
          alias,
        ),
      };
    }
  }

  const sigBonus = readNonNegativeInt(payload, 'sigBonus');
  if (isContentError(sigBonus)) return { ok: false, error: sigBonus };

  const modifiers = readModifiers(payload['modifiers']);
  if (isContentError(modifiers)) return { ok: false, error: modifiers };

  const grantsAbility = readGrantsAbility(payload['grantsAbility']);
  if (isContentError(grantsAbility)) return { ok: false, error: grantsAbility };

  const lace = readNonEmptyString(payload, 'lace');
  if (isContentError(lace)) return { ok: false, error: lace };

  const tags = readTags(payload['tags']);
  if (isContentError(tags)) return { ok: false, error: tags };

  return {
    ok: true,
    mutation: { id, family, tier, name, sigBonus, modifiers, grantsAbility, lace, tags },
  };
}
