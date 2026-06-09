import type { Zone } from '@shared-types/floor-template';

/**
 * Canonical campaign structure — T-323 (DR-008/DR-009).
 *
 * The single source of truth for the descent's shape: how many floors, how
 * they group into zones, and where the Zone Wardens sit. Everything that used
 * to hardcode `20`, `5`, or "every fifth floor" (pricing, the run loop, the
 * content validator) derives from here, closing the historical
 * FLOORS_PER_ZONE drift defect class.
 */

/** The final floor — clearing its Warden wins the run (GDD §3). */
export const MAX_FLOOR = 20;

/** Floors per zone (GDD §6 / Economy.xlsx "Assumptions" — 4 Zones × 5 = 20). */
export const FLOORS_PER_ZONE = 5;

/** The four zones in descent order (GDD §3.2). */
export const ZONES: readonly Zone[] = ['shallows', 'mycosphere', 'lithic', 'convergence'];

/** Floors whose boss is a Zone Warden (DR-008): each zone's finale. */
export const WARDEN_FLOORS: readonly number[] = [5, 10, 15, 20];

/** True when `floor`'s boss is a Zone Warden rather than a Floor Boss. */
export function isWardenFloor(floor: number): boolean {
  return floor >= 1 && floor % FLOORS_PER_ZONE === 0 && floor <= MAX_FLOOR;
}

/** The 1-based zone a floor belongs to (Zone 1 = floors 1–5, …, Zone 4 = 16–20). */
export function zoneIndexForFloor(floor: number): number {
  return Math.max(1, Math.ceil(floor / FLOORS_PER_ZONE));
}

/** The biome a floor belongs to (clamped to the last zone past MAX_FLOOR). */
export function zoneForFloor(floor: number): Zone {
  return ZONES[Math.min(zoneIndexForFloor(floor), ZONES.length) - 1]!;
}
