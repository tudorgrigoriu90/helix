/**
 * Share-card layout — T-331 (UFD Scope 8, S143).
 *
 * Builds the "What You Became" card as a pure spec: a list of positioned
 * draw primitives for one of the two locked formats (1080×1920 vertical for
 * stories, 1080×1080 square for feeds). Phaser- and DOM-free so the layout
 * is unit-testable; `build-share-image.ts` rasterises a spec onto a canvas.
 */

export type ShareFormat = 'vertical' | 'square';

export const SHARE_FORMATS: Readonly<Record<ShareFormat, { width: number; height: number }>> = {
  vertical: { width: 1080, height: 1920 },
  square: { width: 1080, height: 1080 },
};

export interface ShareCardInput {
  readonly organismName: string;
  readonly won: boolean;
  readonly floorReached: number;
  readonly finalFloor: number;
  /** Resolved mutation display names. */
  readonly mutations: readonly string[];
  readonly dominantTraits: readonly string[];
  readonly enemiesKilled: number;
  readonly playtimeMs: number;
  /** Attribution URL printed on the card (swappable builder — T-340). */
  readonly shareUrl: string;
}

export interface ShareRect {
  readonly kind: 'rect';
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
  readonly color: string;
}

export interface ShareText {
  readonly kind: 'text';
  readonly x: number;
  readonly y: number;
  readonly text: string;
  readonly color: string;
  /** CSS-style font shorthand (monospace throughout — the game's face). */
  readonly font: string;
  readonly align: 'left' | 'center';
}

export type ShareElement = ShareRect | ShareText;

export interface ShareCardSpec {
  readonly format: ShareFormat;
  readonly width: number;
  readonly height: number;
  readonly elements: readonly ShareElement[];
}

const BG = '#070b14';
const ACCENT = '#a0ffdc';
const GOLD = '#ffdd44';
const TEXT = '#e8edf5';
const DIM = '#7a8fad';

const mono = (px: number, bold = false): string => `${bold ? 'bold ' : ''}${px}px monospace`;

function formatPlaytime(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/** Lays the card out for `format`. Mutations are capped at four lines (the
 *  run cap); everything centres on the card's vertical axis. */
export function buildShareCard(input: ShareCardInput, format: ShareFormat): ShareCardSpec {
  const { width, height } = SHARE_FORMATS[format];
  const cx = width / 2;
  const vertical = format === 'vertical';
  const elements: ShareElement[] = [];

  // Background + frame accents.
  elements.push({ kind: 'rect', x: 0, y: 0, w: width, h: height, color: BG });
  elements.push({ kind: 'rect', x: 0, y: 0, w: width, h: 10, color: ACCENT });
  elements.push({ kind: 'rect', x: 0, y: height - 10, w: width, h: 10, color: ACCENT });

  // Header block.
  const top = vertical ? 200 : 90;
  elements.push({ kind: 'text', x: cx, y: top, text: 'STRAND DESCENT', color: DIM, font: mono(44), align: 'center' });
  elements.push({ kind: 'text', x: cx, y: top + 90, text: 'WHAT I BECAME', color: ACCENT, font: mono(56, true), align: 'center' });

  // The organism — the share unit.
  const nameY = vertical ? top + 320 : top + 230;
  elements.push({ kind: 'text', x: cx, y: nameY, text: input.organismName.toUpperCase(), color: TEXT, font: mono(72, true), align: 'center' });

  const depth = input.won
    ? 'FULL DESCENT — FLOOR 20'
    : `REACHED FLOOR ${input.floorReached} / ${input.finalFloor}`;
  elements.push({ kind: 'text', x: cx, y: nameY + 100, text: depth, color: input.won ? GOLD : DIM, font: mono(48), align: 'center' });

  // Mutations (the build) — at most the run's four slots.
  const mutTop = nameY + (vertical ? 260 : 190);
  const shown = input.mutations.slice(0, 4);
  if (shown.length > 0) {
    elements.push({ kind: 'text', x: cx, y: mutTop - 70, text: '— STRANDS —', color: DIM, font: mono(36), align: 'center' });
    shown.forEach((name, i) => {
      elements.push({ kind: 'text', x: cx, y: mutTop + i * 64, text: name, color: ACCENT, font: mono(44), align: 'center' });
    });
  }

  // Dominant traits, when the build earned one.
  if (input.dominantTraits.length > 0) {
    const traitY = mutTop + shown.length * 64 + 40;
    elements.push({
      kind: 'text', x: cx, y: traitY,
      text: `DOMINANT: ${input.dominantTraits.map((t) => t.toUpperCase()).join(' · ')}`,
      color: GOLD, font: mono(40), align: 'center',
    });
  }

  // Stats strip + attribution.
  const statsY = height - (vertical ? 260 : 200);
  elements.push({
    kind: 'text', x: cx, y: statsY,
    text: `${input.enemiesKilled} kills · ${formatPlaytime(input.playtimeMs)}`,
    color: DIM, font: mono(40), align: 'center',
  });
  elements.push({ kind: 'text', x: cx, y: height - 120, text: input.shareUrl, color: ACCENT, font: mono(40), align: 'center' });

  return { format, width, height, elements };
}
