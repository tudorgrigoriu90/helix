import Phaser from 'phaser';
import type { ConnectivityRule, FloorTemplate } from '@shared-types/floor-template';
import type { FloorGraph } from '@shared-types/floor-graph';
import { parseFloorTemplate } from '../core/floor-gen/floor-template-loader';
import { placeRooms } from '../core/floor-gen/room-placement';
import { bfsDistances } from '../core/floor-gen/graph';
import { Mulberry32 } from '../core/rng/mulberry32';
import floor01 from '../../../../packages/content/floors/floor_01.json';
import { computeBounds, computeLayout, project } from './floor-graph-layout';
import { drawTabBar, TAB_BAR_HEIGHT } from './tab-bar';

// ── Layout constants ───────────────────────────────────────────────────────────

const HEADER_Y = TAB_BAR_HEIGHT + 8;       //  36
const HUD_Y = TAB_BAR_HEIGHT + 52;         //  80
const VIEWPORT_Y = TAB_BAR_HEIGHT + 110;   // 138
const VIEWPORT_H = 480;
const CONTROLS_Y = VIEWPORT_Y + VIEWPORT_H + 16;  // 634
const LOG_Y = CONTROLS_Y + 64;             // 698

const NODE_RADIUS = 14;

// ── Palette (matches CombatSandboxScene) ──────────────────────────────────────

const H = {
  bg: 0x060a12,
  viewportBorder: 0x1e2a40,
  edge: 0x3a4868,
  nodeOther: 0x7a8fad,
  nodeStart: 0xa0ffdc,
  nodeBoss: 0xff4444,
  nodeOutline: 0x0a0e1a,
  btnBg: 0x12121e,
  btnBgHover: 0x1a3028,
  btnBrd: 0x2a3050,
  btnBrdActive: 0xa0ffdc,
};
const C = {
  textPrimary: '#e8edf5',
  textDim: '#7a8fad',
  textLace: '#a0ffdc',
  textBoss: '#ff8888',
};

// ── Topology cycle ─────────────────────────────────────────────────────────────

const TOPOLOGY_CYCLE: readonly ConnectivityRule[] = ['linear', 'branching', 'loop'];

function nextTopology(current: ConnectivityRule): ConnectivityRule {
  const i = TOPOLOGY_CYCLE.indexOf(current);
  return TOPOLOGY_CYCLE[(i + 1) % TOPOLOGY_CYCLE.length]!;
}

/** Deterministic-ish seed picker for REROLL. Avoids dependence on Date.now to
 * keep the dev-tools console reproducible — uses Mulberry32 with the prior
 * seed as the source. */
function nextSeed(prev: number): number {
  return new Mulberry32(prev).next() * 0xffffffff >>> 0;
}

// ── Scene ──────────────────────────────────────────────────────────────────────

export class FloorGraphSandboxScene extends Phaser.Scene {
  private baseTemplate!: FloorTemplate;
  private topology: ConnectivityRule = 'branching';
  private seed = 0xc0ffeebabe >>> 0;
  private graph!: FloorGraph;

  private graphGfx!: Phaser.GameObjects.Graphics;
  private hudText!: Phaser.GameObjects.Text;
  private logText!: Phaser.GameObjects.Text;
  private logLines: string[] = [];
  private nodeLabels: Phaser.GameObjects.Text[] = [];

  // Button graphics — kept as fields so hover state can re-render them
  private rerollBtnGfx!: Phaser.GameObjects.Graphics;
  private topologyBtnGfx!: Phaser.GameObjects.Graphics;

  constructor() {
    super({ key: 'FloorGraphSandboxScene' });
  }

