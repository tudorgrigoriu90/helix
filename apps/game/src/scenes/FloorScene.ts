import Phaser from 'phaser';
import type { PopulatedFloor, PopulatedRoom } from '@shared-types/floor-plan';
import type { RoomType } from '@shared-types/floor-template';
import { buildFloorZero } from '../core/floor-gen/floor-zero';
import { buildAdjacency } from '../core/floor-gen/graph';
import { computeBounds, computeLayout, project, type LayoutTransform, type Bounds } from './floor-graph-layout';
import { drawTabBar, TAB_BAR_HEIGHT } from './tab-bar';

/**
 * FloorScene — the production floor-exploration scene (S023, T-150).
 *
 * The *shell*: it renders a {@link PopulatedFloor} as a navigable room graph and
 * lets the player walk between adjacent rooms, the spine the rest of E-4 hangs
 * off. It is deliberately scoped to exploration — entering a combat / boss room
 * logs a stub where the CombatScene handoff and RunSession-driven clear logic
 * will land (S-4.4+). For now it renders the hardcoded Floor 0 (T-137) so the
 * tutorial floor is visible and walkable end to end.
 */

// ── Layout (mirrors FloorGraphSandboxScene) ──────────────────────────────────
const HEADER_Y = TAB_BAR_HEIGHT + 8;
const HUD_Y = TAB_BAR_HEIGHT + 52;
const VIEWPORT_Y = TAB_BAR_HEIGHT + 110;
const VIEWPORT_H = 480;
const LOG_Y = VIEWPORT_Y + VIEWPORT_H + 24;
const NODE_RADIUS = 16;

const H = {
  bg: 0x060a12,
  viewportBorder: 0x1e2a40,
  edge: 0x3a4868,
  nodeOther: 0x4a5876,
  nodeCleared: 0x2a3450,
  nodeStart: 0xa0ffdc,
  nodeBoss: 0xff4444,
  nodeAdjacent: 0xffd479,
  nodeOutline: 0x0a0e1a,
  currentRing: 0xffffff,
};
const C = {
  textPrimary: '#e8edf5',
  textDim: '#7a8fad',
  textLace: '#a0ffdc',
  nodeLabel: '#0a0e1a',
};

/** Short tag shown under each room node. */
const ROOM_TAG: Record<RoomType, string> = {
  safe: 'SAFE', combat: 'FIGHT', loot: 'LOOT', merchant: 'SHOP', trap: 'TRAP', lace_event: 'LACE', boss: 'BOSS',
};

export class FloorScene extends Phaser.Scene {
  private floor!: PopulatedFloor;
  private adjacency!: Map<string, string[]>;
  private current!: string;
  private readonly cleared = new Set<string>();

  private graphGfx!: Phaser.GameObjects.Graphics;
  private hudText!: Phaser.GameObjects.Text;
  private logText!: Phaser.GameObjects.Text;
  private readonly logLines: string[] = [];
  // Re-rendered every move — tracked so they can be torn down first.
  private dynamic: Phaser.GameObjects.GameObject[] = [];

  constructor() {
    super({ key: 'FloorScene' });
  }

  create(): void {
    // The shell renders the hardcoded tutorial floor (T-137); a live run will
    // feed its own PopulatedFloor here once the run loop drives this scene.
    this.floor = buildFloorZero({ combatEnemyId: 'filterer', bossId: 'pressure_warden' });
    this.adjacency = buildAdjacency(this.floor.rooms, this.floor.edges);
    this.current = this.floor.startRoomId;
    this.cleared.clear();
    this.cleared.add(this.current);

    this.add.graphics().fillStyle(H.bg).fillRect(0, 0, this.scale.width, this.scale.height);
    drawTabBar(this, this.scene.key);

    this.add.text(16, HEADER_Y, 'FLOOR 0 — TUTORIAL', { fontFamily: 'monospace', fontSize: '13px', color: C.textLace });
    this.add.text(16, HEADER_Y + 18, 'S023 FloorScene shell (T-150) — tap an exit to move', {
      fontFamily: 'monospace', fontSize: '9px', color: C.textDim,
    });

    this.hudText = this.add.text(16, HUD_Y, '', { fontFamily: 'monospace', fontSize: '10px', color: C.textPrimary, lineSpacing: 3 });

    this.add.graphics().lineStyle(1, H.viewportBorder).strokeRect(8, VIEWPORT_Y - 4, this.scale.width - 16, VIEWPORT_H + 8);
    this.graphGfx = this.add.graphics();

    this.add.text(16, LOG_Y, '— LOG —', { fontFamily: 'monospace', fontSize: '9px', color: C.textDim });
    this.logText = this.add.text(16, LOG_Y + 14, '', { fontFamily: 'monospace', fontSize: '9px', color: C.textDim, lineSpacing: 2 });

    this.pushLog(`Descent begins at ${this.current}.`);
    this.render();
  }

