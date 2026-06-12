import type { MutationFamily } from '@shared-types/mutation';

/**
 * Share-card layout — T-531 (DR-011: share pipeline in Gate-1 scope; UFD 08).
 *
 * Pure description of the "What You Became" card: given the run facts, produce
 * a positioned draw spec for either export format. The browser-only canvas
 * renderer (build-share-image.ts) and the Phaser preview both consume this, so
 * the shared image and the in-app preview can never drift apart.
 */

export type ShareFormat = 'story' | 'square';

/** Export dimensions per format (DR-011: 1080×1920 + 1080×1080). */
export const SHARE_FORMATS: Readonly<Record<ShareFormat, { w: number; h: number }>> = {
  story: { w: 1080, h: 1920 },
  square: { w: 1080, h: 1080 },
};

/** Everything the card shows — a pure subset of the run summary. */
export interface ShareCardData {
  readonly organismName: string;
  readonly won: boolean;
  readonly floorReached: number;
  readonly finalFloor: number;
  /** Resolved mutation display names. */
  readonly mutations: readonly string[];
  readonly dominantTraits: readonly MutationFamily[];
  readonly enemiesKilled: number;
}

/** Family accent colours (hex) — mirrors the strand-event palette. */
export const FAMILY_ACCENT: Readonly<Record<MutationFamily, string>> = {
  abyssal: '#9966ff',
  mycelial: '#44dd88',
  lithic: '#ddcc44',
  voidborn: '#44aaff',
  thermal: '#ff6644',
};

export interface ShareTextBlock {
  readonly text: string;
  readonly x: number;
  readonly y: number;
  /** px at export scale. */
  readonly size: number;
  readonly color: string;
  readonly align: 'center' | 'left';
  readonly letterSpacing?: number;
}

export interface ShareChip {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
  readonly color: string;
}

export interface ShareCardSpec {
  readonly width: number;
  readonly height: number;
  readonly background: string;
  readonly accent: string;
  readonly texts: readonly ShareTextBlock[];
  readonly chips: readonly ShareChip[];
}

/** The card's verdict line — never "you died" (LACE voice, GDD App D). */
export function verdictLine(data: ShareCardData): string {
  if (data.won) return 'REACHED THE CONVERGENCE';
  return `THE STRAND SEVERED — FLOOR ${data.floorReached} OF ${data.finalFloor}`;
}

/** Builds the positioned draw spec for one export format. */
export function shareCardSpec(data: ShareCardData, format: ShareFormat): ShareCardSpec {
  const { w, h } = SHARE_FORMATS[format];
  const cx = w / 2;
  const accent = FAMILY_ACCENT[data.dominantTraits[0] ?? 'abyssal'];
  const topPad = format === 'story' ? h * 0.16 : h * 0.1;

  const texts: ShareTextBlock[] = [
    { text: 'WHAT YOU BECAME', x: cx, y: topPad, size: 40, color: '#7a8fad', align: 'center', letterSpacing: 14 },
    { text: data.organismName.toUpperCase(), x: cx, y: topPad + 110, size: 72, color: '#e8edf5', align: 'center' },
    { text: verdictLine(data), x: cx, y: topPad + 220, size: 36, color: accent, align: 'center', letterSpacing: 4 },
    {
      text: `${data.mutations.length} mutation${data.mutations.length === 1 ? '' : 's'} · ${data.enemiesKilled} organisms broken`,
      x: cx, y: topPad + 300, size: 30, color: '#7a8fad', align: 'center',
    },
  ];

  // Mutation list — up to 6 names, centred under the stats line.
  data.mutations.slice(0, 6).forEach((name, i) => {
    texts.push({
      text: name, x: cx, y: topPad + 380 + i * 52, size: 32, color: '#a0ffdc', align: 'center',
    });
  });

  // Footer wordmark.
  texts.push({
    text: 'STRAND DESCENT', x: cx, y: h - 140, size: 38, color: '#e8edf5', align: 'center', letterSpacing: 12,
  });
  texts.push({
    text: 'descend · adapt · become', x: cx, y: h - 84, size: 24, color: '#7a8fad', align: 'center', letterSpacing: 6,
  });

  // Dominant-family chips above the footer.
  const chipW = 120;
  const chips: ShareChip[] = data.dominantTraits.slice(0, 5).map((family, i, all) => ({
    x: cx - (all.length * (chipW + 16) - 16) / 2 + i * (chipW + 16),
    y: h - 210,
    w: chipW,
    h: 14,
    color: FAMILY_ACCENT[family],
  }));

  return { width: w, height: h, background: '#070b14', accent, texts, chips };
}