  create(): void {
    // Parse the on-disk Floor 1 fixture as our base template. The topology
    // cycle button creates synthetic variants by overriding `connectivity`.
    const result = parseFloorTemplate(floor01);
    if (!result.ok) {
      throw new Error(`FloorGraphSandboxScene: floor_01.json failed to parse — ${result.error.message}`);
    }
    this.baseTemplate = result.template;
    this.topology = result.template.connectivity;

    // Background + tab bar
    this.add.graphics().fillStyle(H.bg).fillRect(0, 0, this.scale.width, this.scale.height);
    drawTabBar(this, this.scene.key);

    // Header
    this.add.text(16, HEADER_Y, 'FLOOR GRAPH SANDBOX', {
      fontFamily: 'monospace', fontSize: '13px', color: C.textLace,
    });
    this.add.text(16, HEADER_Y + 18, 'T-70 / T-71 — placeRooms() visualizer', {
      fontFamily: 'monospace', fontSize: '9px', color: C.textDim,
    });

    // HUD (seed, topology, room/edge counts, BFS max distance)
    this.hudText = this.add.text(16, HUD_Y, '', {
      fontFamily: 'monospace', fontSize: '10px', color: C.textPrimary, lineSpacing: 3,
    });

    // Viewport border
    this.add.graphics()
      .lineStyle(1, H.viewportBorder)
      .strokeRect(8, VIEWPORT_Y - 4, this.scale.width - 16, VIEWPORT_H + 8);

    // Graphics layer for nodes + edges (re-rendered on every regenerate)
    this.graphGfx = this.add.graphics();

    // Controls
    this.createControls();

    // Log
    this.add.text(16, LOG_Y + 4, '— LOG —', {
      fontFamily: 'monospace', fontSize: '9px', color: C.textDim,
    });
    this.logText = this.add.text(16, LOG_Y + 18, '', {
      fontFamily: 'monospace', fontSize: '9px', color: C.textDim, lineSpacing: 2,
    });

    // Initial generation
    this.regenerate({ logIntro: true });
  }

  // ── Generation / state ──────────────────────────────────────────────────────

  /** Build the active template (base + topology override) and re-run placeRooms. */
  private templateForTopology(): FloorTemplate {
    if (this.topology === this.baseTemplate.connectivity) return this.baseTemplate;
    return { ...this.baseTemplate, connectivity: this.topology };
  }

  private regenerate(opts: { logIntro?: boolean } = {}): void {
    try {
      this.graph = placeRooms(this.templateForTopology(), new Mulberry32(this.seed));
    } catch (e) {
      this.pushLog(`✗ placeRooms threw: ${(e as Error).message}`);
      return;
    }
    this.renderGraph();
    this.updateHUD();
    if (opts.logIntro) {
      this.pushLog(`init: ${this.topology}, seed=0x${this.seed.toString(16).padStart(8, '0')}`);
    }
    this.pushLog(
      `${this.topology}: ${this.graph.rooms.length} rooms, ` +
      `${this.graph.edges.length} edges, start=${this.graph.startRoomId} → boss=${this.graph.bossRoomId}`,
    );
  }

  private maxDistanceFromStart(): number {
    const distances = bfsDistances(this.graph.startRoomId, this.graph.rooms, this.graph.edges);
    let max = 0;
    for (const d of distances.values()) if (d > max) max = d;
    return max;
  }

  // ── Rendering ───────────────────────────────────────────────────────────────

  private renderGraph(): void {
    this.graphGfx.clear();

    // Tear down old node labels
    for (const t of this.nodeLabels) t.destroy();
    this.nodeLabels = [];

    const bounds = computeBounds(this.graph.rooms);
    const transform = computeLayout(
      bounds,
      { x: 8, y: VIEWPORT_Y, width: this.scale.width - 16, height: VIEWPORT_H },
      { padding: 28, minScale: 26, maxScale: 70 },
    );

    // Edges first (under nodes)
    this.graphGfx.lineStyle(2, H.edge, 0.9);
    const byId = new Map(this.graph.rooms.map((r) => [r.id, r]));
    for (const edge of this.graph.edges) {
      const a = byId.get(edge.from);
      const b = byId.get(edge.to);
      if (!a || !b) continue;
      const pa = project(a.pos, bounds, transform);
      const pb = project(b.pos, bounds, transform);
      this.graphGfx.lineBetween(pa.x, pa.y, pb.x, pb.y);
    }

    // Nodes
    for (const room of this.graph.rooms) {
      const p = project(room.pos, bounds, transform);
      const isStart = room.id === this.graph.startRoomId;
      const isBoss = room.id === this.graph.bossRoomId;
      const fill = isStart ? H.nodeStart : isBoss ? H.nodeBoss : H.nodeOther;

      // Outline ring (creates separation from edges visually)
      this.graphGfx.lineStyle(2, H.nodeOutline, 1);
      this.graphGfx.fillStyle(fill, 1);
      this.graphGfx.fillCircle(p.x, p.y, NODE_RADIUS);
      this.graphGfx.strokeCircle(p.x, p.y, NODE_RADIUS);

      // Room id label centered in the node (or below for small graphs)
      const labelColor = isStart || isBoss ? '#0a0e1a' : '#0a0e1a';
      const label = this.add.text(p.x, p.y, room.id, {
        fontFamily: 'monospace', fontSize: '9px', color: labelColor,
      }).setOrigin(0.5);
      this.nodeLabels.push(label);
    }
  }

