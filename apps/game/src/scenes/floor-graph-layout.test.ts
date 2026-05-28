import { describe, it, expect } from 'vitest';
import type { RoomNode } from '@shared-types/floor-graph';
import { computeBounds, computeLayout, project } from './floor-graph-layout';

const room = (id: string, x: number, y: number): RoomNode => ({ id, pos: { x, y } });

describe('computeBounds', () => {
  it('returns zero bounds for an empty room set', () => {
    expect(computeBounds([])).toEqual({
      minX: 0, minY: 0, maxX: 0, maxY: 0, width: 0, height: 0,
    });
  });

  it('handles a single room (zero width/height)', () => {
    expect(computeBounds([room('r0', 3, 4)])).toEqual({
      minX: 3, minY: 4, maxX: 3, maxY: 4, width: 0, height: 0,
    });
  });

  it('encloses a rectangular spread', () => {
    const rooms = [room('a', 0, 0), room('b', 5, 3), room('c', -2, 4)];
    expect(computeBounds(rooms)).toEqual({
      minX: -2, minY: 0, maxX: 5, maxY: 4, width: 7, height: 4,
    });
  });

  it('handles negative coordinates correctly', () => {
    const rooms = [room('a', -3, -3), room('b', -1, -5), room('c', -7, -2)];
    expect(computeBounds(rooms)).toEqual({
      minX: -7, minY: -5, maxX: -1, maxY: -2, width: 6, height: 3,
    });
  });

  it('produces zero width for a vertical chain', () => {
    const rooms = [room('a', 2, 0), room('b', 2, 1), room('c', 2, 5)];
    const b = computeBounds(rooms);
    expect(b.width).toBe(0);
    expect(b.height).toBe(5);
  });

  it('produces zero height for a horizontal chain (linear topology)', () => {
    const rooms = [room('a', 0, 0), room('b', 1, 0), room('c', 5, 0)];
    const b = computeBounds(rooms);
    expect(b.width).toBe(5);
    expect(b.height).toBe(0);
  });
});

describe('computeLayout', () => {
  const viewport = { x: 0, y: 0, width: 400, height: 400 };

  it('picks the limiting axis when the graph is square (height-limited equals width-limited)', () => {
    const bounds = { minX: 0, minY: 0, maxX: 7, maxY: 7, width: 7, height: 7 };
    const t = computeLayout(bounds, viewport, { padding: 0, minScale: 0, maxScale: 1000 });
    // 400 / 7 ≈ 57.14 on both axes
    expect(t.scale).toBeCloseTo(400 / 7, 3);
  });

  it('clamps scale to the maximum for very small graphs', () => {
    const bounds = { minX: 0, minY: 0, maxX: 1, maxY: 1, width: 1, height: 1 };
    const t = computeLayout(bounds, viewport, { padding: 0, maxScale: 50 });
    expect(t.scale).toBe(50); // would-be 400 capped at 50
  });

  it('clamps scale to the minimum for very large graphs', () => {
    const bounds = { minX: 0, minY: 0, maxX: 100, maxY: 100, width: 100, height: 100 };
    const t = computeLayout(bounds, viewport, { padding: 0, minScale: 10, maxScale: 1000 });
    // 400 / 100 = 4 → clamped up to 10
    expect(t.scale).toBe(10);
  });

  it('centers the graph within the viewport after applying scale', () => {
    const bounds = { minX: 0, minY: 0, maxX: 2, maxY: 2, width: 2, height: 2 };
    const t = computeLayout(bounds, viewport, { padding: 0, minScale: 0, maxScale: 100 });
    // scale=100 → usedW = 200; offsetX = (400 - 200) / 2 = 100
    expect(t.offsetX).toBe(100);
    expect(t.offsetY).toBe(100);
  });

  it('respects the padding parameter on all sides', () => {
    const bounds = { minX: 0, minY: 0, maxX: 1, maxY: 1, width: 1, height: 1 };
    const t = computeLayout(bounds, viewport, { padding: 20, minScale: 0, maxScale: 100 });
    // inner=360, used at scale=100 → 100, centered with padding gives offset >= 20
    expect(t.offsetX).toBeGreaterThanOrEqual(20);
    expect(t.offsetY).toBeGreaterThanOrEqual(20);
  });

  it('does not divide by zero on horizontally-collinear (height=0) bounds', () => {
    const bounds = { minX: 0, minY: 0, maxX: 7, maxY: 0, width: 7, height: 0 };
    const t = computeLayout(bounds, viewport, { padding: 0, minScale: 0, maxScale: 1000 });
    expect(Number.isFinite(t.scale)).toBe(true);
    expect(Number.isFinite(t.offsetX)).toBe(true);
    expect(Number.isFinite(t.offsetY)).toBe(true);
  });

  it('does not divide by zero on vertically-collinear (width=0) bounds', () => {
    const bounds = { minX: 2, minY: 0, maxX: 2, maxY: 5, width: 0, height: 5 };
    const t = computeLayout(bounds, viewport, { padding: 0, minScale: 0, maxScale: 1000 });
    expect(Number.isFinite(t.scale)).toBe(true);
    expect(Number.isFinite(t.offsetX)).toBe(true);
    expect(Number.isFinite(t.offsetY)).toBe(true);
  });
});

describe('project', () => {
  const bounds = { minX: 0, minY: 0, maxX: 4, maxY: 4, width: 4, height: 4 };
  const t = { scale: 50, offsetX: 100, offsetY: 200 };

  it('maps the bounds origin to the layout offset', () => {
    expect(project({ x: 0, y: 0 }, bounds, t)).toEqual({ x: 100, y: 200 });
  });

  it('scales positions linearly from the offset', () => {
    expect(project({ x: 1, y: 1 }, bounds, t)).toEqual({ x: 150, y: 250 });
    expect(project({ x: 2, y: 0 }, bounds, t)).toEqual({ x: 200, y: 200 });
  });

  it('handles negative-origin bounds via the offset', () => {
    const negBounds = { minX: -3, minY: -3, maxX: 0, maxY: 0, width: 3, height: 3 };
    expect(project({ x: -3, y: -3 }, negBounds, t)).toEqual({ x: 100, y: 200 });
    expect(project({ x: -2, y: -1 }, negBounds, t)).toEqual({ x: 150, y: 300 });
  });
});
