import type { Zone } from './floor-template.js';

/**
 * Campaign shape — the single source of truth (T-523).
 *
 * 20 floors in 4 zones of 5 (Economy.xlsx "Assumptions", GDD §3.2/§7.1,
 * DR-008). These numbers were historically duplicated across `pricing.ts`,
 * scene-level `FINAL_FLOOR` constants, the turn engine's victory check, and
 * test-local helpers — the FLOORS_PER_ZONE=6 defect class. Everything now
 * imports from here, and the content-bundle gate asserts the shipped floor
 * JSONs agree.
 */

/** The Convergence floor — clearing it is a run victory (GDD §2.8 / §7.1). */
export const MAX_FLOOR = 20;

/** Number of zones (acts) in a full descent (DR-009: one act per session). */
export const ZONE_COUNT = 4;

/** Floors per zone (4 × 5 = 20 — the corrected campaign structure, T-14). */
export const FLOORS_PER_ZONE = 5;

/** Zone-end floors guarded by a Zone Warden (DR-008). */
export const WARDEN_FLOORS: readonly number[] = [5, 10, 15, 20];

/** Biomes in descent order — zone N (1-based) is `ZONE_ORDER[N − 1]`. */
export const ZONE_ORDER: readonly Zone[] = ['shallows', 'mycosphere', 'lithic', 'convergence'];

/** The 1-based zone a floor belongs to (Zone 1 = floors 1–5, …, Zone 4 = 16–20). */
export function zoneForFloor(floor: number): number {
  return Math.max(1, Math.ceil(floor / FLOORS_PER_ZONE));
}

/** The biome a floor belongs to (floor 1 → 'shallows', …, floor 20 → 'convergence'). */
export function zoneNameForFloor(floor: number): Zone {
  return ZONE_ORDER[Math.min(zoneForFloor(floor), ZONE_COUNT) - 1]!;
}