  // ── Exploration ──────────────────────────────────────────────────────────

  private roomById(id: string): PopulatedRoom {
    const room = this.floor.rooms.find((r) => r.id === id);
    if (room === undefined) throw new Error(`FloorScene: no room "${id}"`);
    return room;
  }

  /** Rooms reachable from the current one. The boss door stays locked until the
   *  rest of the floor is cleared (T-77) — combat resolution is deferred (S-4.4). */
  private exits(): string[] {
    return (this.adjacency.get(this.current) ?? []).filter((id) => {
      const room = this.roomById(id);
      return !(room.locked && !this.floorClearedExceptBoss());
    });
  }

  private floorClearedExceptBoss(): boolean {
    return this.floor.rooms.every((r) => r.id === this.floor.bossRoomId || this.cleared.has(r.id));
  }

  private moveTo(id: string): void {
    this.current = id;
    this.cleared.add(id);
    const room = this.roomById(id);
    this.pushLog(`→ ${id} (${ROOM_TAG[room.type]})`);
    if (room.type === 'combat' || room.type === 'boss') {
      // The CombatScene handoff + RunSession clear logic land in S-4.4; the shell
      // just notes the encounter so traversal stays demonstrable.
      this.pushLog(`  …encounter here [combat handoff pending]`);
    } else if (room.type === 'lace_event') {
      this.pushLog(`  …LACE has something to say [Strand Event: T-140]`);
    }
    this.render();
  }

  // ── Rendering ──────────────────────────────────────────────────────────────

  private render(): void {
    for (const obj of this.dynamic) obj.destroy();
    this.dynamic = [];
    this.graphGfx.clear();

    const bounds: Bounds = computeBounds(this.floor.rooms);
    const transform: LayoutTransform = computeLayout(
      bounds,
      { x: 8, y: VIEWPORT_Y, width: this.scale.width - 16, height: VIEWPORT_H },
      { padding: 36, minScale: 26, maxScale: 90 },
    );

    // Edges first (under nodes).
    this.graphGfx.lineStyle(2, H.edge, 0.9);
    const byId = new Map(this.floor.rooms.map((r) => [r.id, r]));
    for (const edge of this.floor.edges) {
      const a = byId.get(edge.from);
      const b = byId.get(edge.to);
      if (!a || !b) continue;
      const pa = project(a.pos, bounds, transform);
      const pb = project(b.pos, bounds, transform);
      this.graphGfx.lineBetween(pa.x, pa.y, pb.x, pb.y);
    }

    const exitSet = new Set(this.exits());
    for (const room of this.floor.rooms) {
      const p = project(room.pos, bounds, transform);
      const isExit = exitSet.has(room.id);
      const fill = this.nodeFill(room, isExit);

      this.graphGfx.lineStyle(2, H.nodeOutline, 1);
      this.graphGfx.fillStyle(fill, 1);
      this.graphGfx.fillCircle(p.x, p.y, NODE_RADIUS);
      this.graphGfx.strokeCircle(p.x, p.y, NODE_RADIUS);

      // Bright ring marks where the player stands.
      if (room.id === this.current) {
        this.graphGfx.lineStyle(2, H.currentRing, 1).strokeCircle(p.x, p.y, NODE_RADIUS + 4);
      }

      this.dynamic.push(
        this.add.text(p.x, p.y, ROOM_TAG[room.type], { fontFamily: 'monospace', fontSize: '8px', color: C.nodeLabel }).setOrigin(0.5),
      );

      // Tappable exits move the player.
      if (isExit) {
        const zone = this.add.zone(p.x - NODE_RADIUS, p.y - NODE_RADIUS, NODE_RADIUS * 2, NODE_RADIUS * 2)
          .setOrigin(0, 0).setInteractive({ useHandCursor: true });
        zone.on('pointerdown', () => this.moveTo(room.id));
        this.dynamic.push(zone);
      }
    }

    this.updateHUD(exitSet.size);
  }

  private nodeFill(room: PopulatedRoom, isExit: boolean): number {
    if (room.id === this.floor.startRoomId) return H.nodeStart;
    if (room.id === this.floor.bossRoomId) return H.nodeBoss;
    if (isExit) return H.nodeAdjacent;
    if (this.cleared.has(room.id)) return H.nodeCleared;
    return H.nodeOther;
  }

  private updateHUD(exitCount: number): void {
    const room = this.roomById(this.current);
    this.hudText.setText([
      `here: ${this.current} (${ROOM_TAG[room.type]})   cleared: ${this.cleared.size}/${this.floor.rooms.length}`,
      `exits: ${exitCount}${this.floorClearedExceptBoss() ? '   — boss door open' : ''}`,
    ]);
  }

  private pushLog(line: string): void {
    this.logLines.push(line);
    if (this.logLines.length > 10) this.logLines.shift();
    this.logText.setText(this.logLines.join('\n'));
  }
}
