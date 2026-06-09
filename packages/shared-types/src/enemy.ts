/**
 * Enemy definition — the content contract for a single enemy stat block.
 *
 * Authored as one JSON file per enemy under `packages/content/enemies/`
 * (GDD §8, App B). The loader (T-283) parses these into typed `EnemyDef`s; the
 * combat layer instantiates a runtime `EnemyState` (run-state.ts) from a def
 * when an encounter starts, copying `maxHp`/`stats` and applying per-floor
 * scaling (T-78). Floor templates reference enemies by `id` via `enemyPool`
 * and `bossId`; the cross-reference validator (T-288) checks those resolve.
 *
 * Schema lives in @shared-types for the same reason as FloorTemplate / ItemDef:
 * it is a stable contract shared by content authoring and the engine.
 */

import type { EntityStats, DamageType } from './run-state.js';
import type { Zone } from './floor-template.js';

/**
 * Boss tiers (DR-008): every floor has a boss, in one of two treatments.
 * `floor_boss` — template-composed, one per non-Warden floor (16 total);
 * `zone_warden` — bespoke zone finale on floors 5/10/15/20 (4 total).
 */
export type BossTier = 'floor_boss' | 'zone_warden';

/** Combat role / power band. Bosses are referenced by a floor's `bossId`. */
export type EnemyTier = 'grunt' | 'elite' | BossTier;

/** True when `tier` is either boss treatment (DR-008 two-tier split). */
export function isBossTier(tier: EnemyTier): tier is BossTier {
  return tier === 'floor_boss' || tier === 'zone_warden';
}

export interface EnemyDef {
  /** Bumped when the on-disk JSON shape changes; loader runs migrations. */
  readonly schemaVersion: number;
  /** Stable id referenced by floor templates (enemyPool / bossId). */
  readonly id: string;
  /** Display name shown in combat + codex. */
  readonly name: string;
  readonly tier: EnemyTier;
  /** Biome this enemy belongs to. Should match the floors that pool it. */
  readonly zone: Zone;
  /** Base hit points before per-floor difficulty scaling (T-78). */
  readonly maxHp: number;
  /** Base STR / RES / AGI / INT. */
  readonly stats: EntityStats;
  /** Damage type dealt by the enemy's basic attack. */
  readonly damageType: DamageType;
  /** Aesthetic tags consumed by the renderer + LACE narration. */
  readonly aestheticTags: readonly string[];
}

/** Current enemy-def schema version. Increment when the on-disk shape changes.
 *  v2 (DR-008): the single `boss` tier split into `floor_boss` / `zone_warden`;
 *  the loader migrates v1 files. */
export const CURRENT_ENEMY_SCHEMA_VERSION = 2;
