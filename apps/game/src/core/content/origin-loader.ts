import type { OriginDef, OriginPerk } from '@shared-types/origin';
import { CURRENT_ORIGIN_SCHEMA_VERSION } from '@shared-types/origin';
import type { ItemCategory } from '@shared-types/item';
import type { MutationFamily } from '@shared-types/mutation';
import { FAMILY_RING } from '@shared-types/mutation';
import type { DamageType } from '@shared-types/run-state';
import type { Zone } from '@shared-types/floor-template';
import type { ContentError } from './validation';
import {
  asObject,
  contentError,
  isContentError,
  isPlainObject,
  readEnum,
  readNonEmptyString,
  readNonNegativeInt,
  readPositiveInt,
  readSchemaVersion,
} from './validation';
import { readGrantsAbility } from './mutation-loader';

/**
 * Origin loader — T-301 (GDD §4.1).
 *
 * Parses untrusted JSON into a typed {@link OriginDef}, validating every field
 * and the perk's discriminated union. Returns a discriminated union — never
 * throws — mirroring the other content loaders. Reuses the mutation loader's
 * ability reader so an Origin's starting ability obeys the exact same
 * AP/cooldown/status contract as a mutation-granted one.
 */

export type OriginLoaderResult =
  | { readonly ok: true; readonly origin: OriginDef }
  | { readonly ok: false; readonly error: ContentError };

const VALID_FAMILIES = new Set<MutationFamily>(FAMILY_RING);
const VALID_ZONES = new Set<Zone>(['shallows', 'mycosphere', 'lithic', 'convergence']);
const VALID_DAMAGE_TYPES = new Set<DamageType>([
  'physical', 'thermal', 'void', 'spore', 'seismic', 'pressure', 'true',
]);
const VALID_ITEM_CATEGORIES = new Set<ItemCategory>(['consumable', 'passive', 'equipment']);

function readPerk(raw: unknown): OriginPerk | ContentError {
  if (!isPlainObject(raw)) {
    return contentError('WRONG_TYPE', 'perk must be an object', 'perk');
  }
  switch (raw['kind']) {
    case 'startingItem': {
      const itemId = readNonEmptyString(raw, 'itemId');
      if (isContentError(itemId)) return itemId;
      return { kind: 'startingItem', itemId };
    }
    case 'startingAbility': {
      const ability = readGrantsAbility(raw['ability']);
      if (isContentError(ability)) return ability;
      if (ability === null) {
        return contentError('MISSING_FIELD', 'startingAbility perk requires an ability', 'perk.ability');
      }
      return { kind: 'startingAbility', ability };
    }
    case 'familyAffinity': {
      const family = readEnum<MutationFamily>(raw, 'family', VALID_FAMILIES);
      if (isContentError(family)) return family;
      return { kind: 'familyAffinity', family };
    }
    case 'damageResistPercent': {
      const damageType = readEnum<DamageType>(raw, 'damageType', VALID_DAMAGE_TYPES);
      if (isContentError(damageType)) return damageType;
      const percent = readNonNegativeInt(raw, 'percent');
      if (isContentError(percent)) return percent;
      if (percent > 100) {
        return contentError('INVALID_VALUE', 'perk.percent must be ≤ 100', 'perk.percent');
      }
      return { kind: 'damageResistPercent', damageType, percent };
    }
    case 'zoneVeinBonus': {
      const zone = readEnum<Zone>(raw, 'zone', VALID_ZONES);
      if (isContentError(zone)) return zone;
      const percent = readNonNegativeInt(raw, 'percent');
      if (isContentError(percent)) return percent;
      return { kind: 'zoneVeinBonus', zone, percent };
    }
    // ── The five unlockable Origins' perks (T-307) ────────────────────────
    case 'zoneDamageImmunity': {
      const damageType = readEnum<DamageType>(raw, 'damageType', VALID_DAMAGE_TYPES);
      if (isContentError(damageType)) return damageType;
      if (damageType === 'true') {
        return contentError('INVALID_VALUE', "'true' damage cannot be resisted (T-301 contract)", 'perk.damageType');
      }
      const throughFloor = readPositiveInt(raw, 'throughFloor');
      if (isContentError(throughFloor)) return throughFloor;
      return { kind: 'zoneDamageImmunity', damageType, throughFloor };
    }
    case 'enemyHpReveal':
      return { kind: 'enemyHpReveal' };
    case 'extraWildCard':
      return { kind: 'extraWildCard' };
    case 'codexHeadStart': {
      const count = readPositiveInt(raw, 'count');
      if (isContentError(count)) return count;
      return { kind: 'codexHeadStart', count };
    }
    case 'inventorySlotBonus': {
      const category = readEnum<ItemCategory>(raw, 'category', VALID_ITEM_CATEGORIES);
      if (isContentError(category)) return category;
      const slots = readPositiveInt(raw, 'slots');
      if (isContentError(slots)) return slots;
      return { kind: 'inventorySlotBonus', category, slots };
    }
    default:
      return contentError('INVALID_VALUE', `perk.kind "${String(raw['kind'])}" is not recognised`, 'perk.kind');
  }
}

export function parseOriginDef(input: unknown): OriginLoaderResult {
  const payload = asObject(input);
  if (isContentError(payload)) return { ok: false, error: payload };

  const schemaVersion = readSchemaVersion(payload, CURRENT_ORIGIN_SCHEMA_VERSION);
  if (isContentError(schemaVersion)) return { ok: false, error: schemaVersion };

  const id = readNonEmptyString(payload, 'id');
  if (isContentError(id)) return { ok: false, error: id };

  const name = readNonEmptyString(payload, 'name');
  if (isContentError(name)) return { ok: false, error: name };

  const tagline = readNonEmptyString(payload, 'tagline');
  if (isContentError(tagline)) return { ok: false, error: tagline };

  const blurb = readNonEmptyString(payload, 'blurb');
  if (isContentError(blurb)) return { ok: false, error: blurb };

  const unlockRuns = readNonNegativeInt(payload, 'unlockRuns');
  if (isContentError(unlockRuns)) return { ok: false, error: unlockRuns };

  const perk = readPerk(payload['perk']);
  if (isContentError(perk)) return { ok: false, error: perk };

  return {
    ok: true,
    origin: { schemaVersion, id, name, tagline, blurb, unlockRuns, perk },
  };
}
