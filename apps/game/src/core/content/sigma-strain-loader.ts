import type { SigmaStrainDef, StrainEffect, StrainUnlock } from '@shared-types/sigma-strain';
import { CURRENT_SIGMA_STRAIN_SCHEMA_VERSION } from '@shared-types/sigma-strain';
import type { MutationFamily } from '@shared-types/mutation';
import { FAMILY_RING } from '@shared-types/mutation';
import type { DamageType } from '@shared-types/run-state';
import type { ContentError } from './validation';
import {
  asObject,
  contentError,
  isContentError,
  isPlainObject,
  readEnum,
  readNonEmptyString,
  readPositiveInt,
  readSchemaVersion,
} from './validation';

/**
 * Sigma Strain loader — T-306 (GDD §11.2).
 *
 * Parses untrusted JSON into a typed {@link SigmaStrainDef}, validating both
 * discriminated unions (unlock condition + effect). Returns a discriminated
 * union — never throws — mirroring the other content loaders. Numeric effects
 * are clamped to the §11.2 "nudges, not power spikes" contract: percents ≤ 25,
 * and 'true' damage stays beyond resists (same rule as the Origin perk).
 */

export type SigmaStrainLoaderResult =
  | { readonly ok: true; readonly strain: SigmaStrainDef }
  | { readonly ok: false; readonly error: ContentError };

const VALID_FAMILIES = new Set<MutationFamily>(FAMILY_RING);
const VALID_DAMAGE_TYPES = new Set<DamageType>([
  'physical', 'thermal', 'void', 'spore', 'seismic', 'pressure', 'true',
]);
/** Numeric strain effects never exceed this percent (GDD §11.2 — nudges). */
export const MAX_STRAIN_PERCENT = 25;

function readResistType(raw: Record<string, unknown>): DamageType | ContentError {
  const damageType = readEnum<DamageType>(raw, 'damageType', VALID_DAMAGE_TYPES);
  if (isContentError(damageType)) return damageType;
  if (damageType === 'true') {
    return contentError('INVALID_VALUE', "'true' damage cannot be resisted (T-301 contract)", 'damageType');
  }
  return damageType;
}

function readBoundedPercent(raw: Record<string, unknown>): number | ContentError {
  const percent = readPositiveInt(raw, 'percent');
  if (isContentError(percent)) return percent;
  if (percent > MAX_STRAIN_PERCENT) {
    return contentError('INVALID_VALUE', `percent must be ≤ ${MAX_STRAIN_PERCENT} (§11.2 nudges)`, 'percent');
  }
  return percent;
}

function readUnlock(raw: unknown): StrainUnlock | ContentError {
  if (!isPlainObject(raw)) {
    return contentError('WRONG_TYPE', 'unlock must be an object', 'unlock');
  }
  switch (raw['kind']) {
    case 'runsCompleted': {
      const count = readPositiveInt(raw, 'count');
      if (isContentError(count)) return count;
      return { kind: 'runsCompleted', count };
    }
    case 'wins': {
      const count = readPositiveInt(raw, 'count');
      if (isContentError(count)) return count;
      return { kind: 'wins', count };
    }
    case 'reachFloor': {
      const floor = readPositiveInt(raw, 'floor');
      if (isContentError(floor)) return floor;
      return { kind: 'reachFloor', floor };
    }
    case 'enemiesKilled': {
      const count = readPositiveInt(raw, 'count');
      if (isContentError(count)) return count;
      return { kind: 'enemiesKilled', count };
    }
    case 'killsOfType': {
      const damageType = readEnum<DamageType>(raw, 'damageType', VALID_DAMAGE_TYPES);
      if (isContentError(damageType)) return damageType;
      const count = readPositiveInt(raw, 'count');
      if (isContentError(count)) return count;
      return { kind: 'killsOfType', damageType, count };
    }
    case 'runsWithFamily': {
      const family = readEnum<MutationFamily>(raw, 'family', VALID_FAMILIES);
      if (isContentError(family)) return family;
      const count = readPositiveInt(raw, 'count');
      if (isContentError(count)) return count;
      return { kind: 'runsWithFamily', family, count };
    }
    case 'deathsToType': {
      const damageType = readEnum<DamageType>(raw, 'damageType', VALID_DAMAGE_TYPES);
      if (isContentError(damageType)) return damageType;
      const count = readPositiveInt(raw, 'count');
      if (isContentError(count)) return count;
      return { kind: 'deathsToType', damageType, count };
    }
    default:
      return contentError('INVALID_VALUE', `unlock.kind "${String(raw['kind'])}" is not recognised`, 'unlock.kind');
  }
}