  private updateHUD(): void {
    const maxDist = this.maxDistanceFromStart();
    const fromJson = this.topology === this.baseTemplate.connectivity ? ' [from JSON]' : ' [override]';
    this.hudText.setText([
      `seed=0x${this.seed.toString(16).padStart(8, '0')}   topology=${this.topology}${fromJson}`,
      `rooms=${this.graph.rooms.length}   edges=${this.graph.edges.length}   max-distance=${maxDist}`,
      `start=${this.graph.startRoomId}   boss=${this.graph.bossRoomId}`,
    ]);
  }

  // ── Controls ────────────────────────────────────────────────────────────────

  private createControls(): void {
    const btnW = 156;
    const btnH = 40;
    const gap = 14;
    const totalW = btnW * 2 + gap;
    const x0 = (this.scale.width - totalW) / 2;

    this.rerollBtnGfx = this.add.graphics();
    this.drawButton(this.rerollBtnGfx, x0, CONTROLS_Y, btnW, btnH, false);
    this.add.text(x0 + btnW / 2, CONTROLS_Y + btnH / 2, 'REROLL', {
      fontFamily: 'monospace', fontSize: '12px', color: C.textLace,
    }).setOrigin(0.5);
    const rerollZone = this.add.zone(x0, CONTROLS_Y, btnW, btnH).setOrigin(0, 0).setInteractive({ useHandCursor: true });
    rerollZone.on('pointerover', () => this.drawButton(this.rerollBtnGfx, x0, CONTROLS_Y, btnW, btnH, true));
    rerollZone.on('pointerout', () => this.drawButton(this.rerollBtnGfx, x0, CONTROLS_Y, btnW, btnH, false));
    rerollZone.on('pointerdown', () => {
      this.seed = nextSeed(this.seed);
      this.regenerate();
    });

    const x1 = x0 + btnW + gap;
    this.topologyBtnGfx = this.add.graphics();
    this.drawButton(this.topologyBtnGfx, x1, CONTROLS_Y, btnW, btnH, false);
    this.add.text(x1 + btnW / 2, CONTROLS_Y + btnH / 2, 'TOPOLOGY ▶', {
      fontFamily: 'monospace', fontSize: '12px', color: C.textPrimary,
    }).setOrigin(0.5);
    const topoZone = this.add.zone(x1, CONTROLS_Y, btnW, btnH).setOrigin(0, 0).setInteractive({ useHandCursor: true });
    topoZone.on('pointerover', () => this.drawButton(this.topologyBtnGfx, x1, CONTROLS_Y, btnW, btnH, true));
    topoZone.on('pointerout', () => this.drawButton(this.topologyBtnGfx, x1, CONTROLS_Y, btnW, btnH, false));
    topoZone.on('pointerdown', () => {
      this.topology = nextTopology(this.topology);
      this.regenerate();
    });
  }

  private drawButton(gfx: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number, hover: boolean): void {
    gfx.clear();
    gfx.fillStyle(hover ? H.btnBgHover : H.btnBg, 1);
    gfx.fillRect(x, y, w, h);
    gfx.lineStyle(1, hover ? H.btnBrdActive : H.btnBrd, 1);
    gfx.strokeRect(x, y, w, h);
  }

  // ── Log ─────────────────────────────────────────────────────────────────────

  private pushLog(line: string): void {
    this.logLines.push(line);
    if (this.logLines.length > 12) this.logLines.shift();
    this.logText.setText(this.logLines.join('\n'));
  }
}
