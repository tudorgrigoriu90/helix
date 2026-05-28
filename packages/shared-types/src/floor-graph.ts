/**
 * Floor graph — the room topology produced by procedural floor generation.
 *
 * Output of the placement algorithm (T-71, TDD §7.1 step 3); input to the
 * connectivity validator (T-72) and the room-type filler (T-73). Renderer
 * uses `pos` for minimap drawing.
 *
 * Edges are undirected by convention; the BFS validator and room-type
 * filler walk both directions. The "boss-room door is one-way" rule
 * (TDD §7.4) is a gameplay concern that lives in the FloorScene transition
 * code, not in the graph topology.
 */

/** A single room slot in the floor layout. Room *type* is assigned later in T-73. */
export interface RoomNode {
  readonly id: string;
  /**
   * Integer grid position used by the minimap renderer. Two rooms never share
   * the same position within a single FloorGraph.
   */
  readonly pos: { readonly x: number; readonly y: number };
}

/** Undirected corridor between two rooms. */
export interface FloorEdge {
  readonly from: string;
  readonly to: string;
}

export interface FloorGraph {
  readonly rooms: readonly RoomNode[];
  readonly edges: readonly FloorEdge[];
  /** Room id of the floor entrance. */
  readonly startRoomId: string;
  /** Room id of the boss room. Never directly connected to `startRoomId`. */
  readonly bossRoomId: string;
}
