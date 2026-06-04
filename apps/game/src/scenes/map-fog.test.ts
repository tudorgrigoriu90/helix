import { describe, it, expect } from 'vitest';
import type { FloorEdge } from '@shared-types/floor-graph';
import type { RoomType } from '@shared-types/floor-template';
import { computeFogReveal, edgeVisible } from './map-fog';

interface Room { id: string; type: RoomType; }

/**
 * A small fixed floor:
 *
 *   start ── a(combat) ── b(loot) ── boss
 *              │
 *              c(safe)
 *
 * `d(combat)` hangs off boss, two rings from start.
 */
function floor() {
  const rooms: Room[] = [
    { id: 'start', type: 'combat' },
    { id: 'a', type: 'combat' },
    { id: 'b', type: 'loot' },
    { id: 'c', type: 'safe' },
    { id: 'boss', type: 'boss' },
    { id: 'd', type: 'combat' },
  ];
  const edges: FloorEdge[] = [
    { from: 'start', to: 'a' },
    { from: 'a', to: 'b' },
    { from: 'a', to: 'c' },
    { from: 'b', to: 'boss' },
    { from: 'boss', to: 'd' },
  ];
  return { rooms, edges };
}

describe('computeFogReveal — T-154', () => {
  it('returns an entry for every room', () => {
    const reveal = computeFogReveal(floor(), new Set(['start']));
    expect(reveal.size).toBe(6);
  });

  it('marks visited rooms fully shown', () => {
    const reveal = computeFogReveal(floor(), new Set(['start', 'a']));
    expect(reveal.get('start')).toEqual({ level: 'visited', typeKnown: true });
    expect(reveal.get('a')).toEqual({ level: 'visited', typeKnown: true });
  });

  it('reveals neighbours of visited rooms as type-hidden outlines', () => {
    const reveal = computeFogReveal(floor(), new Set(['start']));
    // `a` is one corridor from start → discovered, but its type stays unknown.
    expect(reveal.get('a')).toEqual({ level: 'discovered', typeKnown: false });
  });

  it('hides rooms beyond the explored frontier', () => {
    const reveal = computeFogReveal(floor(), new Set(['start']));
    // `b`, `boss`, `d` are two+ corridors away and not safe → hidden.
    expect(reveal.get('b')?.level).toBe('hidden');
    expect(reveal.get('boss')?.level).toBe('hidden');
    expect(reveal.get('d')?.level).toBe('hidden');
  });

  it('always shows safe rooms with their type, even unvisited and far away', () => {
    // Visit nothing adjacent to `c`; it must still be discovered with type known.
    const reveal = computeFogReveal(floor(), new Set(['start']));
    expect(reveal.get('c')).toEqual({ level: 'discovered', typeKnown: true });
  });

  it('a visited safe room is still fully visited (visited beats the safe rule)', () => {
    const reveal = computeFogReveal(floor(), new Set(['start', 'a', 'c']));
    expect(reveal.get('c')).toEqual({ level: 'visited', typeKnown: true });
  });

  it('expands the discovered ring as more rooms are visited', () => {
    const reveal = computeFogReveal(floor(), new Set(['start', 'a', 'b']));
    // boss is now one corridor from visited `b` → discovered outline.
    expect(reveal.get('boss')).toEqual({ level: 'discovered', typeKnown: false });
    // d is still two corridors away → hidden.
    expect(reveal.get('d')?.level).toBe('hidden');
  });

  it('treats a room with no visited neighbours as hidden (empty visited set)', () => {
    const reveal = computeFogReveal(floor(), new Set());
    expect(reveal.get('start')?.level).toBe('hidden');
    expect(reveal.get('a')?.level).toBe('hidden');
    // …except the safe room, always shown.
    expect(reveal.get('c')?.level).toBe('discovered');
  });
});

describe('edgeVisible — T-154', () => {
  it('shows a corridor when either end is visited', () => {
    const visited = new Set(['start']);
    expect(edgeVisible({ from: 'start', to: 'a' }, visited)).toBe(true);
    expect(edgeVisible({ from: 'a', to: 'start' }, visited)).toBe(true);
  });

  it('hides a corridor between two unvisited rooms', () => {
    expect(edgeVisible({ from: 'b', to: 'boss' }, new Set(['start']))).toBe(false);
  });
});
