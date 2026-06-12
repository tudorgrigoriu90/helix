import { shareCardSpec, type ShareCardData, type ShareFormat } from './share-card';

/**
 * Share-image builder — T-531 (DR-011). Renders the {@link shareCardSpec}
 * draw spec onto an offscreen canvas and returns a PNG blob. Browser-only
 * (document/canvas); the layout itself lives in share-card.ts so it stays
 * unit-testable in node. A plain fill-and-text card renders in tens of
 * milliseconds — far inside the < 2 s budget; `ms` is reported so the scene
 * can log share_image_built timing if wanted.
 */

export interface BuiltShareImage {
  readonly blob: Blob;
  readonly format: ShareFormat;
  /** Wall-clock build time, for the < 2 s budget check (DR-011). */
  readonly ms: number;
}

export async function buildShareImage(
  data: ShareCardData,
  format: ShareFormat,
): Promise<BuiltShareImage> {
  const started = performance.now();
  const spec = shareCardSpec(data, format);

  const canvas = document.createElement('canvas');
  canvas.width = spec.width;
  canvas.height = spec.height;
  const ctx = canvas.getContext('2d');
  if (ctx === null) throw new Error('buildShareImage: 2d canvas unavailable');

  ctx.fillStyle = spec.background;
  ctx.fillRect(0, 0, spec.width, spec.height);

  // Accent frame.
  ctx.strokeStyle = spec.accent;
  ctx.lineWidth = 6;
  ctx.strokeRect(24, 24, spec.width - 48, spec.height - 48);

  for (const chip of spec.chips) {
    ctx.fillStyle = chip.color;
    ctx.fillRect(chip.x, chip.y, chip.w, chip.h);
  }

  ctx.textBaseline = 'top';
  for (const block of spec.texts) {
    ctx.fillStyle = block.color;
    ctx.font = `${block.size}px monospace`;
    ctx.textAlign = block.align;
    // Canvas has no letterSpacing pre-2023 everywhere; approximate by spacing
    // characters manually only when asked and supported.
    if (block.letterSpacing !== undefined && 'letterSpacing' in ctx) {
      (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing =
        `${block.letterSpacing}px`;
    } else if ('letterSpacing' in ctx) {
      (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = '0px';
    }
    ctx.fillText(block.text, block.x, block.y);
  }

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => (b !== null ? resolve(b) : reject(new Error('toBlob returned null'))), 'image/png');
  });
  return { blob, format, ms: performance.now() - started };
}
