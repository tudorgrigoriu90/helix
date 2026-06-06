import type { PopulatedRoom } from '@shared-types/floor-plan';
import type { Mulberry32 } from '../rng/mulberry32';

/**
 * Codex Fragment placement — T-76 (GDD §7.2 step 6).
 *
 * After a floor's rooms are built, scatter 0–4 collectible Codex Fragments
 * across its **non-boss** rooms. Fragments are pure lore pickups (they add a
 * codex entry to MetaState when collected); they don't affect combat or
 * topology, so this runs as the last generation step and never invalidates a
 * floor.
 *
 * Deterministic from the floor's RNG stream: the same seed always scatters the
 * same fragments. Selection is uniform over eligible rooms via a partial
 * Fisher–Yates, and the count is clamped to the number of eligible rooms so a
 * tiny floor never asks for more fragments than it can hold.
 */

/** Fewest fragments a floor can hold (GDD §7.2). */
export const MIN_CODEX_FRAGMENTS = 0;
/** Most fragments a floor can hold (GDD §7.2). */
export const MAX_CODEX_FRAGMENTS = 4;

/**
 * Returns a new room list with a Codex Fragment marked on a random subset of
 * non-boss rooms (0–4, clamped to availability). Never mutates the input rooms.
 */
export function placeCodexFragments(
  rooms: readonly PopulatedRoom[],
  rng: Mulberry32,
): PopulatedRoom[] {
  // Roll the count first (always consumes one draw, so adding/removing eligible
  // rooms doesn't shift this stream) then clamp to what the floor can hold.
  const span = MAX_CODEX_FRAGMENTS - MIN_CODEX_FRAGMENTS + 1;
  const rolled = MIN_CODEX_FRAGMENTS + rng.nextInt(span);

  const eligibleIdx = rooms
    .map((room, i) => ({ room, i }))
    .filter(({ room }) => room.type !== 'boss')
    .map(({ i }) => i);

  const take = Math.min(rolled, eligibleIdx.length);
  if (take === 0) return rooms.slice();

  // Partial Fisher–Yates over the eligible indices: swap `take` to the front.
  const pool = [...eligibleIdx];
  const chosen = new Set<number>();
  for (let k = 0; k < take; k++) {
    const j = k + Math.floor(rng.next() * (pool.length - k));
    const tmp = pool[k]!;
    pool[k] = pool[j]!;
    pool[j] = tmp;
    chosen.add(pool[k]!);
  }

  return rooms.map((room, i) => (chosen.has(i) ? { ...room, codexFragment: true } : room));
}
