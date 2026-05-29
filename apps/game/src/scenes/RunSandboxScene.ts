import Phaser from 'phaser';
import type { EnemyDef } from '@shared-types/enemy';
import type { FloorTemplate } from '@shared-types/floor-template';
import type { PopulatedRoom } from '@shared-types/floor-plan';
import type { RunState } from '@shared-types/run-state';
import type { Action } from '@shared-types/action';
import type { Effect } from '../core/turn-engine/effect';
import type { LaceContext, LaceLine } from '@shared-types/lace-line';
import { TurnEngine } from '../core/turn-engine/turn-engine';
import { chebyshev } from '../core/turn-engine/grid';
import { Mulberry32, makeRng } from '../core/rng/mulberry32';
import { parseEnemyDef } from '../core/content/enemy-loader';
import { parseLaceLines } from '../core/lace/lace-loader';
import { parseFloorTemplate } from '../core/floor-gen';
import { RunSession, buildEnemyRegistry } from '../core/run';
import { LaceNarrator } from '../core/lace';
import { computeBounds, computeLayout, project } from './floor-graph-layout';
import { drawTabBar, TAB_BAR_HEIGHT } from './tab-bar';

import filterer from '@content/enemies/filterer.json';
import caveCrawler from '@content/enemies/cave_crawler.json';
import acidSpitter from '@content/enemies/acid_spitter.json';
import scavenger from '@content/enemies/scavenger.json';
import shellBrute from '@content/enemies/shell_brute.json';
import pressureWarden from '@content/enemies/pressure_warden.json';
import floor01 from '@content/floors/floor_01.json';
import laceCore from '@content/lace-lines/core.json';

// ── Layout ────────────────────────────────────────────────────────────────────
const W = 390;
const HUD_Y = TAB_BAR_HEIGHT + 8;
const LACE_Y = HUD_Y + 60;
const STAGE_Y = LACE_Y + 36;
const STAGE_H = 430;
const BTN_Y = STAGE_Y + STAGE_H + 16;
const GRID_PX = 350;

const C = {
  text: '#e8edf5', dim: '#7a8fad', green: '#a0ffdc', yellow: '#ffdd44', red: '#ff4444', dark: '#0a0e1a',
};
const H = {
  bg: 0x060a12, node: 0x1a2840, nodeCleared: 0x12331f, edge: 0x2a3a55,
  start: 0xa0ffdc, boss: 0xff4444, current: 0xffdd44, adj: 0x44ff88,
  tileBg: 0x0d1220, tileBorder: 0x1e2a40, hazard: 0x4a2030,
  player: 0xa0ffdc, enemy: 0xff6644, dead: 0x1c1c2e, hpBg: 0x333344, hpGreen: 0x44ff88, hpRed: 0xff3333,
  btnBg: 0x1a3028, btnBrd: 0xa0ffdc,
};

const MASTER_SEED = 0xc0ffee;
const FINAL_FLOOR = 3; // short demo descent

type View = 'map' | 'combat' | 'over';

export class RunSandboxScene extends Phaser.Scene {
  private session!: RunSession;
  private narrator!: LaceNarrator;
  private enemyRegistry!: ReadonlyMap<string, EnemyDef>;
  private template!: FloorTemplate;
  private laceLines: readonly LaceLine[] = [];

  /** Run seed — same seed always replays the identical run (determinism, NFR P2). */
  private seed = MASTER_SEED;

  private view: View = 'map';
  private combat: RunState | null = null;
  private combatRng!: Mulberry32;

  private stage!: Phaser.GameObjects.Graphics;
  private overlay!: Phaser.GameObjects.Graphics;
  private hudText!: Phaser.GameObjects.Text;
  private laceText!: Phaser.GameObjects.Text;
  private transient: Phaser.GameObjects.GameObject[] = [];
  private buttonZones: Phaser.GameObjects.Zone[] = [];

  constructor() {
    super({ key: 'RunSandboxScene' });
  }

  create(): void {
    this.loadContent();
    this.add.graphics().fillStyle(H.bg).fillRect(0, 0, W, 844);

    this.stage = this.add.graphics();
    this.overlay = this.add.graphics();
    this.hudText = this.add.text(16, HUD_Y, '', { fontFamily: 'monospace', fontSize: '13px', color: C.text, lineSpacing: 4 });
    this.laceText = this.add.text(16, LACE_Y, '', {
      fontFamily: 'monospace', fontSize: '11px', color: C.green, fontStyle: 'italic', wordWrap: { width: W - 32 },
    });

    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => this.onPointer(p.x, p.y));
    drawTabBar(this, this.scene.key);

