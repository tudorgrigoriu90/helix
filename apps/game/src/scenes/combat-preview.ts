/**
 * Pure combat-preview helpers (T-163 / T-164, S042 / S043).
 *
 * The move preview shows the player where they can step and (on first tap) how
 * much it costs; the attack preview shows expected damage + crit chance for the
 * enemy the cursor is hovering over. Both are pre-commit — the player sees the
 * numbers before they commit an AP.
 *
 * Kept Phaser-free so it can be unit-tested without a scene.
 */

import type { EntityStats, ActiveStatus } from '@shared-types/run-state';
import { critChanceFor, CRIT_MULTIPLIER, BASE_CRIT_CHANCE } from '../core/turn-engine/combat';
import { damageTo } from '../core/turn-engine/effective-stats';

// ── Move preview (T-163 / S042) ───────────────────────────────────────────────

/**
 * After how many lifetime runs the two-tap move confirmation is silenced.
 * Veteran players already know the mechanic; the confirmation is friction.
 */
export const MOVE_CONFIRM_GRACE_RUNS = 5;

/** Whether the two-tap confirm hint should be shown to this player. */
export function showMoveConfirmHint(lifetimeRuns: number): boolean {
  return lifetimeRuns < MOVE_CONFIRM_GRACE_RUNS;
}

/**
 * Reachable adjacent tile positions for a player at `pos` on a `w×h` grid,
 * filtering walls and tiles occupied by enemies.
 */
export function reachableMoves(
  pos: { readonly x: number; readonly y: number },
  grid: { readonly width: number; readonly height: number },
  blockedTiles: ReadonlySet<string>,
): Array<{ x: number; y: number }> {
  const dirs = [
    { x: -1, y: 0 }, { x: 1, y: 0 }, { x: 0, y: -1 }, { x: 0, y: 1 },
    { x: -1, y: -1 }, { x: 1, y: -1 }, { x: -1, y: 1 }, { x: 1, y: 1 },
  ];
  const result: Array<{ x: number; y: number }> = [];
  for (const d of dirs) {
    const nx = pos.x + d.x;
    const ny = pos.y + d.y;
    if (nx < 0 || ny < 0 || nx >= grid.width || ny >= grid.height) continue;
    if (blockedTiles.has(`${nx},${ny}`)) continue;
    result.push({ x: nx, y: ny });
  }
  return result;
}

// ── Attack preview (T-164 / S043) ─────────────────────────────────────────────

export interface AttackPreview {
  /** Normal-hit damage (after defence mitigation). */
  readonly normalDmg: number;
  /** Crit-hit damage (after mitigation). */
  readonly critDmg: number;
  /** Crit chance [0, 1]. */
  readonly critChance: number;
  /** Display string: "N–M (X% crit)" or "N (X% crit)" if equal. */
  readonly label: string;
}

/**
 * Compute the melee attack preview for a player striking `target`.
 * Uses the same formulas the engine uses (damageTo + critChanceFor) so the
 * displayed numbers are always accurate.
 */
export function attackPreview(
  attackerStats: EntityStats,
  target: { readonly stats: EntityStats; readonly statuses: readonly ActiveStatus[] },
): AttackPreview {
  const baseDmg = Math.floor(attackerStats.str);
  const normalDmg = damageTo(target, baseDmg, 'physical');
  const critDmg = damageTo(target, Math.floor(baseDmg * CRIT_MULTIPLIER), 'physical');
  const critChance = critChanceFor(attackerStats.agi);
  const critPct = Math.round(critChance * 100);

  const dmgPart = normalDmg === critDmg ? `${normalDmg}` : `${normalDmg}–${critDmg}`;
  const label = `${dmgPart} dmg  ·  ${critPct}% crit  ·  1 AP`;
  return { normalDmg, critDmg, critChance, label };
}

/** Exported for tests: the base crit chance at neutral AGI. */
export { BASE_CRIT_CHANCE };
