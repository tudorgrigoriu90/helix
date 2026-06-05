/**
 * Pure helpers for the Strand Event scene (T-182/183/184/185/186/188/191/192).
 *
 * Family and tier visual look tables, the confirm-hint grace threshold, and a
 * small utility for counting owned mutations by family (used for the "N of 3
 * to Dominant Trait" synergy hint shown in the card detail strip).
 *
 * Phaser-free — unit-testable without a running scene.
 */

import type { MutationFamily, MutationTier } from '@shared-types/mutation';

// ── Family look ───────────────────────────────────────────────────────────────

export interface FamilyLook {
  /** Dark fill for the card background when the card is selected. */
  readonly bgHex: number;
  /** Accent colour (numeric) for the family spine + selected border. */
  readonly accentHex: number;
  /** Accent colour (CSS string) for text labels. */
  readonly accentLabel: string;
  /** One-line flavour description shown in the card detail strip. */
  readonly lore: string;
}

export const FAMILY_LOOK: Record<MutationFamily, FamilyLook> = {
  abyssal:  { bgHex: 0x12103a, accentHex: 0x7744ff, accentLabel: '#9966ff', lore: 'Depth adaptation — pressure, void, dissolution.' },
  mycelial: { bgHex: 0x0e2a14, accentHex: 0x22bb66, accentLabel: '#44dd88', lore: 'Fungal network — spores, symbiosis, entangled decay.' },
  lithic:   { bgHex: 0x1e1c08, accentHex: 0xbbaa22, accentLabel: '#ddcc44', lore: 'Mineral shell — density, structural resilience, inertia.' },
  voidborn: { bgHex: 0x08121e, accentHex: 0x2288ee, accentLabel: '#44aaff', lore: 'Null resonance — erasure, phase collapse, silence.' },
  thermal:  { bgHex: 0x2a1008, accentHex: 0xee5522, accentLabel: '#ff6644', lore: 'Heat cascade — combustion, entropy, ignition chains.' },
};

// ── Tier look ─────────────────────────────────────────────────────────────────

export interface TierLook {
  /** Phaser numeric colour for fills. */
  readonly hex: number;
  /** CSS string for text. */
  readonly label: string;
  /** Short uppercase badge displayed top-right of the card. */
  readonly badge: string;
}

export const TIER_LOOK: Record<MutationTier, TierLook> = {
  minor:    { hex: 0x5a6a80, label: '#7a8fad', badge: 'MINOR'    },
  major:    { hex: 0x44aa88, label: '#a0ffdc', badge: 'MAJOR'    },
  dominant: { hex: 0xbbaa22, label: '#ffdd44', badge: 'DOMINANT' },
};

// ── Confirm-hint grace window ─────────────────────────────────────────────────

/**
 * How many lifetime runs a player needs before the two-tap Strand pick
 * confirm is silenced. Mirrors the move-confirm grace window.
 */
export const STRAND_CONFIRM_GRACE_RUNS = 3;

/** Whether to show the two-tap "TAKE → tap again to confirm" hint. */
export function showStrandConfirmHint(lifetimeRuns: number): boolean {
  return lifetimeRuns < STRAND_CONFIRM_GRACE_RUNS;
}

// ── Synergy utility ───────────────────────────────────────────────────────────

/**
 * Counts how many of the player's owned mutation families equal `family`.
 * Used to surface the "N of 3 to Dominant Trait" synergy hint.
 */
export function familyCountIn(family: MutationFamily, mutationFamilies: readonly MutationFamily[]): number {
  return mutationFamilies.filter((f) => f === family).length;
}