    this.startRun();
  }

  // ── Content + run setup ───────────────────────────────────────────────────

  private loadContent(): void {
    const defs: EnemyDef[] = [filterer, caveCrawler, acidSpitter, scavenger, shellBrute, pressureWarden].map((raw) => {
      const res = parseEnemyDef(raw);
      if (!res.ok) throw new Error(`RunSandbox: bad enemy content — ${res.error.message}`);
      return res.enemy;
    });
    this.enemyRegistry = buildEnemyRegistry(defs);

    const tpl = parseFloorTemplate(floor01);
    if (!tpl.ok) throw new Error(`RunSandbox: bad floor content — ${tpl.error.message}`);
    this.template = tpl.template;

    const lace = parseLaceLines(laceCore);
    if (!lace.ok) throw new Error(`RunSandbox: bad LACE content — ${lace.error.message}`);
    this.laceLines = lace.lines;
  }

  /** (Re)starts the run on the current seed — everything is derived from it. */
  private startRun(): void {
    this.session = new RunSession({ seed: this.seed, template: this.template, registry: this.enemyRegistry, finalFloor: FINAL_FLOOR });
    this.narrator = new LaceNarrator(this.laceLines, makeRng(this.seed, 'events'));
    this.view = 'map';
    this.combat = null;
    this.say('run_start');
    this.renderAll();
  }

  /** Advances to a new deterministic seed and starts a fresh run on it. */
  private reroll(): void {
    this.seed = (new Mulberry32(this.seed).next() * 0x1_0000_0000) >>> 0;
    this.startRun();
  }

  // ── LACE ────────────────────────────────────────────────────────────────────

  private say(context: LaceContext): void {
    const line = this.narrator.narrate(context);
    if (line !== null) this.laceText.setText(`LACE: ${line.text}`);
  }

  // ── Input ─────────────────────────────────────────────────────────────────

  private onPointer(x: number, y: number): void {
    if (this.view === 'map') this.onMapPointer(x, y);
    else if (this.view === 'combat') this.onCombatPointer(x, y);
  }

  private onMapPointer(x: number, y: number): void {
    const { bounds, transform } = this.mapTransform();
    for (const id of this.session.adjacentRooms()) {
      const room = this.roomById(id);
      const p = project(room.pos, bounds, transform);
      if (Math.hypot(x - p.x, y - p.y) <= 18) {
        this.enterRoom(id);
        return;
      }
    }
  }

  private enterRoom(id: string): void {
    this.session.moveTo(id);
    const room = this.session.currentRoom();
    const encounter = this.session.beginEncounter();
    if (encounter === null) {
      // Non-combat rooms auto-clear. lace_event rooms are narrative beats — let
      // the companion speak. (loot/merchant/trap rooms are content stubs for now.)
      if (room.type === 'lace_event') this.say('generic');
      this.renderAll();
      return;
    }
    this.say(room.type === 'boss' ? 'boss_start' : 'combat_start');
    this.combat = encounter;
    this.combatRng = makeRng(encounter.seed, 'combat');
    this.view = 'combat';
    this.renderAll();
  }

  /** Advance to the next floor after a boss clear. */
  private descendFloor(): void {
    this.session.descend();
    this.say('floor_enter');
    this.renderAll();
  }

  private onCombatPointer(x: number, y: number): void {
    const state = this.combat;
    if (state === null || state.phase !== 'player') return;
    const tile = this.tileSize(state);
    const col = Math.floor((x - this.gridX(state)) / tile);
    const row = Math.floor((y - STAGE_Y) / tile);
    if (col < 0 || col >= state.grid.width || row < 0 || row >= state.grid.height) return;

    const enemy = state.enemies.find((e) => e.hp > 0 && e.pos.x === col && e.pos.y === row);
    if (enemy) {
      if (chebyshev(state.player.pos, { x: col, y: row }) <= 1) this.combatAction({ type: 'attack', targetId: enemy.id });
      return;
    }
    if (col === state.player.pos.x && row === state.player.pos.y) return;
    if (chebyshev(state.player.pos, { x: col, y: row }) === 1) this.combatAction({ type: 'move', targetPos: { x: col, y: row } });
  }

  private combatAction(action: Action): void {
    const state = this.combat;
    if (state === null) return;
    const result = TurnEngine.apply(state, action, this.combatRng);
    if (result.errors.length === 0) {
      this.combat = result.state;
      this.reactToCombatEffects(result.effects);
      this.maybeEndCombat();
    }
    this.renderAll();
  }

  private reactToCombatEffects(effects: readonly Effect[]): void {
    for (const fx of effects) {
      if (fx.type === 'entityDied' && fx.entityId !== 'player') this.say('enemy_killed');
    }
  }

  private maybeEndCombat(): void {
    const state = this.combat;
    if (state === null) return;
    if (state.phase === 'player' || state.phase === 'enemy') return;

    const wasBoss = this.session.currentRoom().type === 'boss';
    this.session.endEncounter(state);
    this.combat = null;
    const status = this.session.snapshot.status;

    if (status === 'defeat') {
      this.say('player_death');
      this.view = 'over';
    } else if (status === 'victory') {
      this.say('boss_killed');
      this.view = 'over';
    } else if (status === 'floor_complete') {
      this.say('floor_complete');
      this.view = 'map';
    } else {
      this.say(wasBoss ? 'boss_killed' : 'room_cleared');
      this.view = 'map';
    }
  }

  // ── Rendering ─────────────────────────────────────────────────────────────

  private renderAll(): void {
    this.stage.clear();
    this.overlay.clear();
    this.transient.forEach((t) => t.destroy());
    this.transient = [];
    this.buttonZones.forEach((z) => z.destroy());
    this.buttonZones = [];

    if (this.view === 'map') this.renderMap();
    else if (this.view === 'combat') this.renderCombat();
    else this.renderOver();

    this.renderButtons();
    this.updateHud();
  }

  private mapTransform(): { bounds: ReturnType<typeof computeBounds>; transform: ReturnType<typeof computeLayout> } {
    const rooms = this.session.floor.rooms;
    const bounds = computeBounds(rooms);
    const transform = computeLayout(bounds, { x: 16, y: STAGE_Y, width: W - 32, height: STAGE_H });
    return { bounds, transform };
  }

  private renderMap(): void {
    const floor = this.session.floor;
    const { bounds, transform } = this.mapTransform();
    const snap = this.session.snapshot;
    const cleared = new Set(snap.clearedRoomIds);
    const adjacent = new Set(this.session.adjacentRooms());

    // Edges.
    for (const e of floor.edges) {
      const a = project(this.roomById(e.from).pos, bounds, transform);
      const b = project(this.roomById(e.to).pos, bounds, transform);
      this.stage.lineStyle(2, H.edge).lineBetween(a.x, a.y, b.x, b.y);
    }

    // Nodes.
    for (const room of floor.rooms) {
      const p = project(room.pos, bounds, transform);
      const isCurrent = room.id === snap.currentRoomId;
      let fill = cleared.has(room.id) ? H.nodeCleared : H.node;
      if (room.id === floor.bossRoomId) fill = H.boss;
      else if (room.id === floor.startRoomId) fill = H.start;
      this.stage.fillStyle(fill).fillCircle(p.x, p.y, 14);

      if (adjacent.has(room.id)) this.stage.lineStyle(3, H.adj).strokeCircle(p.x, p.y, 17);
      if (isCurrent) this.stage.lineStyle(3, H.current).strokeCircle(p.x, p.y, 20);

      const label = this.add.text(p.x, p.y, room.type[0]!.toUpperCase(), {
        fontFamily: 'monospace', fontSize: '11px', color: C.dark,
      }).setOrigin(0.5);
      this.transient.push(label);
    }

    const hint = this.add.text(W / 2, STAGE_Y + STAGE_H - 6, 'tap a highlighted room to move', {
      fontFamily: 'monospace', fontSize: '10px', color: C.dim,
    }).setOrigin(0.5, 1);
    this.transient.push(hint);
  }

  private tileSize(state: RunState): number {
    return Math.floor(GRID_PX / Math.max(state.grid.width, state.grid.height));
  }

  private gridX(state: RunState): number {
    return Math.floor((W - this.tileSize(state) * state.grid.width) / 2);
  }

  private renderCombat(): void {
    const state = this.combat;
    if (state === null) return;
    const tile = this.tileSize(state);
    const gx = this.gridX(state);

    for (let r = 0; r < state.grid.height; r++) {
      for (let c = 0; c < state.grid.width; c++) {
        const t = state.grid.tiles[r * state.grid.width + c];
        const px = gx + c * tile;
        const py = STAGE_Y + r * tile;
        this.stage.fillStyle(t === 'hazard' ? H.hazard : H.tileBg).fillRect(px, py, tile, tile);
        this.stage.lineStyle(1, H.tileBorder).strokeRect(px, py, tile, tile);
      }
    }

    const drawHp = (cx: number, cy: number, frac: number, color: number): void => {
      this.stage.fillStyle(H.hpBg).fillRect(cx - tile / 2 + 2, cy - tile / 2 + 2, tile - 4, 3);
      if (frac > 0) this.stage.fillStyle(color).fillRect(cx - tile / 2 + 2, cy - tile / 2 + 2, Math.round((tile - 4) * frac), 3);
    };

    for (const e of state.enemies) {
      const cx = gx + e.pos.x * tile + tile / 2;
      const cy = STAGE_Y + e.pos.y * tile + tile / 2;
      if (e.hp <= 0) { this.stage.fillStyle(H.dead).fillCircle(cx, cy, tile * 0.2); continue; }
      this.stage.fillStyle(H.enemy).fillCircle(cx, cy, tile * 0.34);
      drawHp(cx, cy, e.hp / e.maxHp, H.hpRed);
    }

    const pp = state.player;
    const pcx = gx + pp.pos.x * tile + tile / 2;
    const pcy = STAGE_Y + pp.pos.y * tile + tile / 2;
    this.stage.fillStyle(H.player).fillCircle(pcx, pcy, tile * 0.34);
    drawHp(pcx, pcy, pp.hp / pp.maxHp, H.hpGreen);
  }

  private renderOver(): void {
    const status = this.session.snapshot.status;
    this.overlay.fillStyle(0x000000, 0.6).fillRect(0, STAGE_Y, W, STAGE_H);
    const label = status === 'victory' ? 'VICTORY' : 'DEFEAT';
    const t = this.add.text(W / 2, STAGE_Y + STAGE_H / 2, label, {
      fontFamily: 'monospace', fontSize: '30px', color: status === 'victory' ? C.yellow : C.red,
      stroke: '#000000', strokeThickness: 4,
    }).setOrigin(0.5);
    this.transient.push(t);
  }

  // ── Buttons ─────────────────────────────────────────────────────────────────

  private renderButtons(): void {
    if (this.view === 'combat') {
      // End Turn is always available during the player phase — it does NOT
      // require spending all AP.
      if (this.combat?.phase === 'player') {
        this.button(20, 'END TURN', C.green, () => this.combatAction({ type: 'endTurn' }));
      }
      return;
    }
    // Boss cleared → offer the descent to the next floor.
    if (this.view === 'map' && this.session.snapshot.status === 'floor_complete') {
      this.button(20, 'DESCEND', C.yellow, () => this.descendFloor());
      this.button(210, 'REROLL', C.dim, () => this.reroll());
      return;
    }
    // Exploring / game-over: seed controls. REPLAY re-runs the same seed
    // (identical run — determinism); REROLL advances to a new deterministic seed.
    this.button(20, 'REPLAY', C.green, () => this.startRun());
    this.button(210, 'REROLL', C.yellow, () => this.reroll());
  }

  private button(x: number, label: string, color: string, onTap: () => void): void {
    this.stage.fillStyle(H.btnBg).fillRoundedRect(x, BTN_Y, 160, 44, 8);
    this.stage.lineStyle(1, H.btnBrd).strokeRoundedRect(x, BTN_Y, 160, 44, 8);
    const t = this.add.text(x + 80, BTN_Y + 22, label, { fontFamily: 'monospace', fontSize: '14px', color }).setOrigin(0.5);
    this.transient.push(t);
    const z = this.add.zone(x + 80, BTN_Y + 22, 160, 44).setInteractive({ useHandCursor: true });
    z.on('pointerdown', onTap);
    this.buttonZones.push(z);
  }

  // ── HUD ───────────────────────────────────────────────────────────────────

  private updateHud(): void {
    const snap = this.session.snapshot;
    const combat = this.view === 'combat' ? this.combat : null;
    const here = combat?.player ?? snap.player;
    // During combat, show AP + turn so End Turn is visibly effective (AP refreshes
    // to max after the enemy phase) and you can see you may end a turn with AP left.
    const combatInfo = combat ? `   AP ${here.ap}/${here.maxAp}   Turn ${combat.turn}` : '';
    this.hudText.setText([
      `Floor ${snap.floorNumber}/${FINAL_FLOOR}    ${this.view.toUpperCase()}    ${snap.status}`,
      `HP ${here.hp}/${here.maxHp}${combatInfo}`,
      `Room ${snap.currentRoomId} (${this.session.currentRoom().type})   seed 0x${this.seed.toString(16).padStart(8, '0')}`,
    ]);
  }

  private roomById(id: string): PopulatedRoom {
    const room = this.session.floor.rooms.find((r) => r.id === id);
    if (room === undefined) throw new Error(`RunSandbox: no room ${id}`);
    return room;
  }
}
