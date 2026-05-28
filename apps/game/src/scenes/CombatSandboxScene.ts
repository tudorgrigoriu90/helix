import Phaser from 'phaser';
import type { RunState, EnemyState, TileType } from '@shared-types/run-state';
import type { Action } from '@shared-types/action';
import type { Effect } from '../core/turn-engine/effect';
import { TurnEngine } from '../core/turn-engine/turn-engine';
import { chebyshev } from '../core/turn-engine/grid';
import { Mulberry32 } from '../core/rng/mulberry32';

// ── Layout constants ──────────────────────────────────────────────────────────
const TILE  = 50;
const COLS  = 7;
const ROWS  = 7;
const GX    = 20;           // grid left edge
const GY    = 100;          // grid top edge
const LOG_Y = GY + ROWS * TILE + 10;   // 460
const BTN_Y = LOG_Y + 200 + 10;        // 670

// ── Palette ───────────────────────────────────────────────────────────────────
const H = {
  bg:          0x060a12,
  tileBg:      0x0d1220,
  tileBorder:  0x1e2a40,
  hoverMove:   0xa0ffdc,
  hoverAtk:    0xff4444,
  hoverOob:    0x4466aa,
  player:      0xa0ffdc,
  enemy1:      0xff4444,
  enemy2:      0xff8844,
  dead:        0x1c1c2e,
  hpBg:        0x333344,
  hpGreen:     0x44ff88,
  hpRed:       0xff3333,
  apFull:      0xffdd44,
  apEmpty:     0x2a3050,
  btnEndBg:    0x1a3028,
  btnEndHov:   0x224038,
  btnEndBrd:   0xa0ffdc,
  btnRestBg:   0x12121e,
  btnRestBrd:  0x2a3050,
};
const C = {
  text:   '#e8edf5',
  dim:    '#7a8fad',
  green:  '#a0ffdc',
  yellow: '#ffdd44',
  red:    '#ff4444',
  dark:   '#0a0e1a',
};

// ── Initial combat scenario ───────────────────────────────────────────────────
const SEED = 0xdeadbeef;

const INITIAL_STATE: RunState = {
  schemaVersion: 1,
  seed: SEED,
  floorNumber: 1,
  phase: 'player',
  turn: 1,
  grid: {
    width: COLS,
    height: ROWS,
    tiles: new Array<TileType>(COLS * ROWS).fill('open'),
  },
  player: {
    id: 'player',
    pos: { x: 3, y: 3 },
    hp: 30,
    maxHp: 30,
    ap: 3,
    maxAp: 3,
    stats: { str: 10, res: 5, agi: 10, int: 8 },
    statuses: [],
    abilities: [],
    items: [],
    mutations: [],
  },
  enemies: [
    {
      id: 'grunt',
      enemyDefId: 'grunt',
      pos: { x: 1, y: 1 },
      hp: 20,
      maxHp: 20,
      stats: { str: 8, res: 3, agi: 6, int: 2 },
      statuses: [],
      telegraph: null,
    },
    {
      id: 'brute',
      enemyDefId: 'brute',
      pos: { x: 5, y: 5 },
      hp: 25,
      maxHp: 25,
      stats: { str: 12, res: 5, agi: 4, int: 2 },
      statuses: [],
      telegraph: null,
    },
  ],
};

// ── Scene ─────────────────────────────────────────────────────────────────────
export class CombatSandboxScene extends Phaser.Scene {
  private state!: RunState;
  private rng!: Mulberry32;

  private gridGfx!: Phaser.GameObjects.Graphics;
  private hoverGfx!: Phaser.GameObjects.Graphics;
  private entityGfx!: Phaser.GameObjects.Graphics;
  private endTurnGfx!: Phaser.GameObjects.Graphics;

  private hudText!: Phaser.GameObjects.Text;
  private logText!: Phaser.GameObjects.Text;

  private entityTexts: Phaser.GameObjects.Text[] = [];
  private logLines: string[] = [];

  constructor() {
    super({ key: 'CombatSandboxScene' });
  }

