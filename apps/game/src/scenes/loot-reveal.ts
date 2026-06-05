import type { ItemRarity } from '@shared-types/item';

/**
 * Pure loot-reveal presentation (T-180, S027, GDD §9.2).
 *
 * Maps an item's rarity band to the visual language of the loot-reveal screen —
 * accent colour, glow strength, and a banner label — so a Legendary *reads* as a
 * Legendary (gold, a strong pulsing aura) and a common doesn't shout. The scene
 * turns this into Phaser graphics + tweens; keeping the mapping here makes the
 * rarity ramp unit-testable and the single source of truth.
 */

export interface RarityLook {
  /** Numeric colour for fills/strokes/tints. */
  readonly hex: number;
  /** CSS colour string for text. */
  readonly color: string;
  /** Aura strength 0–1 (0 = no glow). Drives the pulsing reveal ring. */
  readonly glow: number;
  /** Higher = rarer. Used for ordering and "does it glow" thresholds. */
  readonly rank: number;
  /** Uppercase banner label. */
  readonly label: string;
}

const LOOKS: Record<ItemRarity, Omit<RarityLook, 'color' | 'label'>> = {
  common: { hex: 0x9aa7ba, glow: 0, rank: 0 },
  uncommon: { hex: 0x44ff88, glow: 0.35, rank: 1 },
  rare: { hex: 0x44ccff, glow: 0.6, rank: 2 },
  legendary: { hex: 0xffb030, glow: 1, rank: 3 },
};

const FALLBACK = { hex: 0x9aa7ba, glow: 0, rank: 0 };

/** Visual treatment for an item rarity (T-180). */
export function rarityLook(rarity: ItemRarity): RarityLook {
  const base = LOOKS[rarity] ?? FALLBACK;
  return {
    ...base,
    color: `#${base.hex.toString(16).padStart(6, '0')}`,
    label: rarity.toUpperCase(),
  };
}

/** Whether a rarity earns the special glowing reveal (rare and up). */
export function rarityGlows(rarity: ItemRarity): boolean {
  return rarityLook(rarity).rank >= 2;
}
