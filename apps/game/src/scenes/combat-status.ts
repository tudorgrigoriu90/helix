import type { ActiveStatus, StatusEffect } from '@shared-types/run-state';

/**
 * Pure status-badge helpers for the in-combat status display (T-172, S050).
 *
 * Maps each {@link StatusEffect} to a compact glyph + colour so the combat scene
 * can show, at a glance, which effects are riding a combatant and for how long.
 * The damaging ticks (Burn, Overheated) and the heal-over-time (Regenerating)
 * pulse per turn via the enemy-phase sequence; this module backs the persistent
 * badge row that stays visible between ticks.
 *
 * Kept Phaser-free so it can be unit-tested without a scene.
 */

export interface StatusBadge {
  /** Single-letter glyph, unique per status. */
  readonly glyph: string;
  /** CSS colour string for scene text. */
  readonly color: string;
  /** Numeric colour for Phaser graphics tints/fills. */
  readonly hex: number;
  /** Turns remaining, surfaced next to the glyph. */
  readonly turns: number;
}

const TABLE: Record<StatusEffect, { readonly glyph: string; readonly hex: number }> = {
  burn: { glyph: 'B', hex: 0xff6600 },
  infected: { glyph: 'I', hex: 0x44cc44 },
  stagger: { glyph: 'S', hex: 0xffaa33 },
  suppressed: { glyph: 'U', hex: 0xcc66ff },
  fractured: { glyph: 'F', hex: 0xff5577 },
  crushed: { glyph: 'C', hex: 0xcc8844 },
  rooted: { glyph: 'R', hex: 0x8899ff },
  phased: { glyph: 'P', hex: 0x66ffff },
  regenerating: { glyph: 'G', hex: 0x44ff88 },
  overheated: { glyph: 'O', hex: 0xff3300 },
};

const FALLBACK = { glyph: '?', hex: 0xaa44ff };

/** Numeric colour for a status tile flash (used by the per-tick pulse). */
export function statusHex(status: StatusEffect): number {
  return (TABLE[status] ?? FALLBACK).hex;
}

/** Single-letter glyph for a status. */
export function statusGlyph(status: StatusEffect): string {
  return (TABLE[status] ?? FALLBACK).glyph;
}

/**
 * Build the ordered badge list for a combatant's active statuses, preserving the
 * order they appear in. Statuses with a non-positive timer are dropped (they have
 * effectively expired and should no longer show).
 */
export function statusBadges(statuses: readonly ActiveStatus[]): StatusBadge[] {
  const badges: StatusBadge[] = [];
  for (const s of statuses) {
    if (s.turnsRemaining <= 0) continue;
    const entry = TABLE[s.effect] ?? FALLBACK;
    badges.push({
      glyph: entry.glyph,
      color: `#${entry.hex.toString(16).padStart(6, '0')}`,
      hex: entry.hex,
      turns: s.turnsRemaining,
    });
  }
  return badges;
}