  create(): void {
    this.resetState();

    // Static background layers
    this.add.graphics()
      .fillStyle(H.bg).fillRect(0, 0, 390, GY)
      .fillStyle(H.tileBg).fillRect(GX - 2, GY - 2, COLS * TILE + 4, ROWS * TILE + 4)
      .fillStyle(H.bg).fillRect(0, LOG_Y, 390, 400)
      .lineStyle(1, H.tileBorder).strokeRect(0, LOG_Y, 390, 200);

    this.add.text(16, LOG_Y + 6, '— LOG —', { fontFamily: 'monospace', fontSize: '9px', color: C.dim });

    // Dynamic graphics layers (order = z-order)
    this.gridGfx   = this.add.graphics();
    this.hoverGfx  = this.add.graphics();
    this.entityGfx = this.add.graphics();

    this.drawTiles();
    this.setupInput();
    this.createHUD();
    this.createLogText();
    this.createButtons();

    this.renderAll();
    this.pushLog('Combat sandbox — tap tile to move, tap enemy to attack');
  }

  // ── State management ────────────────────────────────────────────────────────

  private resetState(): void {
    this.state    = structuredClone(INITIAL_STATE);
    this.rng      = new Mulberry32(SEED);
    this.logLines = [];
  }

  private dispatch(action: Action): void {
    const result = TurnEngine.apply(this.state, action, this.rng);
    if (result.errors.length > 0) {
      result.errors.forEach((e) => this.pushLog(`✗ ${e.code}`));
      return;
    }
    this.state = result.state;
    this.readEffects(result.effects);
    this.renderAll();
  }

  private readEffects(effects: readonly Effect[]): void {
    for (const fx of effects) {
      switch (fx.type) {
        case 'entityMoved':
          this.pushLog(fx.entityId === 'player'
            ? `Player → (${fx.to.x},${fx.to.y})`
            : `${fx.entityId} → (${fx.to.x},${fx.to.y})`);
          break;
        case 'damageDealt':
          this.pushLog(`${fx.targetId} −${fx.amount}hp${fx.isCrit ? ' CRIT!' : ''}`);
          break;
        case 'healingApplied':
          this.pushLog(`${fx.targetId} +${fx.amount}hp`);
          break;
        case 'entityDied':
          this.pushLog(`${fx.entityId} defeated ✓`);
          break;
        case 'phaseChanged':
          this.pushLog(`→ ${fx.to.toUpperCase()}`);
          break;
        case 'statusApplied':
          this.pushLog(`${fx.targetId} ← ${fx.status} (${fx.turns}t)`);
          break;
        case 'statusExpired':
          this.pushLog(`${fx.targetId}: ${fx.status} worn off`);
          break;
        case 'floorComplete':
          this.pushLog('★  FLOOR CLEARED  ★');
          break;
        case 'victory':
          this.pushLog('★★  VICTORY  ★★');
          break;
        case 'defeat':
          this.pushLog(`✗  DEFEAT (${fx.cause})`);
          break;
        default:
          break;
      }
    }
  }

  // ── Input ────────────────────────────────────────────────────────────────────

  private setupInput(): void {
    this.input.on('pointerdown', (ptr: Phaser.Input.Pointer) => {
      this.onTileClick(ptr.x, ptr.y);
    });
    this.input.on('pointermove', (ptr: Phaser.Input.Pointer) => {
      this.onHover(ptr.x, ptr.y);
    });
  }

  private onTileClick(sx: number, sy: number): void {
    if (this.state.phase !== 'player') return;

    const col = Math.floor((sx - GX) / TILE);
    const row = Math.floor((sy - GY) / TILE);
    if (col < 0 || col >= COLS || row < 0 || row >= ROWS) return;

    const to  = { x: col, y: row };
    const pp  = this.state.player.pos;

    const enemy = this.state.enemies.find(
      (e) => e.hp > 0 && e.pos.x === col && e.pos.y === row,
    );

    if (enemy) {
      if (chebyshev(pp, to) <= 1) {
        this.dispatch({ type: 'attack', targetId: enemy.id });
      } else {
        this.pushLog('Out of melee range (needs Chebyshev ≤ 1)');
      }
      return;
    }

    if (col === pp.x && row === pp.y) return;

    if (chebyshev(pp, to) === 1) {
      this.dispatch({ type: 'move', targetPos: to });
    } else {
      this.pushLog('Move one tile at a time');
    }
  }

