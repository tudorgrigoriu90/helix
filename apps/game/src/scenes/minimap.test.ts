import { describe, it, expect } from 'vitest';
import { floorProgress, compactMinimapRect } from './minimap';

describe('floorProgress — T-155', () => {
  const rooms = ['start', 'a', 'b', 'c', 'boss'];

  it('counts cleared rooms among the floor', () => {
    const p = floorProgress(rooms, new Set(['start', 'a']));
    expect(p.cleared).toBe(2);
    expect(p.total).toBe(5);
    expect(p.fraction).toBeCloseTo(2 / 5);
  });

  it('ignores cleared ids that are not on this floor', () => {
    const p = floorProgress(rooms, new Set(['start', 'ghost-from-last-floor']));
    expect(p.cleared).toBe(1);
    expect(p.total).toBe(5);
  });

  it('reports a full floor as fraction 1', () => {
    const p = floorProgress(rooms, new Set(rooms));
    expect(p.cleared).toBe(5);
    expect(p.fraction).toBe(1);
  });

  it('reports nothing cleared as fraction 0', () => {
    const p = floorProgress(rooms, new Set());
    expect(p.cleared).toBe(0);
    expect(p.fraction).toBe(0);
  });

  it('handles an empty floor without dividing by zero', () => {
    const p = floorProgress([], new Set(['x']));
    expect(p).toEqual({ cleared: 0, total: 0, fraction: 0 });
  });
});

describe('compactMinimapRect — T-155', () => {
  it('pins a square to the top-right corner under the HUD', () => {
    const rect = compactMinimapRect(390, 66, 8, 10);
    expect(rect).toEqual({ x: 390 - 66 - 10, y: 8, width: 66, height: 66 });
  });

  it('keeps the requested size on both axes', () => {
    const rect = compactMinimapRect(390, 50, 12, 6);
    expect(rect.width).toBe(50);
    expect(rect.height).toBe(50);
    expect(rect.x).toBe(390 - 50 - 6);
  });
});
