import type { ShareCardInput, ShareCardSpec, ShareFormat } from './share-card';
import { buildShareCard, SHARE_FORMATS } from './share-card';

/**
 * Share-image rasteriser — T-331 (UFD S143).
 *
 * Renders a {@link ShareCardSpec} onto a 2D canvas surface. The drawing
 * surface is the small {@link Canvas2DSurface} interface rather than the DOM
 * type, so the renderer is unit-testable with a recording stub; at runtime
 * the surface is a real `<canvas>` 2D context and {@link buildShareImage}
 * returns a data URL ready for the share sheet / camera roll. Generation is
 * pure 2D fills — well inside the 2-second budget on-device.
 */

/** The slice of CanvasRenderingContext2D the renderer needs. */
export interface Canvas2DSurface {
  fillStyle: string;
  font: string;
  textAlign: string;
  textBaseline: string;
  fillRect(x: number, y: number, w: number, h: number): void;
  fillText(text: string, x: number, y: number): void;
}

/** Draws every element of `spec` onto `ctx` in order. */
export function renderShareCard(spec: ShareCardSpec, ctx: Canvas2DSurface): void {
  for (const el of spec.elements) {
    if (el.kind === 'rect') {
      ctx.fillStyle = el.color;
      ctx.fillRect(el.x, el.y, el.w, el.h);
    } else {
      ctx.fillStyle = el.color;
      ctx.font = el.font;
      ctx.textAlign = el.align;
      ctx.textBaseline = 'middle';
      ctx.fillText(el.text, el.x, el.y);
    }
  }
}

export interface ShareImage {
  readonly format: ShareFormat;
  readonly width: number;
  readonly height: number;
  /** PNG data URL — the unit the share adapter and save-to-roll consume. */
  readonly dataUrl: string;
}

/**
 * Builds the share PNG for one format. Browser-only (creates a `<canvas>`);
 * everything underneath it is pure and tested headlessly.
 */
export function buildShareImage(input: ShareCardInput, format: ShareFormat): ShareImage {
  const { width, height } = SHARE_FORMATS[format];
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (ctx === null) throw new Error('buildShareImage: 2D canvas unavailable');
  renderShareCard(buildShareCard(input, format), ctx as unknown as Canvas2DSurface);
  return { format, width, height, dataUrl: canvas.toDataURL('image/png') };
}
