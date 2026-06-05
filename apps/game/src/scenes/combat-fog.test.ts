import { describe, it, expect } from 'vitest';
import { isInVision, fogAlpha, VISION_RADIUS } from './combat-fog';

const O = { x: 0, y: 0 };

// ── isInVision ────────────────────────────────────────────────────────────────

describe('isInVision — T-441b', () => {
  it('player tile is always visible', () => {
    expect(isInVision(O, O)).toBe(true);
  });

  it('tiles within radius are visible', () => {
    expect(isInVision(O, { x: VISION_RADIUS, y: 0 })).toBe(true);
    expect(isInVision(O, { x: 0, y: VISION_RADIUS })).toBe(true);
    // Chebyshev: diagonal at (VISION_RADIUS, VISION_RADIUS) is still at radius
    expect(isInVision(O, { x: VISION_RADIUS, y: VISION_RADIUS })).toBe(true);
  });

  it('tiles beyond radius are hidden', () => {
    expect(isInVision(O, { x: VISION_RADIUS + 1, y: 0 })).toBe(false);
    expect(isInVision(O, { x: 0, y: VISION_RADIUS + 1 })).toBe(false);
  });

  it('works from a non-origin player position', () => {
    const p = { x: 6, y: 3 };
    expect(isInVision(p, { x: 6 + VISION_RADIUS, y: 3 })).toBe(true);
    expect(isInVision(p, { x: 6 + VISION_RADIUS + 1, y: 3 })).toBe(false);
  });
});

// ── fogAlpha ──────────────────────────────────────────────────────────────────

describe('fogAlpha — T-441b', () => {
  it('returns 0 for visible tiles', () => {
    expect(fogAlpha(O, O)).toBe(0);
    expect(fogAlpha(O, { x: VISION_RADIUS, y: 0 })).toBe(0);
  });

  it('returns a positive value for tiles just outside vision', () => {
    const alpha = fogAlpha(O, { x: VISION_RADIUS + 1, y: 0 });
    expect(alpha).toBeGreaterThan(0);
    expect(alpha).toBeLessThan(0.88);
  });

  it('returns maximum alpha for deeply hidden tiles', () => {
    const deepAlpha = fogAlpha(O, { x: VISION_RADIUS + 10, y: 0 });
    expect(deepAlpha).toBeCloseTo(0.88);
  });

  it('fog alpha increases with distance', () => {
    const close = fogAlpha(O, { x: VISION_RADIUS + 1, y: 0 });
    const far = fogAlpha(O, { x: VISION_RADIUS + 2, y: 0 });
    expect(far).toBeGreaterThanOrEqual(close);
  });
});
