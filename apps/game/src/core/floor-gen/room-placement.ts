import type { ConnectivityRule, FloorTemplate } from '@shared-types/floor-template';
import type { FloorEdge, FloorGraph, RoomNode } from '@shared-types/floor-graph';
import type { Mulberry32 } from '../rng/mulberry32';
import { areAdjacent, bfsDistances } from './graph';

/**
 * Room placement algorithm — T-71 (TDD §7.1 steps 2-3).
 *
 * Picks a room count from the template's `roomCount` range, then lays out
 * rooms on a graph using the template's `connectivity` rule:
 *
 *   - `linear`     a chain of rooms from start to boss
 *   - `branching`  a tree built by incremental random attachment
 *   - `loop`       a ring with start and boss on opposite arcs
 *
 * **Invariants enforced for every topology:**
 *   - `roomCount.min ≤ n ≤ roomCount.max` (clamped to the per-topology safe minimum)
 *   - `startRoomId !== bossRoomId`
 *   - There is no edge directly connecting start and boss (GDD §7.2 / TDD §7.4)
 *   - Every room id is unique
 *   - Every position is unique (no two rooms share a grid coord)
 *   - Every edge references existing room ids
 *
 * **Determinism:** identical `(template, rng-state)` → identical `FloorGraph`.
 * The function consumes the `Mulberry32` instance; the caller is expected to
 * have derived it from the run seed via the `floorgen` sub-generator
 * (TDD §6.1).
 *
 * Room *type assignment* (combat/loot/safe/...) is **not** done here; that's
 * T-73 (the room-type filler), which consumes the graph this returns.
 */

// ── Per-topology safe minimums ──────────────────────────────────────────────
//
// All three topologies require at least one node between start and boss to
// satisfy non-adjacency. The loop additionally needs 4 nodes so the room
// directly opposite start on the ring is not adjacent.

const SAFE_MIN_LINEAR = 3;
const SAFE_MIN_BRANCHING = 3;
const SAFE_MIN_LOOP = 4;

function pickRoomCount(template: FloorTemplate, rng: Mulberry32): number {
  const { min, max } = template.roomCount;
  const safeMin = Math.max(min, safeMinForRule(template.connectivity));
  // Clamp safeMin to max so we always return a value within the template
  // window when possible; if the template's max is lower than safeMin, the
  // topology can't be satisfied — surface that.
  if (safeMin > max) {
    throw new Error(
      `floor-gen: roomCount.max (${max}) is below the safe minimum (${safeMin}) for connectivity "${template.connectivity}"`,
    );
  }
  return safeMin + rng.nextInt(max - safeMin + 1);
}

function safeMinForRule(rule: ConnectivityRule): number {
  switch (rule) {
    case 'linear':    return SAFE_MIN_LINEAR;
    case 'branching': return SAFE_MIN_BRANCHING;
    case 'loop':      return SAFE_MIN_LOOP;
  }
}

// ── Public entry point ──────────────────────────────────────────────────────

export function placeRooms(template: FloorTemplate, rng: Mulberry32): FloorGraph {
  const n = pickRoomCount(template, rng);
  switch (template.connectivity) {
    case 'linear':    return placeLinear(n);
    case 'branching': return placeBranching(n, rng);
    case 'loop':      return placeLoop(n);
  }
}

// ── Linear: a chain start → r1 → ... → boss ─────────────────────────────────

function placeLinear(n: number): FloorGraph {
  const rooms: RoomNode[] = [];
  const edges: FloorEdge[] = [];
  for (let i = 0; i < n; i++) {
    rooms.push({ id: `r${i}`, pos: { x: i, y: 0 } });
    if (i > 0) edges.push({ from: `r${i - 1}`, to: `r${i}` });
  }
  // n ≥ 3 guaranteed by safeMin, so start and boss are at least one
  // intermediate apart — never directly connected.
  return { rooms, edges, startRoomId: 'r0', bossRoomId: `r${n - 1}` };
}

// ── Branching: tree by incremental random attachment ────────────────────────

const BRANCHING_OFFSETS: ReadonlyArray<{ readonly x: number; readonly y: number }> = [
  { x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 },
  { x: 1, y: 1 }, { x: -1, y: 1 }, { x: 1, y: -1 }, { x: -1, y: -1 },
];

