import type { ItemCategory, ItemDef, ItemEffect, ItemModifier, ItemRarity } from '@shared-types/item';
import { CURRENT_ITEM_SCHEMA_VERSION } from '@shared-types/item';
import type { DamageType, EntityStats, StatusEffect } from '@shared-types/run-state';
import type { ContentError } from './validation';
import {
  asObject,
  contentError,
  isContentError,
  isFiniteNumber,
  isPlainObject,
  readEnum,
  readNonEmptyString,
  readSchemaVersion,
} from './validation';

/**
 * Item loader — T-284 (GDD §9 / App C).
 *
 * Parses untrusted JSON into a runtime {@link ItemDef}. Validates the on-disk
 * `schemaVersion` then strips it (it is a file concern, not part of the
 * inventory/save shape). Consumables must carry a valid {@link ItemEffect};
 * passive/equipment items must have a `null` effect. Never throws.
 */

export type ItemLoaderResult =
  | { readonly ok: true; readonly item: ItemDef }
  | { readonly ok: false; readonly error: ContentError };

const VALID_CATEGORIES = new Set<ItemCategory>(['consumable', 'passive', 'equipment']);
const VALID_RARITIES = new Set<ItemRarity>(['common', 'uncommon', 'rare', 'legendary']);
const VALID_DAMAGE_TYPES = new Set<DamageType>([
  'physical', 'thermal', 'void', 'spore', 'seismic', 'pressure', 'true',
]);
const VALID_STATUSES = new Set<StatusEffect>([
  'burn', 'infected', 'stagger', 'suppressed', 'fractured',
  'crushed', 'rooted', 'phased', 'regenerating', 'overheated',
]);
const VALID_STATS = new Set<keyof EntityStats>(['str', 'res', 'agi', 'int']);

function isPositiveInt(v: unknown): v is number {
  return isFiniteNumber(v) && Number.isInteger(v) && v >= 1;
}

function isNonNegativeInt(v: unknown): v is number {
  return isFiniteNumber(v) && Number.isInteger(v) && v >= 0;
}

/** Validates the `effect` block against the item's category. */
function readEffect(category: ItemCategory, raw: unknown): ItemEffect | null | ContentError {
  if (category !== 'consumable') {
    if (raw === null || raw === undefined) return null;
    return contentError('INVALID_VALUE', `${category} items must have a null effect`, 'effect');
  }

  if (!isPlainObject(raw)) {
    return contentError('WRONG_TYPE', 'consumable items require an effect object', 'effect');
  }

  const kind = raw['kind'];
  switch (kind) {
    case 'heal': {
      if (!isPositiveInt(raw['amount'])) {
        return contentError('INVALID_VALUE', 'effect.amount must be a positive integer', 'effect.amount');
      }
      return { kind: 'heal', amount: raw['amount'] };
    }
    case 'damage': {
      if (!isPositiveInt(raw['amount'])) {
        return contentError('INVALID_VALUE', 'effect.amount must be a positive integer', 'effect.amount');
      }
      if (!VALID_DAMAGE_TYPES.has(raw['damageType'] as DamageType)) {
        return contentError('INVALID_VALUE', 'effect.damageType is not a valid damage type', 'effect.damageType');
      }
      if (!isNonNegativeInt(raw['aoeRadius'])) {
        return contentError('INVALID_VALUE', 'effect.aoeRadius must be a non-negative integer', 'effect.aoeRadius');
      }
      return {
        kind: 'damage',
        amount: raw['amount'],
        damageType: raw['damageType'] as DamageType,
        aoeRadius: raw['aoeRadius'],
      };
    }
    case 'applyStatus': {
      if (!VALID_STATUSES.has(raw['status'] as StatusEffect)) {
        return contentError('INVALID_VALUE', 'effect.status is not a valid status effect', 'effect.status');
      }
      if (!isPositiveInt(raw['duration'])) {
        return contentError('INVALID_VALUE', 'effect.duration must be a positive integer', 'effect.duration');
      }
      if (!isNonNegativeInt(raw['aoeRadius'])) {
        return contentError('INVALID_VALUE', 'effect.aoeRadius must be a non-negative integer', 'effect.aoeRadius');
      }
      return {
        kind: 'applyStatus',
        status: raw['status'] as StatusEffect,
        duration: raw['duration'],
        aoeRadius: raw['aoeRadius'],
      };
    }
    default:
      return contentError('INVALID_VALUE', `effect.kind "${String(kind)}" is not recognised`, 'effect.kind');
  }
}

/** Validates the optional `modifiers` array (passive/equipment always-on stats). */
function readModifiers(raw: unknown): readonly ItemModifier[] | ContentError {
  if (raw === undefined || raw === null) return [];
  if (!Array.isArray(raw)) {
    return contentError('WRONG_TYPE', 'modifiers must be an array', 'modifiers');
  }
  const out: ItemModifier[] = [];
  for (let i = 0; i < raw.length; i++) {
    const m: unknown = raw[i];
    if (!isPlainObject(m)) {
      return contentError('WRONG_TYPE', `modifiers[${i}] must be an object`, `modifiers.${i}`);
    }
    const kind = m['kind'];
    if (!isFiniteNumber(m['delta']) || !Number.isInteger(m['delta'])) {
      return contentError('INVALID_VALUE', `modifiers[${i}].delta must be an integer`, `modifiers.${i}.delta`);
    }
    if (kind === 'stat') {
      if (!VALID_STATS.has(m['stat'] as keyof EntityStats)) {
        return contentError('INVALID_VALUE', `modifiers[${i}].stat is not a valid stat`, `modifiers.${i}.stat`);
      }
      out.push({ kind: 'stat', stat: m['stat'] as keyof EntityStats, delta: m['delta'] });
    } else if (kind === 'maxHp' || kind === 'maxAp') {
      out.push({ kind, delta: m['delta'] });
    } else {
      return contentError('INVALID_VALUE', `modifiers[${i}].kind "${String(kind)}" is not recognised`, `modifiers.${i}.kind`);
    }
  }
  return out;
}

export function parseItemDef(input: unknown): ItemLoaderResult {
  const payload = asObject(input);
  if (isContentError(payload)) return { ok: false, error: payload };

  const schemaVersion = readSchemaVersion(payload, CURRENT_ITEM_SCHEMA_VERSION);
  if (isContentError(schemaVersion)) return { ok: false, error: schemaVersion };

  const id = readNonEmptyString(payload, 'id');
  if (isContentError(id)) return { ok: false, error: id };

  const name = readNonEmptyString(payload, 'name');
  if (isContentError(name)) return { ok: false, error: name };

  const rarity = readEnum<ItemRarity>(payload, 'rarity', VALID_RARITIES);
  if (isContentError(rarity)) return { ok: false, error: rarity };

  const category = readEnum<ItemCategory>(payload, 'category', VALID_CATEGORIES);
  if (isContentError(category)) return { ok: false, error: category };

  const effect = readEffect(category, payload['effect']);
  if (isContentError(effect)) return { ok: false, error: effect };

  const modifiers = readModifiers(payload['modifiers']);
  if (isContentError(modifiers)) return { ok: false, error: modifiers };

  // Omit `modifiers` when empty so plain consumables keep their lean shape (NFR P8).
  return {
    ok: true,
    item: modifiers.length > 0 ? { id, name, rarity, category, effect, modifiers } : { id, name, rarity, category, effect },
  };
}