  private onHover(sx: number, sy: number): void {
    this.hoverGfx.clear();
    if (this.state.phase !== 'player') return;

    const col = Math.floor((sx - GX) / TILE);
    const row = Math.floor((sy - GY) / TILE);
    if (col < 0 || col >= COLS || row < 0 || row >= ROWS) return;

    const pp   = this.state.player.pos;
    const to   = { x: col, y: row };
    const dist = chebyshev(pp, to);
    const isEnemy = this.state.enemies.some((e) => e.hp > 0 && e.pos.x === col && e.pos.y === row);
    const isPlayer = col === pp.x && row === pp.y;

    if (isPlayer) return;

    let color: number;
    let alpha: number;
    if (isEnemy && dist <= 1)   { color = H.hoverAtk;  alpha = 0.28; }
    else if (!isEnemy && dist === 1) { color = H.hoverMove; alpha = 0.18; }
    else                        { color = H.hoverOob;  alpha = 0.08; }

    const px = GX + col * TILE;
    const py = GY + row * TILE;
    this.hoverGfx.fillStyle(color, alpha).fillRect(px, py, TILE, TILE);
    this.hoverGfx.lineStyle(1, color, 0.5).strokeRect(px, py, TILE, TILE);
  }

  // ── Rendering ────────────────────────────────────────────────────────────────

  private renderAll(): void {
    this.hoverGfx.clear();
    this.entityGfx.clear();
    this.entityTexts.forEach((t) => t.destroy());
    this.entityTexts = [];

    this.drawPlayer();
    this.state.enemies.forEach((e) => this.drawEnemy(e));
    this.drawOutcomeOverlay();
    this.updateHUD();
    this.updateLogText();
  }