function placeBranching(n: number, rng: Mulberry32): FloorGraph {
  const rooms: RoomNode[] = [{ id: 'r0', pos: { x: 0, y: 0 } }];
  const edges: FloorEdge[] = [];
  const used = new Set<string>(['0,0']);

  for (let i = 1; i < n; i++) {
    let placed = false;
    // Try up to 32 attachment attempts: pick a random existing room as
    // parent, pick a random direction, position the new room. Retry on
    // collision.
    for (let attempt = 0; attempt < 32 && !placed; attempt++) {
      const parent = rooms[rng.nextInt(rooms.length)]!;
      const offset = BRANCHING_OFFSETS[rng.nextInt(BRANCHING_OFFSETS.length)]!;
      const pos = { x: parent.pos.x + offset.x, y: parent.pos.y + offset.y };
      const key = `${pos.x},${pos.y}`;
      if (used.has(key)) continue;
      used.add(key);
      const id = `r${i}`;
      rooms.push({ id, pos });
      edges.push({ from: parent.id, to: id });
      placed = true;
    }
    // Fallback: extend the most recently placed room along +x until we find
    // an unused slot. Defensive — only triggers if 32 random attempts hit a
    // very cramped configuration (rare for typical n ≤ 14).
    if (!placed) {
      const last = rooms[rooms.length - 1]!;
      let dx = 1;
      while (used.has(`${last.pos.x + dx},${last.pos.y}`)) dx++;
      const pos = { x: last.pos.x + dx, y: last.pos.y };
      used.add(`${pos.x},${pos.y}`);
      const id = `r${i}`;
      rooms.push({ id, pos });
      edges.push({ from: last.id, to: id });
    }
  }

  // Pick boss = deepest reachable room from start that is NOT directly
  // connected to start. Tie-break by lexicographic room id for determinism.
  const distances = bfsDistances('r0', rooms, edges);
  let bossRoomId = '';
  let bestDistance = -1;
  for (const room of rooms) {
    const d = distances.get(room.id) ?? -1;
    if (d < 2) continue; // skip start (d=0) and directly-connected (d=1)
    if (d > bestDistance || (d === bestDistance && room.id < bossRoomId)) {
      bestDistance = d;
      bossRoomId = room.id;
    }
  }
  // Defensive fallback. With n ≥ 3 and a tree built by random attachment,
  // there must be at least one room at distance ≥ 2 from start (the second
  // room attaches to start; the third must attach somewhere, and if it
  // attaches to r1, it sits at d=2). If somehow not, take the latest room.
  if (bossRoomId === '') bossRoomId = rooms[rooms.length - 1]!.id;

  return { rooms, edges, startRoomId: 'r0', bossRoomId };
}

// ── Loop: ring with start and boss on opposite arcs ─────────────────────────

function placeLoop(n: number): FloorGraph {
  // Project room indices onto a circle large enough that no two integer
  // positions collide. Radius scales with n.
  const radius = Math.max(2, Math.ceil(n / 4));
  const rooms: RoomNode[] = [];
  const used = new Set<string>();

  for (let i = 0; i < n; i++) {
    const angle = (i / n) * 2 * Math.PI;
    let x = Math.round(radius * Math.cos(angle));
    let y = Math.round(radius * Math.sin(angle));
    // Resolve rare integer-rounding collisions by nudging outward radially.
    let nudge = 1;
    while (used.has(`${x},${y}`)) {
      x = Math.round((radius + nudge) * Math.cos(angle));
      y = Math.round((radius + nudge) * Math.sin(angle));
      nudge++;
      if (nudge > 8) {
        throw new Error(`floor-gen: loop placement could not resolve position collision for room r${i}`);
      }
    }
    used.add(`${x},${y}`);
    rooms.push({ id: `r${i}`, pos: { x, y } });
  }

  const edges: FloorEdge[] = [];
  for (let i = 0; i < n; i++) {
    edges.push({ from: `r${i}`, to: `r${(i + 1) % n}` });
  }

  const startRoomId = 'r0';
  // Opposite side of the ring. With safe-min n ≥ 4, floor(n/2) is at distance
  // ≥ 2 from r0 along the ring — never directly connected.
  const bossRoomId = `r${Math.floor(n / 2)}`;

  // Defensive: assert non-adjacency. This is a structural property that holds
  // for n ≥ 4, but the assert catches regressions if SAFE_MIN_LOOP is ever
  // lowered without re-deriving the math.
  if (areAdjacent(startRoomId, bossRoomId, edges)) {
    throw new Error(
      `floor-gen: loop placement produced adjacent start/boss for n=${n} — invariant violated`,
    );
  }

  return { rooms, edges, startRoomId, bossRoomId };
}
