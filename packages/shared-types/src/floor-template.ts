/**
 * Floor template — the data contract for procedural floor generation.
 *
 * Per TDD §7.1, floors are *template-driven* procedural, not pure random.
 * Each template defines the recipe for one (floor, zone) pair: how many
 * rooms, what mix of room types, what enemies are eligible, which boss
 * caps the floor, and an aesthetic tag set for the renderer + LACE.
 *
 * Schema lives in @shared-types because it's a stable content contract
 * — same rationale as AbilityDef and ItemDef. Content authors (Director)
 * edit JSON files; the engine consumes typed objects via the loader.
 */

/** The seven room kinds the floor filler can place. Boss is placed separately. */
export type RoomType =
  | 'combat'
  | 'loot'
  | 'safe'
  | 'merchant'
  | 'trap'
  | 'lace_event'
  | 'boss';

/** GDD §7.1 zones. Drives enemy palette + biome aesthetics. */
export type Zone = 'shallows' | 'mycosphere' | 'lithic' | 'convergence';

/** Room-graph layout strategy used by the placement algorithm (T-71). */
export type ConnectivityRule = 'linear' | 'branching' | 'loop';

/**
 * Probability weights for the weighted random room-type filler (GDD §7.2).
 * The five fillable types should sum to ~1.0 (boss is placed separately and
 * is not part of the weighted draw). The loader tolerates rounding within
 * {@link ROOM_WEIGHTS_TOLERANCE} so authoring with two decimals is safe.
 */
export interface RoomTypeWeights {
  readonly combat: number;
  readonly loot: number;
  readonly safe: number;
  readonly merchant: number;
  readonly trap: number;
  readonly lace_event: number;
}

/**
 * Hard minimum room counts overlaid on top of the weighted draw. Per GDD §7.2:
 *   - `safe: 1` is mandatory on every floor (the player must be able to rest).
 *   - `merchant: 1` is mandatory on floors 3+ (and 2 on floors 10+).
 * Other room types have no minimum at launch.
 */
export interface RoomTypeMinima {
  readonly safe?: number;
  readonly merchant?: number;
  readonly loot?: number;
  readonly trap?: number;
  readonly lace_event?: number;
}

/** Inclusive room-count range for a floor. */
export interface RoomCountRange {
  readonly min: number;
  readonly max: number;
}

export interface FloorTemplate {
  /** Bumped when the on-disk JSON shape changes; loader runs migrations. */
  readonly schemaVersion: number;
  /** 1..20 at launch (Path A scope). */
  readonly floor: number;
  /** Biome. Drives enemy pool and aesthetic tags downstream. */
  readonly zone: Zone;
  /** Inclusive room-count range. TDD §7.2 default 8..14. */
  readonly roomCount: RoomCountRange;
  /** Weights for the weighted random filler. Should sum to ~1.0. */
  readonly roomWeights: RoomTypeWeights;
  /** Hard minimums overlaid on the weighted draw. */
  readonly roomMinima: RoomTypeMinima;
  /** Room-graph layout strategy. */
  readonly connectivity: ConnectivityRule;
  /** Enemy def ids drawn for this floor's combat rooms. Validated against the enemy registry in T-288. */
  readonly enemyPool: readonly string[];
  /** Boss def id for the floor's boss room. */
  readonly bossId: string;
  /** Aesthetic tags consumed by the renderer + LACE narration. */
  readonly aestheticTags: readonly string[];
}

// ── Constants exported for use by the loader and tests ───────────────────────

/** Tolerance on the room-weight sum (allows authoring with two-decimal weights). */
export const ROOM_WEIGHTS_TOLERANCE = 0.001;

/** The current floor-template schema version. Increment when the on-disk shape changes. */
export const CURRENT_FLOOR_TEMPLATE_SCHEMA_VERSION = 1;