function readEffect(raw: unknown): StrainEffect | ContentError {
  if (!isPlainObject(raw)) {
    return contentError('WRONG_TYPE', 'effect must be an object', 'effect');
  }
  switch (raw['kind']) {
    case 'maxHpPercent': {
      const percent = readBoundedPercent(raw);
      if (isContentError(percent)) return percent;
      return { kind: 'maxHpPercent', percent };
    }
    case 'damageResistPercent': {
      const damageType = readResistType(raw);
      if (isContentError(damageType)) return damageType;
      const percent = readBoundedPercent(raw);
      if (isContentError(percent)) return percent;
      return { kind: 'damageResistPercent', damageType, percent };
    }
    case 'veinBonusPercent': {
      const percent = readBoundedPercent(raw);
      if (isContentError(percent)) return percent;
      return { kind: 'veinBonusPercent', percent };
    }
    case 'shardBonusPercent': {
      const percent = readBoundedPercent(raw);
      if (isContentError(percent)) return percent;
      return { kind: 'shardBonusPercent', percent };
    }
    case 'startingVein': {
      const amount = readPositiveInt(raw, 'amount');
      if (isContentError(amount)) return amount;
      return { kind: 'startingVein', amount };
    }
    case 'extraWildCard':
      return { kind: 'extraWildCard' };
    case 'firstCardMatchesLastFamily':
      return { kind: 'firstCardMatchesLastFamily' };
    case 'carryMutation':
      return { kind: 'carryMutation' };
    case 'minimapRoomTypes':
      return { kind: 'minimapRoomTypes' };
    case 'laceBiomeHint':
      return { kind: 'laceBiomeHint' };
    case 'enemyIntentReveal': {
      const damageType = readEnum<DamageType>(raw, 'damageType', VALID_DAMAGE_TYPES);
      if (isContentError(damageType)) return damageType;
      return { kind: 'enemyIntentReveal', damageType };
    }
    case 'shopFamilyBias': {
      const family = readEnum<MutationFamily>(raw, 'family', VALID_FAMILIES);
      if (isContentError(family)) return family;
      return { kind: 'shopFamilyBias', family };
    }
    default:
      return contentError('INVALID_VALUE', `effect.kind "${String(raw['kind'])}" is not recognised`, 'effect.kind');
  }
}

export function parseSigmaStrainDef(input: unknown): SigmaStrainLoaderResult {
  const payload = asObject(input);
  if (isContentError(payload)) return { ok: false, error: payload };

  const schemaVersion = readSchemaVersion(payload, CURRENT_SIGMA_STRAIN_SCHEMA_VERSION);
  if (isContentError(schemaVersion)) return { ok: false, error: schemaVersion };

  const id = readNonEmptyString(payload, 'id');
  if (isContentError(id)) return { ok: false, error: id };

  const name = readNonEmptyString(payload, 'name');
  if (isContentError(name)) return { ok: false, error: name };

  const tagline = readNonEmptyString(payload, 'tagline');
  if (isContentError(tagline)) return { ok: false, error: tagline };

  const blurb = readNonEmptyString(payload, 'blurb');
  if (isContentError(blurb)) return { ok: false, error: blurb };

  const unlock = readUnlock(payload['unlock']);
  if (isContentError(unlock)) return { ok: false, error: unlock };

  const effect = readEffect(payload['effect']);
  if (isContentError(effect)) return { ok: false, error: effect };

  return {
    ok: true,
    strain: { schemaVersion, id, name, tagline, blurb, unlock, effect },
  };
}