  private drawTiles(): void {
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const px = GX + c * TILE;
        const py = GY + r * TILE;
        this.gridGfx.fillStyle(H.tileBg).fillRect(px, py, TILE, TILE);
        this.gridGfx.lineStyle(1, H.tileBorder).strokeRect(px, py, TILE, TILE);
      }
    }
  }

  private drawPlayer(): void {
    const p  = this.state.player;
    const cx = GX + p.pos.x * TILE + TILE / 2;
    const cy = GY + p.pos.y * TILE + TILE / 2;
    const r  = Math.floor(TILE * 0.36);

    this.entityGfx.fillStyle(H.player).fillCircle(cx, cy, r);
    this.drawHpBar(p.pos.x, p.pos.y, p.hp / p.maxHp, H.hpGreen);

    const lbl = this.add.text(cx, cy, `${p.hp}`, {
      fontFamily: 'monospace', fontSize: '10px', color: C.dark,
    }).setOrigin(0.5);
    this.entityTexts.push(lbl);
  }

  private drawEnemy(e: EnemyState): void {
    const cx = GX + e.pos.x * TILE + TILE / 2;
    const cy = GY + e.pos.y * TILE + TILE / 2;
    const r  = Math.floor(TILE * 0.36);

    if (e.hp <= 0) {
      this.entityGfx.fillStyle(H.dead).fillCircle(cx, cy, Math.floor(TILE * 0.22));
      return;
    }

    const color = e.id === 'brute' ? H.enemy2 : H.enemy1;
    this.entityGfx.fillStyle(color).fillCircle(cx, cy, r);
    this.drawHpBar(e.pos.x, e.pos.y, e.hp / e.maxHp, H.hpRed);

    const hpLbl = this.add.text(cx, cy, `${e.hp}`, {
      fontFamily: 'monospace', fontSize: '10px', color: C.dark,
    }).setOrigin(0.5);
    this.entityTexts.push(hpLbl);

    // Legible threat info (not a telegraph): an enemy already adjacent to the
    // player will strike on the next enemy phase.
    if (chebyshev(e.pos, this.state.player.pos) <= 1) {
      const threat = this.add.text(cx, cy - r - 8, '! in reach', {
        fontFamily: 'monospace', fontSize: '9px', color: C.red,
      }).setOrigin(0.5);
      this.entityTexts.push(threat);
    }
  }

  private drawHpBar(col: number, row: number, fraction: number, fgColor: number): void {
    const x = GX + col * TILE + 2;
    const y = GY + row * TILE + 2;
    const w = TILE - 4;
    const h = 4;
    this.entityGfx.fillStyle(H.hpBg).fillRect(x, y, w, h);
    if (fraction > 0) {
      this.entityGfx.fillStyle(fgColor).fillRect(x, y, Math.round(w * fraction), h);
    }
  }

  private drawOutcomeOverlay(): void {
    const phase = this.state.phase;
    if (phase !== 'defeat' && phase !== 'floor_complete' && phase !== 'victory') return;

    const cx = GX + (COLS * TILE) / 2;
    const cy = GY + (ROWS * TILE) / 2;

    this.entityGfx.fillStyle(0x000000, 0.55).fillRect(GX, GY, COLS * TILE, ROWS * TILE);

    const label = phase === 'defeat' ? 'DEFEAT'
      : phase === 'floor_complete'   ? 'FLOOR CLEARED'
      : 'VICTORY!';
    const color = phase === 'defeat' ? C.red : phase === 'victory' ? C.yellow : C.green;

    const t = this.add.text(cx, cy, label, {
      fontFamily: 'monospace',
      fontSize:   '28px',
      color,
      stroke:          '#000000',
      strokeThickness: 4,
    }).setOrigin(0.5);
    this.entityTexts.push(t);
  }

  // ── HUD ──────────────────────────────────────────────────────────────────────

  private createHUD(): void {
    this.hudText = this.add.text(16, 10, '', {
      fontFamily: 'monospace',
      fontSize:   '13px',
      color:       C.text,
      lineSpacing: 5,
    });
  }

  private updateHUD(): void {
    const p     = this.state.player;
    const alive = this.state.enemies.filter((e) => e.hp > 0).length;
    const phase = this.state.phase;

    this.hudText.setColor(phase === 'player' ? C.text : C.yellow);
    this.hudText.setText([
      `Turn ${this.state.turn}   ${phase.toUpperCase()}`,
      `HP ${p.hp}/${p.maxHp}   AP ${p.ap}/${p.maxAp}   Enemies: ${alive}`,
    ]);
  }

  // ── Log ──────────────────────────────────────────────────────────────────────

  private createLogText(): void {
    this.logText = this.add.text(16, LOG_Y + 22, '', {
      fontFamily: 'monospace',
      fontSize:   '11px',
      color:       C.text,
      lineSpacing: 4,
      wordWrap:   { width: 358 },
    });
  }

  private pushLog(msg: string): void {
    this.logLines.push(msg);
    if (this.logLines.length > 12) this.logLines.shift();
    this.updateLogText();
  }

  private updateLogText(): void {
    this.logText.setText(this.logLines.slice(-9));
  }

  // ── Buttons ──────────────────────────────────────────────────────────────────

  private createButtons(): void {
    this.endTurnGfx = this.add.graphics();
    this.paintEndTurnBtn(false);

    this.add.text(20 + 80, BTN_Y + 22, 'END TURN', {
      fontFamily: 'monospace', fontSize: '14px', color: C.green, letterSpacing: 2,
    }).setOrigin(0.5);

    const etZone = this.add.zone(20 + 80, BTN_Y + 22, 160, 44).setInteractive({ useHandCursor: true });
    etZone.on('pointerover', () => this.paintEndTurnBtn(true));
    etZone.on('pointerout',  () => this.paintEndTurnBtn(false));
    etZone.on('pointerdown', () => {
      if (this.state.phase === 'player') this.dispatch({ type: 'endTurn' });
    });

    // Restart button
    const restGfx = this.add.graphics();
    restGfx.fillStyle(H.btnRestBg).fillRoundedRect(210, BTN_Y, 160, 44, 8);
    restGfx.lineStyle(1, H.btnRestBrd).strokeRoundedRect(210, BTN_Y, 160, 44, 8);

    this.add.text(210 + 80, BTN_Y + 22, 'RESTART', {
      fontFamily: 'monospace', fontSize: '14px', color: C.dim, letterSpacing: 2,
    }).setOrigin(0.5);

    const restZone = this.add.zone(210 + 80, BTN_Y + 22, 160, 44).setInteractive({ useHandCursor: true });
    restZone.on('pointerdown', () => {
      this.resetState();
      this.renderAll();
      this.pushLog('Restarted');
    });
  }

  private paintEndTurnBtn(hover: boolean): void {
    this.endTurnGfx.clear();
    this.endTurnGfx.fillStyle(hover ? H.btnEndHov : H.btnEndBg).fillRoundedRect(20, BTN_Y, 160, 44, 8);
    this.endTurnGfx.lineStyle(1, H.btnEndBrd).strokeRoundedRect(20, BTN_Y, 160, 44, 8);
  }
}
