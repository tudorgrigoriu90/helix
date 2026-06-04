import Phaser from 'phaser';
import type { EnemyDef } from '@shared-types/enemy';
import type { FloorTemplate } from '@shared-types/floor-template';
import type { PopulatedRoom } from '@shared-types/floor-plan';
import type { RunState } from '@shared-types/run-state';
import type { Action } from '@shared-types/action';
import type { AbilitySlot } from '@shared-types/ability';
import type { ItemDef } from '@shared-types/item';
import type { EntityStats, DeathCause } from '@shared-types/run-state';
import type { MetaState } from '@shared-types/meta-state';
import type { MutationDef, MutationFamily } from '@shared-types/mutation';
import type { Effect } from '../core/turn-engine/effect';
import type { LaceContext, LaceLine } from '@shared-types/lace-line';
import { TurnEngine } from '../core/turn-engine/turn-engine';
import { chebyshev } from '../core/turn-engine/grid';
import { damageTo } from '../core/turn-engine/effective-stats';
import { CRIT_MULTIPLIER } from '../core/turn-engine/combat';
import { Mulberry32, makeRng } from '../core/rng/mulberry32';
import { parseEnemyDef } from '../core/content/enemy-loader';
import { parseItemDef } from '../core/content/item-loader';
import { parseMutationDef } from '../core/content/mutation-loader';
import { parseLaceLines } from '../core/lace/lace-loader';
import { parseFloorTemplate } from '../core/floor-gen';
import { RunSession, buildEnemyRegistry } from '../core/run';
import { ALLOCATABLE_STATS } from '../core/economy';
import { runSessionCodec } from '../core/run/run-session-save';
import type { RunSessionSave } from '../core/run/run-session';
import { SaveManager } from '../core/save/save-manager';
import { metaCodec, newMetaState, recordRunOutcome } from '../core/save';
import { createWebStorageAdapter } from '../platform/storage-web';
import { adService } from '../platform/ads-bootstrap';
import { LaceNarrator } from '../core/lace';
import type { RunSummaryData } from './PostRunScene';
import { computeBounds, computeLayout, project } from './floor-graph-layout';
import { queueSpriteLoads, drawSprite } from './sprites/sprite-registry';
import { roomSpriteKey, tileSpriteKey } from './sprites/sprite-manifest';
import { queueAudioLoads, playSfx, playMusic } from './audio/audio-registry';

import filterer from '@content/enemies/filterer.json';
import caveCrawler from '@content/enemies/cave_crawler.json';
import acidSpitter from '@content/enemies/acid_spitter.json';
import scavenger from '@content/enemies/scavenger.json';
import shellBrute from '@content/enemies/shell_brute.json';
import pressureWarden from '@content/enemies/pressure_warden.json';
import floor01 from '@content/floors/floor_01.json';
import laceCore from '@content/lace-lines/core.json';
// eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-assignment
const mutationModules = import.meta.glob('../../../../packages/content/mutations/*.json', { eager: true });
const mutationFiles = mutationModules as Record<string, { readonly default: unknown }>;
// eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-assignment
const itemModules = import.meta.glob('../../../../packages/content/items/*.json', { eager: true });
const itemFiles = itemModules as Record<string, { readonly default: unknown }>;

// ── Layout ────────────────────────────────────────────────────────────────────
const W = 390;
const H = 844;
const HUD_Y = 8;
const LACE_Y = HUD_Y + 60;
const STAGE_Y = LACE_Y + 36;
const STAGE_H = 430;
const BTN_Y = STAGE_Y + STAGE_H + 16;
const GRID_PX = 350;
const ABILITY_Y = STAGE_Y + 354;
const ITEM_Y = STAGE_Y + 392;

const C = {
  text: '#e8edf5', dim: '#7a8fad', green: '#a0ffdc', yellow: '#ffdd44', red: '#ff4444', dark: '#0a0e1a',
};
const GC = {
  bg: 0x060a12, node: 0x1a2840, nodeCleared: 0x12331f, edge: 0x2a3a55,
  start: 0xa0ffdc, boss: 0xff4444, current: 0xffdd44, adj: 0x44ff88,
  tileBg: 0x0d1220, tileBorder: 0x1e2a40, hazard: 0x4a2030,
  player: 0xa0ffdc, enemy: 0xff6644, dead: 0x1c1c2e, hpBg: 0x333344, hpGreen: 0x44ff88, hpRed: 0xff3333,
  btnBg: 0x1a3028, btnBrd: 0xa0ffdc,
};

const FINAL_FLOOR = 20;
const STRAND_INTERVAL = 5;

type View = 'map' | 'combat' | 'strand' | 'shop' | 'levelup' | 'loot' | 'swap' | 'inventory' | 'event' | 'safe';

/**
 * S040+ Production game scene — T-161.
 *
 * The player-facing run loop. Receives { meta, originId, seed } from
 * FloorTransitionScene; the full 20-floor descent plays out here.
 *
 * Distinct from RunSandboxScene: no dev tab bar, no debug overlays, proper
 * game-over routing back to HubScene, seed sourced from RunPreviewScene.
 *
 * S040 enemy reveal (T-161): on combat entry, enemies fade in one-by-one
 * (staggered 150ms each) before handing control to the player.
 */
export class GameScene extends Phaser.Scene {
  private session!: RunSession;
  private narrator!: LaceNarrator;
  private enemyRegistry!: ReadonlyMap<string, EnemyDef>;
  private template!: FloorTemplate;
  private laceLines: readonly LaceLine[] = [];
  private mutationPool: readonly MutationDef[] = [];
  private itemPool: readonly ItemDef[] = [];

  private strandSelected: number | null = null;
  private strandRerollUsed = false;

  private seed = 0;
  private originId = 'void_diver';
  private saves!: SaveManager<RunSessionSave>;
  private metaSaves!: SaveManager<MetaState>;
  private meta: MetaState = newMetaState();
  private enemiesKilled = 0;
  private runStartMs = 0;
  private runRecorded = false;
  private lastRunShards = 0;
  /** T-195: cause of the player's death this run, captured from the engine's `defeat` effect. */
  private deathCause: DeathCause = 'enemy_kill';
  /** T-197: achievement ids newly earned this run, surfaced on the post-run rewards strip. */
  private achievementsEarned: string[] = [];
  /** T-198: true once the one-per-run revive has been consumed. */
  private reviveUsed = false;
  /** T-198: set by init() when this scene restart is a post-death revive. */
  private pendingRevive = false;

  private view: View = 'map';
  /** T-178: HP recovered by the most recent Safe Room rest, shown on the S026 panel. */
  private safeRoomHealed = 0;
  /** T-178: view to restore when the inventory closes (Safe Rooms reopen S026, not the map). */
  private inventoryReturnView: View = 'map';
  private combat: RunState | null = null;
  private combatRng!: Mulberry32;
  private swapIncoming: ItemDef | null = null;
  private targeting:
    | { readonly kind: 'ability'; readonly slot: AbilitySlot }
    | { readonly kind: 'item'; readonly item: ItemDef }
    | null = null;

  /** S040: true while the enemy-reveal animation is playing; suppresses enemy draw in renderCombat. */
  private revealingEnemies = false;
  /** S041: transient "YOUR TURN" overlay container — destroyed after its tween completes. */
  private yourTurnContainer: Phaser.GameObjects.GameObject[] = [];
  /** S046: transient "ENEMY PHASE" overlay container — destroyed after its tween completes. */
  private enemyPhaseContainer: Phaser.GameObjects.GameObject[] = [];
  /** S047: whether the in-combat pause menu is open. */
  private combatMenuOpen = false;
  /** S047: whether the player has already confirmed once for surrender (double-confirm). */
  private surrenderConfirmPending = false;
  /** S042: tile the player tapped first; confirmed on a second tap of the same tile. */
  private movePending: { col: number; row: number } | null = null;
  /** S043: enemy currently hovered — drives the damage-range preview label. */
  private attackHoverEnemyId: string | null = null;
  /** S044: tile currently hovered during ability targeting — drives AoE circle preview. */
  private abilityHoverTile: { col: number; row: number } | null = null;
  /** S045: item pending single-tap confirmation (heal items only; AoE items use tile-targeting). */
  private itemConfirmPending: ItemDef | null = null;

  private stage!: Phaser.GameObjects.Graphics;
  private overlay!: Phaser.GameObjects.Graphics;
  private topGfx!: Phaser.GameObjects.Graphics;
  private hudText!: Phaser.GameObjects.Text;
  private laceText!: Phaser.GameObjects.Text;
  private transient: Phaser.GameObjects.GameObject[] = [];
  private buttonZones: Phaser.GameObjects.Zone[] = [];

  constructor() {
    super({ key: 'GameScene' });
  }

  preload(): void {
    queueSpriteLoads(this);
    queueAudioLoads(this);
  }

  init(data: Record<string, unknown>): void {
    if (data['meta'] !== undefined) this.meta = data['meta'] as MetaState;
    if (typeof data['originId'] === 'string') this.originId = data['originId'];
    if (typeof data['seed'] === 'number') this.seed = data['seed'];
    this.pendingRevive = data['revive'] === true;
  }

  create(): void {
    this.add.graphics().fillStyle(GC.bg).fillRect(0, 0, W, H);

    this.stage = this.add.graphics().setDepth(0);
    this.topGfx = this.add.graphics().setDepth(2);
    this.overlay = this.add.graphics().setDepth(3);

    this.hudText = this.add.text(16, HUD_Y, '', {
      fontFamily: 'monospace', fontSize: '12px', color: C.text, lineSpacing: 3,
    });
    this.laceText = this.add.text(16, LACE_Y, '', {
      fontFamily: 'monospace', fontSize: '11px', color: C.green, fontStyle: 'italic',
      wordWrap: { width: W - 32 },
    });

    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => this.onPointer(p.x, p.y));
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => this.onPointerMove(p.x, p.y));

    const adapter = createWebStorageAdapter();
    this.saves = new SaveManager(adapter, runSessionCodec);
    this.metaSaves = new SaveManager(adapter, metaCodec, 'helix.meta');

    this.loadContent();
    if (this.pendingRevive) {
      void this.resumeWithRevive();
    } else {
      this.startRun();
    }
  }

  // ── Content loading ────────────────────────────────────────────────────────

  private loadContent(): void {
    const defs: EnemyDef[] = [filterer, caveCrawler, acidSpitter, scavenger, shellBrute, pressureWarden].map((raw) => {
      const res = parseEnemyDef(raw);
      if (!res.ok) throw new Error(`GameScene: bad enemy content — ${res.error.message}`);
      return res.enemy;
    });
    this.enemyRegistry = buildEnemyRegistry(defs);

    const tpl = parseFloorTemplate(floor01);
    if (!tpl.ok) throw new Error(`GameScene: bad floor content — ${tpl.error.message}`);
    this.template = tpl.template;

    const lace = parseLaceLines(laceCore);
    if (!lace.ok) throw new Error(`GameScene: bad LACE content — ${lace.error.message}`);
    this.laceLines = lace.lines;

    const pool: MutationDef[] = [];
    for (const mod of Object.values(mutationFiles)) {
      const res = parseMutationDef(mod.default);
      if (!res.ok) throw new Error(`GameScene: bad mutation content — ${res.error.message}`);
      pool.push(res.mutation);
    }
    this.mutationPool = pool;

    const items: ItemDef[] = [];
    for (const mod of Object.values(itemFiles)) {
      const res = parseItemDef(mod.default);
      if (!res.ok) throw new Error(`GameScene: bad item content — ${res.error.message}`);
      items.push(res.item);
    }
    this.itemPool = items;
  }

  // ── Run lifecycle ─────────────────────────────────────────────────────────

  private startRun(): void {
    this.session = new RunSession({
      seed: this.seed,
      template: this.template,
      registry: this.enemyRegistry,
      finalFloor: FINAL_FLOOR,
      mutations: this.mutationPool,
      strandEventEveryNFloors: STRAND_INTERVAL,
      itemPool: this.itemPool,
    });
    this.narrator = new LaceNarrator(this.laceLines, makeRng(this.seed, 'events'));
    this.view = 'map';
    this.combat = null;
    this.targeting = null;
    this.enemiesKilled = 0;
    this.runStartMs = Date.now();
    this.runRecorded = false;
    this.lastRunShards = 0;
    this.deathCause = 'enemy_kill';
    this.achievementsEarned = [];
    this.reviveUsed = false;
    adService.reset(); // fresh per-run ad cap + cooldown (UFD E032)
    this.revealingEnemies = false;
    this.say('run_start');
    this.playFloorMusic();
    this.persist();
    this.renderAll();
  }

  /** T-198: load the persisted run, apply the revive mutation, and re-enter. */
  private async resumeWithRevive(): Promise<void> {
    const result = await this.saves.load();
    if (result === null || !result.ok) {
      // Corrupt / missing save — fall back to a fresh run rather than crashing.
      this.startRun();
      return;
    }
    this.session = new RunSession({
      seed: this.seed,
      template: this.template,
      registry: this.enemyRegistry,
      finalFloor: FINAL_FLOOR,
      mutations: this.mutationPool,
      strandEventEveryNFloors: STRAND_INTERVAL,
      itemPool: this.itemPool,
    });
    this.session.applySave(result.value);
    this.session.revive();
    this.persist();
    this.narrator = new LaceNarrator(this.laceLines, makeRng(this.seed, 'events'));
    this.view = 'map';
    this.combat = null;
    this.targeting = null;
    this.enemiesKilled = 0;
    this.runStartMs = Date.now();
    this.runRecorded = false;
    this.lastRunShards = 0;
    this.deathCause = 'enemy_kill';
    this.achievementsEarned = [];
    this.reviveUsed = true;
    this.revealingEnemies = false;
    this.say('generic');
    this.playFloorMusic();
    this.renderAll();
  }

  private persist(): void {
    void this.saves.save(this.session.toSave());
  }

  private floorMusicKey(floor: number): string {
    const h = (Math.imul(floor, 0x9e3779b1) ^ this.seed) | 0;
    return (Math.abs(h) % 2) === 0 ? 'music_room_1' : 'music_room_2';
  }

  private playFloorMusic(): void {
    playMusic(this, this.floorMusicKey(this.session.snapshot.floorNumber));
  }

  // ── LACE ──────────────────────────────────────────────────────────────────

  private say(context: LaceContext): void {
    const line = this.narrator.narrate(context);
    if (line !== null) this.laceText.setText(`LACE: ${line.text}`);
  }

  // ── Input ─────────────────────────────────────────────────────────────────

  private onPointer(x: number, y: number): void {
    if (this.revealingEnemies) return; // block input during S040 reveal
    if (this.combatMenuOpen) return;   // S047: menu zones handle their own input
    if (this.view === 'map') this.onMapPointer(x, y);
    else if (this.view === 'combat') this.onCombatPointer(x, y);
    else if (this.view === 'strand') this.onStrandPointer(x, y);
  }

  /** S043/S044: track hovered tile for attack-preview and AoE-circle preview.
   *  Re-renders only on change to avoid frame thrash. */
  private onPointerMove(x: number, y: number): void {
    const state = this.combat;
    if (state === null || state.phase !== 'player' || this.revealingEnemies) return;
    const tile = this.tileSize(state);
    const col = Math.floor((x - this.gridX(state)) / tile);
    const row = Math.floor((y - STAGE_Y) / tile);
    const inBounds = col >= 0 && col < state.grid.width && row >= 0 && row < state.grid.height;

    // S044: ability AoE hover (targeting mode active)
    if (this.targeting?.kind === 'ability') {
      const newTile = inBounds ? { col, row } : null;
      const changed = newTile?.col !== this.abilityHoverTile?.col || newTile?.row !== this.abilityHoverTile?.row;
      if (changed) { this.abilityHoverTile = newTile; this.renderAll(); }
      return;
    }

    // S043: attack hover (no targeting mode)
    let hoveredId: string | null = null;
    if (inBounds) {
      const enemy = state.enemies.find((e) => e.hp > 0 && e.pos.x === col && e.pos.y === row);
      if (enemy !== undefined && chebyshev(state.player.pos, { x: col, y: row }) <= 1) hoveredId = enemy.id;
    }
    if (hoveredId !== this.attackHoverEnemyId) {
      this.attackHoverEnemyId = hoveredId;
      this.renderAll();
    }
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
    // Capture HP before the move so the Safe Room screen can report the heal —
    // moveTo() auto-rests in safe rooms (RunSession.restIfSafe, 25% max HP).
    const hpBefore = this.session.snapshot.player.hp;
    this.session.moveTo(id);
    const room = this.session.currentRoom();
    const encounter = this.session.beginEncounter();
    if (encounter === null) {
      if (room.type === 'lace_event') this.openEventRoom();
      else if (room.type === 'merchant') this.openDispenser();
      else if (room.type === 'safe') this.openSafeRoom(this.session.snapshot.player.hp - hpBefore);
      if (this.view !== 'event' && this.view !== 'safe') {
        this.maybeShowLoot();
        this.persist();
        this.renderAll();
      }
      return;
    }
    this.say(room.type === 'boss' ? 'boss_start' : 'combat_start');
    if (room.type === 'boss') playMusic(this, 'music_boss');
    this.combat = encounter;
    this.combatRng = makeRng(encounter.seed, 'combat');
    this.targeting = null;
    this.view = 'combat';
    this.session.syncCombat(this.combat, this.combatRng.state);
    this.persist();

    // S040: render board first (enemies hidden), then stagger them in.
    this.revealingEnemies = true;
    this.renderAll();
    this.playEnemyReveal(encounter);
  }

  // ── S041 "YOUR TURN" flash ────────────────────────────────────────────────

  /** Plays a brief centred "YOUR TURN" banner + AP pips when the player phase begins.
   *  The banner fades in (200ms), holds (400ms), then fades out (300ms) before
   *  handing back control. Input is not blocked — the player can act immediately. */
  private playYourTurnFlash(ap: number, maxAp: number): void {
    // Destroy any still-running instance from a previous turn
    this.yourTurnContainer.forEach((g) => g.destroy());
    this.yourTurnContainer = [];

    const cy = STAGE_Y + STAGE_H / 2 - 20;
    const bw = 230;
    const bh = 66;
    const bx = (W - bw) / 2;

    const bg = this.add.graphics().setDepth(4).setAlpha(0);
    bg.fillStyle(0x000000, 0.72).fillRoundedRect(bx, cy - 8, bw, bh, 10);
    bg.lineStyle(2, 0xa0ffdc, 0.7).strokeRoundedRect(bx, cy - 8, bw, bh, 10);

    const label = this.add.text(W / 2, cy + 12, 'YOUR TURN', {
      fontFamily: 'monospace', fontSize: '22px', color: '#a0ffdc', letterSpacing: 6,
    }).setOrigin(0.5).setDepth(4).setAlpha(0);

    // AP pip row (filled squares for available, empty for spent)
    const pipG = this.add.graphics().setDepth(4).setAlpha(0);
    const pipSize = 10;
    const pipGap = 6;
    const totalPipW = maxAp * pipSize + (maxAp - 1) * pipGap;
    const pipStartX = W / 2 - totalPipW / 2;
    const pipY = cy + 38;
    for (let i = 0; i < maxAp; i++) {
      const px = pipStartX + i * (pipSize + pipGap);
      if (i < ap) {
        pipG.fillStyle(0xa0ffdc, 0.9).fillRect(px, pipY, pipSize, pipSize);
      } else {
        pipG.lineStyle(1, 0xa0ffdc, 0.35).strokeRect(px, pipY, pipSize, pipSize);
      }
    }

    const targets = [bg, label, pipG];
    this.yourTurnContainer = targets;

    this.tweens.add({
      targets,
      alpha: 1,
      duration: 200,
      ease: 'Sine.easeOut',
      onComplete: () => {
        this.time.delayedCall(400, () => {
          this.tweens.add({
            targets,
            alpha: 0,
            duration: 300,
            ease: 'Sine.easeIn',
            onComplete: () => {
              targets.forEach((g) => g.destroy());
              this.yourTurnContainer = [];
            },
          });
        });
      },
    });
  }

  // ── S046 "ENEMY PHASE" announcement ─────────────────────────────────────

  /** Brief centred "ENEMY PHASE" banner (red) when the enemy phase begins.
   *  Fades in 180ms, holds 350ms, fades out 250ms. Non-blocking. */
  private playEnemyPhaseFlash(): void {
    this.enemyPhaseContainer.forEach((g) => g.destroy());
    this.enemyPhaseContainer = [];

    const cy = STAGE_Y + STAGE_H / 2 - 20;
    const bw = 230;
    const bh = 50;
    const bx = (W - bw) / 2;

    const bg = this.add.graphics().setDepth(4).setAlpha(0);
    bg.fillStyle(0x000000, 0.72).fillRoundedRect(bx, cy - 8, bw, bh, 10);
    bg.lineStyle(2, 0xff4444, 0.6).strokeRoundedRect(bx, cy - 8, bw, bh, 10);

    const label = this.add.text(W / 2, cy + 16, 'ENEMY PHASE', {
      fontFamily: 'monospace', fontSize: '20px', color: '#ff6644', letterSpacing: 5,
    }).setOrigin(0.5).setDepth(4).setAlpha(0);

    const targets = [bg, label];
    this.enemyPhaseContainer = targets;

    this.tweens.add({
      targets,
      alpha: 1,
      duration: 180,
      ease: 'Sine.easeOut',
      onComplete: () => {
        this.time.delayedCall(350, () => {
          this.tweens.add({
            targets,
            alpha: 0,
            duration: 250,
            ease: 'Sine.easeIn',
            onComplete: () => {
              targets.forEach((g) => g.destroy());
              this.enemyPhaseContainer = [];
            },
          });
        });
      },
    });
  }

  // ── S052 Death sequence animation ────────────────────────────────────────

  /** Red screen flash → vignette closes → "YOU DIED" appears → auto-transitions
   *  to game-over view after 2s total. */
  private playDeathSequence(): void {
    // Phase 1: full red flash (100ms)
    const redFlash = this.add.graphics().setDepth(10).setAlpha(0.85);
    redFlash.fillStyle(0xff0000, 1).fillRect(0, 0, W, H);

    this.tweens.add({
      targets: redFlash, alpha: 0, duration: 100, ease: 'Sine.easeOut',
      onComplete: () => {
        redFlash.destroy();

        // Phase 2: vignette darkness (four corner rects closing in, 600ms)
        const vignette = this.add.graphics().setDepth(10).setAlpha(0);
        vignette.fillStyle(0x000000, 1);
        vignette.fillRect(0, 0, W, H / 3);
        vignette.fillRect(0, H * 2 / 3, W, H / 3);
        vignette.fillRect(0, 0, W / 4, H);
        vignette.fillRect(W * 3 / 4, 0, W / 4, H);

        this.tweens.add({
          targets: vignette, alpha: 0.88, duration: 600, ease: 'Sine.easeIn',
          onComplete: () => {
            // Phase 3: "YOU DIED" text appears (300ms)
            const diedLabel = this.add.text(W / 2, H / 2 - 24, 'YOU DIED', {
              fontFamily: 'monospace', fontSize: '32px', color: '#ff4444',
              stroke: '#000000', strokeThickness: 4, letterSpacing: 8,
            }).setOrigin(0.5).setDepth(11).setAlpha(0);

            // T-195: death_cause readout beneath the headline.
            const causeLabel = this.add.text(W / 2, H / 2 + 14, GameScene.deathCauseLabel(this.deathCause), {
              fontFamily: 'monospace', fontSize: '12px', color: '#7a8fad',
              stroke: '#000000', strokeThickness: 3, letterSpacing: 2,
            }).setOrigin(0.5).setDepth(11).setAlpha(0);

            this.tweens.add({
              targets: [diedLabel, causeLabel], alpha: 1, duration: 300, ease: 'Sine.easeOut',
              onComplete: () => {
                // Phase 4: hold 700ms then transition to game-over
                this.time.delayedCall(700, () => {
                  vignette.destroy();
                  diedLabel.destroy();
                  causeLabel.destroy();
                  // S030 → S031/S032: hand off to the run summary + meta rewards.
                  this.goToPostRun(false);
                });
              },
            });
          },
        });
      },
    });
  }

  // ── S051 Combat victory flash + XP readout ────────────────────────────────

  /** Brief centred overlay: green "CLEARED" with XP gained. Auto-dismisses after 1.5s. */
  private playCombatVictoryFlash(xpGained: number): void {
    const bw = 220;
    const bh = 60;
    const bx = (W - bw) / 2;
    const by = STAGE_Y + (STAGE_H - bh) / 2;

    const bg = this.add.graphics().setDepth(4).setAlpha(0);
    bg.fillStyle(0x000000, 0.7).fillRoundedRect(bx, by, bw, bh, 10);
    bg.lineStyle(2, 0xa0ffdc, 0.7).strokeRoundedRect(bx, by, bw, bh, 10);

    const label = this.add.text(W / 2, by + 16, 'CLEARED', {
      fontFamily: 'monospace', fontSize: '18px', color: '#a0ffdc', letterSpacing: 5,
    }).setOrigin(0.5, 0).setDepth(4).setAlpha(0);

    const xpLabel = this.add.text(W / 2, by + 38, `+${xpGained} XP`, {
      fontFamily: 'monospace', fontSize: '11px', color: '#ffdd44',
    }).setOrigin(0.5, 0).setDepth(4).setAlpha(0);

    const targets = [bg, label, xpLabel];

    this.tweens.add({
      targets, alpha: 1, duration: 200, ease: 'Sine.easeOut',
      onComplete: () => {
        this.time.delayedCall(1100, () => {
          this.tweens.add({
            targets, alpha: 0, duration: 300, ease: 'Sine.easeIn',
            onComplete: () => targets.forEach((g) => g.destroy()),
          });
        });
      },
    });
  }

  // ── S049 Sequential enemy action flashes ─────────────────────────────────

  /** Collects enemy-movement events from the resolved turn effects and
   *  plays a brief orange tile flash for each enemy in order, 200ms apart.
   *  This gives the player a readable sequence of "who moved where". */
  private playEnemyActionsSequential(effects: readonly Effect[], finalState: RunState): void {
    // Ordered list of unique enemy IDs that moved this phase
    const actedfrom: string[] = [];
    for (const fx of effects) {
      if (fx.type === 'entityMoved' && fx.entityId !== 'player' && !actedfrom.includes(fx.entityId)) {
        actedfrom.push(fx.entityId);
      }
    }

    actedfrom.forEach((enemyId, i) => {
      this.time.delayedCall(i * 200, () => {
        const enemy = finalState.enemies.find((e) => e.id === enemyId);
        if (enemy === undefined || enemy.hp <= 0) return;
        this.playEnemyActionFlash(enemy.pos);
      });
    });
  }

  /** A brief orange/amber tile flash at `pos` to indicate an enemy just acted there. */
  private playEnemyActionFlash(pos: { x: number; y: number }): void {
    const state = this.combat;
    if (state === null) return;
    const tile = this.tileSize(state);
    const gx = this.gridX(state);
    const g = this.add.graphics().setDepth(3).setAlpha(0.55);
    g.fillStyle(0xffaa44, 1).fillRect(gx + pos.x * tile, STAGE_Y + pos.y * tile, tile, tile);
    this.tweens.add({
      targets: g, alpha: 0, duration: 200, ease: 'Sine.easeOut',
      onComplete: () => g.destroy(),
    });
  }

  // ── S048 Hit flash ────────────────────────────────────────────────────────

  /** Briefly flashes a bright overlay rect at the entity's tile position.
   *  Red for enemies, white for the player (damage taken). */
  private playHitFlash(entityId: string): void {
    const state = this.combat;
    if (state === null) return;

    let tilePos: { x: number; y: number } | null = null;
    let flashColor = 0xff4444;

    if (entityId === 'player') {
      tilePos = state.player.pos;
      flashColor = 0xffffff;
    } else {
      const enemy = state.enemies.find((e) => e.id === entityId);
      if (enemy !== undefined) tilePos = enemy.pos;
    }

    if (tilePos === null) return;

    const tile = this.tileSize(state);
    const gx = this.gridX(state);
    const px = gx + tilePos.x * tile;
    const py = STAGE_Y + tilePos.y * tile;

    const flash = this.add.graphics().setDepth(3).setAlpha(0.7);
    flash.fillStyle(flashColor, 1).fillRect(px, py, tile, tile);

    this.tweens.add({
      targets: flash,
      alpha: 0,
      duration: 220,
      ease: 'Sine.easeOut',
      onComplete: () => flash.destroy(),
    });
  }

  // ── S050 Status tick visualisation ────────────────────────────────────────

  /** Flash the entity's tile and show a brief status icon/label when a status
   *  is applied (bright tint) or expires (fading grey). */
  private playStatusFlash(entityId: string, status: string, applied: boolean): void {
    const state = this.combat;
    if (state === null) return;

    let tilePos: { x: number; y: number } | null = null;
    if (entityId === 'player') {
      tilePos = state.player.pos;
    } else {
      const enemy = state.enemies.find((e) => e.id === entityId);
      if (enemy !== undefined) tilePos = enemy.pos;
    }
    if (tilePos === null) return;

    const tile = this.tileSize(state);
    const gx = this.gridX(state);
    const px = gx + tilePos.x * tile;
    const py = STAGE_Y + tilePos.y * tile;

    const color = applied ? this.statusColor(status) : 0x888888;
    const flash = this.add.graphics().setDepth(3).setAlpha(applied ? 0.55 : 0.4);
    flash.fillStyle(color, 1).fillRect(px, py, tile, tile);

    // Small icon text above the tile (status abbreviation)
    const icon = this.add.text(px + tile / 2, py - 2, applied ? `+${status}` : `${status}✓`, {
      fontFamily: 'monospace', fontSize: '8px',
      color: applied ? `#${color.toString(16).padStart(6, '0')}` : '#888888',
    }).setOrigin(0.5, 1).setDepth(3).setAlpha(applied ? 1 : 0.7);

    this.tweens.add({
      targets: [flash, icon], alpha: 0, duration: applied ? 280 : 400,
      ease: applied ? 'Sine.easeOut' : 'Sine.easeIn',
      onComplete: () => { flash.destroy(); icon.destroy(); },
    });
  }

  /** A status-specific colour for the tile flash. */
  private statusColor(status: string): number {
    switch (status) {
      case 'burn': return 0xff6600;
      case 'infected': return 0x44cc44;
      case 'crushed': return 0xcc8844;
      case 'frozen': return 0x44ccff;
      default: return 0xaa44ff;
    }
  }

  // ── S040 Enemy reveal animation ───────────────────────────────────────────

  /** Fades each enemy in one-by-one (150ms stagger) over the already-rendered
   *  grid, then does a final renderAll() with enemies shown normally. */
  private playEnemyReveal(state: RunState): void {
    const enemies = state.enemies.filter((e) => e.hp > 0);
    if (enemies.length === 0) {
      this.revealingEnemies = false;
      this.renderAll();
      return;
    }

    const tile = this.tileSize(state);
    const gx = this.gridX(state);
    const reveals: Phaser.GameObjects.Graphics[] = [];
    let completed = 0;

    const onAllDone = (): void => {
      reveals.forEach((r) => r.destroy());
      this.revealingEnemies = false;
      this.renderAll();
    };

    enemies.forEach((e, i) => {
      const cx = gx + e.pos.x * tile + tile / 2;
      const cy = STAGE_Y + e.pos.y * tile + tile / 2;
      const r = tile * 0.38;

      const g = this.add.graphics().setAlpha(0).setDepth(1);
      // Silhouette marker — filled circle in enemy colour + subtle border
      g.fillStyle(GC.enemy, 0.9).fillCircle(cx, cy, r);
      g.lineStyle(1.5, 0xff8866, 0.8).strokeCircle(cx, cy, r);
      // Thin HP bar above the marker
      g.fillStyle(GC.hpBg).fillRect(cx - r, cy - r - 5, r * 2, 3);
      g.fillStyle(GC.hpRed).fillRect(cx - r, cy - r - 5, r * 2, 3);
      reveals.push(g);

      this.tweens.add({
        targets: g,
        alpha: 1,
        duration: 250,
        delay: i * 150,
        ease: 'Sine.easeOut',
        onComplete: () => {
          completed++;
          if (completed === enemies.length) onAllDone();
        },
      });
    });
  }

  // ── Combat actions ────────────────────────────────────────────────────────

  private onCombatPointer(x: number, y: number): void {
    const state = this.combat;
    if (state === null || state.phase !== 'player') return;
    const tile = this.tileSize(state);
    const col = Math.floor((x - this.gridX(state)) / tile);
    const row = Math.floor((y - STAGE_Y) / tile);
    if (col < 0 || col >= state.grid.width || row < 0 || row >= state.grid.height) return;

    // Ability/item targeting overrides everything
    if (this.targeting !== null) {
      this.movePending = null;
      this.onTargetTile(col, row);
      return;
    }

    // Player's own tile: cancel pending move
    if (col === state.player.pos.x && row === state.player.pos.y) {
      if (this.movePending !== null) { this.movePending = null; this.renderAll(); }
      return;
    }

    // Enemy tile: attack if adjacent, else cancel pending
    const enemy = state.enemies.find((e) => e.hp > 0 && e.pos.x === col && e.pos.y === row);
    if (enemy !== undefined) {
      this.movePending = null;
      if (chebyshev(state.player.pos, { x: col, y: row }) <= 1) this.combatAction({ type: 'attack', targetId: enemy.id });
      return;
    }

    // S042: adjacent empty tile — first tap previews, second tap confirms
    if (chebyshev(state.player.pos, { x: col, y: row }) === 1) {
      if (this.movePending?.col === col && this.movePending.row === row) {
        // Second tap on the same tile → confirm move
        this.movePending = null;
        this.combatAction({ type: 'move', targetPos: { x: col, y: row } });
      } else {
        // First tap → show preview
        this.movePending = { col, row };
        this.renderAll();
      }
      return;
    }

    // Non-adjacent non-enemy tile → cancel any pending preview
    if (this.movePending !== null) { this.movePending = null; this.renderAll(); }
  }

  private onAbilityButton(slot: AbilitySlot): void {
    const state = this.combat;
    if (state === null || state.phase !== 'player') return;
    if (slot.cooldownRemaining > 0 || state.player.ap < slot.def.apCost) return;
    if (this.targeting?.kind === 'ability' && this.targeting.slot.def.id === slot.def.id) {
      this.targeting = null; this.abilityHoverTile = null; this.renderAll(); return;
    }
    if (slot.def.targetType === 'self') {
      this.targeting = null; this.abilityHoverTile = null;
      this.combatAction({ type: 'useAbility', abilityId: slot.def.id });
      return;
    }
    this.targeting = { kind: 'ability', slot };
    this.abilityHoverTile = null;
    this.renderAll();
  }

  private onItemButton(item: ItemDef): void {
    const state = this.combat;
    if (state === null || state.phase !== 'player' || state.player.ap < 1) return;
    // Toggle off if already selected
    if (this.targeting?.kind === 'item' && this.targeting.item.id === item.id) {
      this.targeting = null; this.renderAll(); return;
    }
    if (this.itemConfirmPending?.id === item.id) {
      this.itemConfirmPending = null; this.renderAll(); return;
    }
    if (item.effect?.kind === 'heal') {
      // S045: require a confirmation tap before consuming a heal item
      this.itemConfirmPending = item;
      this.targeting = null;
      this.renderAll();
      return;
    }
    this.targeting = { kind: 'item', item };
    this.itemConfirmPending = null;
    this.renderAll();
  }

  private onTargetTile(col: number, row: number): void {
    const state = this.combat;
    const target = this.targeting;
    if (state === null || target === null) return;

    if (target.kind === 'item') {
      this.targeting = null;
      this.combatAction({ type: 'useItem', itemId: target.item.id, targetPos: { x: col, y: row } });
      return;
    }

    const def = target.slot.def;
    if (chebyshev(state.player.pos, { x: col, y: row }) > def.range) return;
    if (def.targetType === 'enemy') {
      const enemy = state.enemies.find((e) => e.hp > 0 && e.pos.x === col && e.pos.y === row);
      if (enemy === undefined) return;
      this.targeting = null;
      this.combatAction({ type: 'useAbility', abilityId: def.id, targetId: enemy.id });
    } else {
      this.targeting = null;
      this.combatAction({ type: 'useAbility', abilityId: def.id, targetPos: { x: col, y: row } });
    }
  }

  private combatAction(action: Action): void {
    const state = this.combat;
    if (state === null) return;
    const result = TurnEngine.apply(state, action, this.combatRng);
    if (result.errors.length === 0) {
      if (action.type === 'attack') playSfx(this, 'sfx_attack');
      else if (action.type === 'useAbility') playSfx(this, 'sfx_ability');
      else if (action.type === 'useItem') playSfx(this, 'sfx_item');
      this.combat = result.state;
      this.session.syncCombat(result.state, this.combatRng.state);
      this.reactToCombatEffects(result.effects);
      // S049: for endTurn, schedule per-enemy action flashes at 200ms stagger
      if (action.type === 'endTurn') {
        this.playEnemyActionsSequential(result.effects, result.state);
      }
      this.maybeEndCombat();
      if (this.combat !== null) this.persist();
    }
    this.renderAll();
  }

  private reactToCombatEffects(effects: readonly Effect[]): void {
    let playerHurt = false;
    for (const fx of effects) {
      if (fx.type === 'entityDied' && fx.entityId !== 'player') {
        this.enemiesKilled += 1;
        this.say('enemy_killed');
        playSfx(this, 'sfx_enemy_death');
      }
      // T-195: capture the death cause for the post-run summary.
      if (fx.type === 'defeat') this.deathCause = fx.cause;
      if (fx.type === 'damageDealt' && fx.targetId === 'player') playerHurt = true;
      // S048: flash the hit entity's tile
      if (fx.type === 'damageDealt') {
        this.playHitFlash(fx.targetId);
      }
      // S050: flash + icon when a status is applied or expires
      if (fx.type === 'statusApplied') {
        this.playStatusFlash(fx.targetId, fx.status, true);
      }
      if (fx.type === 'statusExpired') {
        this.playStatusFlash(fx.targetId, fx.status, false);
      }
      // S041: fire the "YOUR TURN" banner the moment the player phase begins.
      if (fx.type === 'phaseChanged' && fx.to === 'player' && this.combat !== null) {
        const { ap, maxAp } = this.combat.player;
        this.playYourTurnFlash(ap, maxAp);
      }
      // S046: fire the "ENEMY PHASE" banner the moment the enemy phase begins.
      if (fx.type === 'phaseChanged' && fx.to === 'enemy') {
        this.playEnemyPhaseFlash();
      }
    }
    if (playerHurt) playSfx(this, 'sfx_player_hurt');
  }

  private maybeEndCombat(): void {
    const state = this.combat;
    if (state === null) return;
    if (state.phase === 'player' || state.phase === 'enemy') return;

    const wasBoss = this.session.currentRoom().type === 'boss';
    const xpBefore = this.session.snapshot.xp;
    this.session.endEncounter(state);
    const xpGained = this.session.snapshot.xp - xpBefore;
    this.combat = null;
    this.targeting = null;
    this.movePending = null;
    this.attackHoverEnemyId = null;
    this.abilityHoverTile = null;
    this.itemConfirmPending = null;
    this.combatMenuOpen = false;
    this.surrenderConfirmPending = false;
    const status = this.session.snapshot.status;

    if (status === 'defeat') {
      this.say('player_death');
      playSfx(this, 'sfx_defeat');
      playMusic(this, 'music_menu');
      this.recordRun(false);
      void this.saves.clear();
      // S052: play death sequence before revealing game-over
      this.playDeathSequence();
    } else if (status === 'victory') {
      this.say('boss_killed');
      playSfx(this, 'sfx_victory');
      playMusic(this, 'music_menu');
      this.recordRun(true);
      void this.saves.clear();
      // S031/S032: route to the run summary + meta rewards.
      this.goToPostRun(true);
      return;
    } else if (status === 'strand_event') {
      this.say('boss_killed');
      this.openStrandEvent();
    } else if (status === 'floor_complete') {
      this.say('floor_complete');
      if (wasBoss) this.playFloorMusic();
      this.view = 'map';
      this.persist();
      if (xpGained > 0) this.playCombatVictoryFlash(xpGained);
    } else {
      this.say(wasBoss ? 'boss_killed' : 'room_cleared');
      if (wasBoss) this.playFloorMusic();
      this.view = 'map';
      this.persist();
      if (xpGained > 0) this.playCombatVictoryFlash(xpGained);
    }

    if (this.view === 'map' && this.session.snapshot.pendingStatPoints > 0) {
      this.view = 'levelup';
    }
    this.maybeShowLoot();
  }

  private recordRun(won: boolean): void {
    if (this.runRecorded) return;
    this.runRecorded = true;
    const snap = this.session.snapshot;
    const before = this.meta.shardCrystals;
    this.meta = recordRunOutcome(this.meta, {
      won,
      floorReached: snap.floorNumber,
      enemiesKilled: this.enemiesKilled,
      playtimeMs: Date.now() - this.runStartMs,
      veinEarned: snap.veinEarned,
    });
    this.lastRunShards = this.meta.shardCrystals - before;
    void this.metaSaves.save(this.meta);
  }

  /** T-196/T-197: hand off to the "What You Became" + meta-rewards summary. */
  private goToPostRun(won: boolean): void {
    const snap = this.session.snapshot;
    const names = snap.player.mutations.map((id) => {
      const def = this.mutationPool.find((m) => m.id === id);
      return def?.name ?? id;
    });
    const summary: RunSummaryData = {
      meta: this.meta,
      won,
      floorReached: snap.floorNumber,
      finalFloor: FINAL_FLOOR,
      enemiesKilled: this.enemiesKilled,
      shardsEarned: this.lastRunShards,
      veinEarned: snap.veinEarned,
      mutations: names,
      dominantTraits: (snap.player.dominantTraits ?? []) as MutationFamily[],
      playtimeMs: Date.now() - this.runStartMs,
      deathCause: won ? null : this.deathCause,
      achievementsEarned: this.achievementsEarned,
      reviveAvailable: !won && !this.reviveUsed,
    };
    this.scene.start('PostRunScene', summary as unknown as Record<string, unknown>);
  }

  // ── Dispenser ─────────────────────────────────────────────────────────────

  private openDispenser(): void {
    if (this.session.dispenserStock().length === 0) {
      this.laceText.setText('LACE: The Dispenser is dark. Nothing on offer here.');
      return;
    }
    this.say('generic');
    this.view = 'shop';
  }

  private buyItem(item: ItemDef): void {
    if (!this.session.canAfford(item)) {
      this.laceText.setText(`LACE: ${item.name} costs ${this.session.dispenserPriceOf(item)} VEIN — you can't afford it.`);
      this.renderAll(); return;
    }
    if (!this.session.canCarry(item)) {
      const { count, limit } = this.session.inventory()[item.category];
      this.laceText.setText(`LACE: Your ${item.category} slots are full (${count}/${limit}). Drop something first.`);
      this.renderAll(); return;
    }
    this.session.purchaseItem(item);
    playSfx(this, 'ui_click');
    this.laceText.setText(`LACE: Acquired ${item.name}.`);
    this.persist();
    this.renderAll();
  }

  private leaveDispenser(): void {
    this.view = 'map';
    this.renderAll();
  }

  // ── S024 Event Room ───────────────────────────────────────────────────────

  /**
   * In-world lore choices surfaced when the player enters a `lace_event` room.
   * Three event sets are embedded here; the active set is picked deterministically
   * from the current room id so the same run always shows the same event.
   * Mechanical rewards are intentionally minimal for v0.1 — authored event
   * content and richer outcomes land with the content system (T-282+).
   */
  private static readonly EVENT_SETS: ReadonlyArray<{
    title: string;
    sub: string;
    choices: ReadonlyArray<{ label: string; desc: string; reward: 'vein' | 'heal' | 'sig' }>;
  }> = [
    {
      title: 'ANOMALOUS SIGNAL',
      sub: 'LACE detects a residual broadcast from before the first descent.',
      choices: [
        { label: 'TAP THE FREQUENCY', desc: '+20 VEIN Crystals — the signal rewards contact.', reward: 'vein' },
        { label: 'FILTER THE NOISE', desc: 'Recover 25% HP — discipline has its own dividend.', reward: 'heal' },
        { label: 'LOG AND LEAVE', desc: '+15 VEIN — prudence over curiosity.', reward: 'sig' },
      ],
    },
    {
      title: 'SEALED ALCOVE',
      sub: 'A recess in the wall, untouched. LACE cannot read what is inside.',
      choices: [
        { label: 'FORCE IT OPEN', desc: '+20 VEIN — whatever was sealed is now yours.', reward: 'vein' },
        { label: 'LISTEN FIRST', desc: 'Recover 25% HP — patience costs nothing here.', reward: 'heal' },
        { label: 'LEAVE IT SEALED', desc: '+15 VEIN — some debts stay closed.', reward: 'sig' },
      ],
    },
    {
      title: 'STRAND ECHO',
      sub: 'A previous Sigma-carrier\'s mutation left an imprint in the floor.',
      choices: [
        { label: 'ABSORB THE ECHO', desc: '+20 VEIN — borrowed memory, real reward.', reward: 'vein' },
        { label: 'REINFORCE YOUR CELLS', desc: 'Recover 25% HP — your biology asserts itself.', reward: 'heal' },
        { label: 'PASS THROUGH QUICKLY', desc: '+15 VEIN — no inheritance today.', reward: 'sig' },
      ],
    },
  ];

  private openEventRoom(): void {
    this.view = 'event';
    this.say('generic');
    this.persist();
    this.renderAll();
  }

  // ── S026 Safe Room (T-178) ──────────────────────────────────────────────────

  /** Deterministic LACE reflections shown on the Safe Room moment (GDD §12.8). */
  private static readonly SAFE_ROOM_REFLECTIONS: readonly string[] = [
    'The pressure eases. For a moment, the VEIN forgets you are here.',
    'A pocket of stillness. Your cells knit themselves back toward whole.',
    'No signals, no teeth. Only the slow work of staying alive.',
    'The dark holds its breath. Rest while it does.',
  ];

  /** Opens the S026 Safe Room screen after the auto-rest has been applied.
   *  `healed` is the HP recovered (0 if the player was already at full). */
  private openSafeRoom(healed: number): void {
    this.safeRoomHealed = healed;
    this.view = 'safe';
    this.say('generic');
    this.persist();
    this.renderAll();
  }

  private leaveSafeRoom(): void {
    this.view = 'map';
    this.maybeShowLoot();
    this.persist();
    this.renderAll();
  }

  private renderSafeRoom(): void {
    const snap = this.session.snapshot;
    const roomId = snap.currentRoomId;
    const idx = roomId.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0)
      % GameScene.SAFE_ROOM_REFLECTIONS.length;
    const reflection = GameScene.SAFE_ROOM_REFLECTIONS[idx] ?? GameScene.SAFE_ROOM_REFLECTIONS[0]!;

    // Title + subtitle.
    this.transient.push(
      this.add.text(W / 2, STAGE_Y + 14, 'SAFE ROOM', {
        fontFamily: 'monospace', fontSize: '16px', color: C.green, letterSpacing: 4,
      }).setOrigin(0.5, 0),
      this.add.text(W / 2, STAGE_Y + 40, reflection, {
        fontFamily: 'monospace', fontSize: '10px', color: C.dim,
        wordWrap: { width: W - 56 }, align: 'center', lineSpacing: 3,
      }).setOrigin(0.5, 0),
    );

    // Rest panel — HP recovered + current integrity bar.
    const px = 28;
    const py = STAGE_Y + 110;
    const pw = W - 56;
    const ph = 132;
    this.stage.fillStyle(0x0e1830).fillRoundedRect(px, py, pw, ph, 12);
    this.stage.lineStyle(1, 0x244a38).strokeRoundedRect(px, py, pw, ph, 12);

    const healLine = this.safeRoomHealed > 0
      ? `+${this.safeRoomHealed} HP RECOVERED`
      : 'INTEGRITY ALREADY FULL';
    this.transient.push(
      this.add.text(W / 2, py + 18, healLine, {
        fontFamily: 'monospace', fontSize: '13px', color: this.safeRoomHealed > 0 ? C.green : C.dim,
      }).setOrigin(0.5, 0),
    );

    // HP bar.
    const barX = px + 22;
    const barY = py + 56;
    const barW = pw - 44;
    const barH = 16;
    const frac = Math.max(0, Math.min(1, snap.player.hp / snap.player.maxHp));
    this.stage.fillStyle(GC.hpBg).fillRoundedRect(barX, barY, barW, barH, 4);
    this.stage.fillStyle(GC.hpGreen).fillRoundedRect(barX, barY, Math.max(2, barW * frac), barH, 4);
    this.transient.push(
      this.add.text(W / 2, barY + barH + 8, `${snap.player.hp} / ${snap.player.maxHp} HP`, {
        fontFamily: 'monospace', fontSize: '10px', color: C.text,
      }).setOrigin(0.5, 0),
    );

    // ACCESS INVENTORY button (inside the panel).
    const invX = px + 22;
    const invY = py + ph - 34;
    const invW = pw - 44;
    this.stage.fillStyle(0x14233a).fillRoundedRect(invX, invY, invW, 24, 6);
    this.stage.lineStyle(1, 0x2a3a55).strokeRoundedRect(invX, invY, invW, 24, 6);
    this.transient.push(
      this.add.text(W / 2, invY + 12, 'ACCESS INVENTORY', {
        fontFamily: 'monospace', fontSize: '10px', color: C.text,
      }).setOrigin(0.5),
    );
    const invZone = this.add.zone(invX, invY, invW, 24).setOrigin(0, 0).setInteractive({ useHandCursor: true });
    invZone.on('pointerdown', () => { playSfx(this, 'ui_click'); this.openInventoryFrom('safe'); });
    this.buttonZones.push(invZone);

    // Save confirmation note (the run was persisted on entry).
    this.transient.push(
      this.add.text(W / 2, py + ph + 14, 'progress saved', {
        fontFamily: 'monospace', fontSize: '9px', color: C.dim,
      }).setOrigin(0.5, 0),
    );
  }

  private resolveEventChoice(reward: 'vein' | 'heal' | 'sig'): void {
    const snap = this.session.snapshot;
    if (reward === 'vein') {
      this.session.grantVein(20);
    } else if (reward === 'heal') {
      const amount = Math.floor(snap.player.maxHp * 0.25);
      this.session.healPlayer(amount);
    } else {
      // 'sig' — the lesser VEIN grant; a richer SIG system comes with T-282+.
      this.session.grantVein(15);
    }
    playSfx(this, 'ui_click');
    this.persist();
    this.view = 'map';
    this.maybeShowLoot();
    this.renderAll();
  }

  private renderEvent(): void {
    const roomId = this.session.snapshot.currentRoomId;
    // Pick event set deterministically from the room id's character codes.
    const setIndex = roomId.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0) % GameScene.EVENT_SETS.length;
    const evt = GameScene.EVENT_SETS[setIndex];
    if (evt === undefined) return;

    this.transient.push(
      this.add.text(W / 2, STAGE_Y + 10, evt.title, {
        fontFamily: 'monospace', fontSize: '14px', color: C.yellow, letterSpacing: 2,
      }).setOrigin(0.5, 0),
      this.add.text(W / 2, STAGE_Y + 34, evt.sub, {
        fontFamily: 'monospace', fontSize: '10px', color: C.dim,
        wordWrap: { width: W - 40 }, align: 'center',
      }).setOrigin(0.5, 0),
    );

    const cardTop = STAGE_Y + 76;
    const cardH = 78;
    const cardGap = 10;

    evt.choices.forEach((choice, i) => {
      const x = 16;
      const y = cardTop + i * (cardH + cardGap);
      const w = W - 32;

      this.stage.fillStyle(0x0e1830).fillRoundedRect(x, y, w, cardH, 8);
      this.stage.lineStyle(1, GC.edge).strokeRoundedRect(x, y, w, cardH, 8);

      this.transient.push(
        this.add.text(x + 14, y + 14, choice.label, { fontFamily: 'monospace', fontSize: '12px', color: C.text }),
        this.add.text(x + 14, y + 38, choice.desc, {
          fontFamily: 'monospace', fontSize: '9px', color: C.dim,
          wordWrap: { width: w - 28 },
        }),
      );

      const z = this.add.zone(x, y, w, cardH).setOrigin(0, 0).setInteractive({ useHandCursor: true });
      z.on('pointerdown', () => this.resolveEventChoice(choice.reward));
      z.on('pointerover', () => {
        this.stage.fillStyle(0x162040).fillRoundedRect(x, y, w, cardH, 8);
        this.stage.lineStyle(1, GC.start).strokeRoundedRect(x, y, w, cardH, 8);
      });
      this.buttonZones.push(z);
    });
  }

  // ── Stat allocation ───────────────────────────────────────────────────────

  private allocateStat(stat: keyof EntityStats): void {
    if (this.session.snapshot.pendingStatPoints <= 0) return;
    this.session.allocateStatPoint(stat);
    playSfx(this, 'ui_click');
    this.persist();
    if (this.session.snapshot.pendingStatPoints === 0) this.view = 'map';
    this.renderAll();
  }

  // ── Floor descent ─────────────────────────────────────────────────────────

  /** S029: brief LACE narration overlay (1.5s) before advancing to the next floor.
   *  The current map stays visible beneath the card so the player knows where they are. */
  private descendFloor(): void {
    const nextFloor = this.session.snapshot.floorNumber + 1;
    this.playDescentNarration(nextFloor, () => {
      this.session.descend();
      this.say('floor_enter');
      playSfx(this, 'sfx_descend');
      this.playFloorMusic();
      this.persist();
      this.renderAll();
    });
  }

  private playDescentNarration(nextFloor: number, onDone: () => void): void {
    playSfx(this, 'sfx_descend');

    const bw = W - 48;
    const bh = 110;
    const bx = 24;
    const by = STAGE_Y + (STAGE_H - bh) / 2;

    const card = this.add.graphics().setDepth(4).setAlpha(0);
    card.fillStyle(0x000000, 0.82).fillRoundedRect(bx, by, bw, bh, 12);
    card.lineStyle(2, GC.start, 0.6).strokeRoundedRect(bx, by, bw, bh, 12);

    const floorLabel = this.add.text(W / 2, by + 22, `DESCENDING TO FLOOR ${nextFloor}`, {
      fontFamily: 'monospace', fontSize: '13px', color: C.green, letterSpacing: 3,
    }).setOrigin(0.5, 0).setDepth(4).setAlpha(0);

    // Use the most recent LACE line that's already in the text field — it's
    // fresh from `floor_complete` / `boss_killed` so it's contextually correct.
    const laceLine = this.laceText.text.replace(/^LACE:\s*/, '');
    const narration = this.add.text(W / 2, by + 52, laceLine, {
      fontFamily: 'monospace', fontSize: '11px', color: C.dim, fontStyle: 'italic',
      wordWrap: { width: bw - 32 }, align: 'center', lineSpacing: 3,
    }).setOrigin(0.5, 0).setDepth(4).setAlpha(0);

    const objs = [card, floorLabel, narration];

    // Fade in (250ms) → hold (1000ms) → fade out (250ms) → advance.
    this.tweens.add({
      targets: objs, alpha: 1, duration: 250, ease: 'Sine.easeOut',
      onComplete: () => {
        this.time.delayedCall(1000, () => {
          this.tweens.add({
            targets: objs, alpha: 0, duration: 250, ease: 'Sine.easeIn',
            onComplete: () => {
              objs.forEach((o) => o.destroy());
              onDone();
            },
          });
        });
      },
    });
  }

  // ── Strand Event ──────────────────────────────────────────────────────────

  private openStrandEvent(): void {
    this.session.beginStrandEvent();
    this.strandSelected = null;
    this.strandRerollUsed = false;
    this.view = 'strand';
    this.say('generic');
    this.persist();
    this.renderAll();
  }

  private onStrandPointer(x: number, y: number): void {
    const cards = this.session.strandOffer;
    if (cards.length === 0) return;
    for (let i = 0; i < cards.length; i++) {
      const r = this.strandCardRect(i);
      if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) {
        this.strandSelected = i;
        this.laceText.setText(`LACE: ${cards[i]!.mutation.lace}`);
        this.renderAll();
        return;
      }
    }
  }

  private takeStrandCard(): void {
    if (this.strandSelected === null) return;
    const card = this.session.strandOffer[this.strandSelected];
    if (card === undefined) return;
    this.session.chooseStrandMutation(card.mutation.id);
    playSfx(this, 'sfx_mutation');
    this.laceText.setText(`LACE: ${card.mutation.lace}`);
    this.view = 'map';
    this.persist();
    this.renderAll();
  }

  private rerollStrandCard(): void {
    if (this.strandSelected === null || this.strandRerollUsed) return;
    this.session.rerollStrandCard(this.strandSelected);
    this.strandRerollUsed = true;
    const card = this.session.strandOffer[this.strandSelected];
    if (card !== undefined) this.laceText.setText(`LACE: ${card.mutation.lace}`);
    this.renderAll();
  }

  private continueIntermission(): void {
    this.session.acceptIntermission();
    this.view = 'map';
    this.persist();
    this.renderAll();
  }

  // ── Loot ──────────────────────────────────────────────────────────────────

  private maybeShowLoot(): void {
    if (this.view === 'map' && this.session.lootPending().length > 0) this.view = 'loot';
  }

  private onTakeLoot(item: ItemDef): void {
    const res = this.session.takeLoot(item.id);
    if (res.needsSwap) {
      this.swapIncoming = item;
      this.view = 'swap';
    } else if (res.taken) {
      playSfx(this, 'ui_click');
      if (this.session.lootPending().length === 0) this.view = 'map';
    }
    this.persist();
    this.renderAll();
  }

  private onSwapPick(dropId: string): void {
    if (this.swapIncoming === null) return;
    this.session.takeLoot(this.swapIncoming.id, dropId);
    playSfx(this, 'ui_click');
    this.swapIncoming = null;
    this.view = this.session.lootPending().length > 0 ? 'loot' : 'map';
    this.persist();
    this.renderAll();
  }

  private leaveSwap(): void {
    if (this.swapIncoming !== null) this.session.discardLoot(this.swapIncoming.id);
    this.swapIncoming = null;
    this.view = this.session.lootPending().length > 0 ? 'loot' : 'map';
    this.persist();
    this.renderAll();
  }

  private leaveLoot(): void {
    for (const item of this.session.lootPending()) this.session.discardLoot(item.id);
    this.swapIncoming = null;
    this.view = 'map';
    this.persist();
    this.renderAll();
  }

  // ── Inventory ─────────────────────────────────────────────────────────────

  private openInventory(): void {
    this.openInventoryFrom('map');
  }

  /** Opens the inventory, remembering which view to restore on close (T-178:
   *  Safe Rooms reopen the S026 screen rather than dropping back to the map). */
  private openInventoryFrom(returnView: View): void {
    this.inventoryReturnView = returnView;
    this.view = 'inventory';
    this.renderAll();
  }

  private closeInventory(): void {
    this.view = this.inventoryReturnView;
    this.renderAll();
  }

  private onDropFromInventory(itemId: string): void {
    this.session.dropItem(itemId);
    playSfx(this, 'ui_back');
    this.persist();
    this.renderAll();
  }

  // ── Rendering ─────────────────────────────────────────────────────────────

  private renderAll(): void {
    this.stage.clear();
    this.topGfx.clear();
    this.overlay.clear();
    this.transient.forEach((t) => t.destroy());
    this.transient = [];
    this.buttonZones.forEach((z) => z.destroy());
    this.buttonZones = [];

    if (this.view === 'map') this.renderMap();
    else if (this.view === 'combat') { this.renderCombat(); this.renderAbilityBar(); this.renderItemBar(); }
    else if (this.view === 'strand') this.renderStrand();
    else if (this.view === 'shop') this.renderShop();
    else if (this.view === 'event') this.renderEvent();
    else if (this.view === 'safe') this.renderSafeRoom();
    else if (this.view === 'levelup') this.renderLevelUp();
    else if (this.view === 'loot') this.renderLoot();
    else if (this.view === 'swap') this.renderSwap();
    else if (this.view === 'inventory') this.renderInventory();

    // S045: item confirmation prompt renders above everything (depth 4)
    if (this.itemConfirmPending !== null && this.view === 'combat') {
      this.renderItemConfirm(this.itemConfirmPending);
    }

    // S047: combat pause menu overlay (depth 5 — above item confirm)
    if (this.combatMenuOpen && this.view === 'combat') {
      this.renderCombatMenu();
    }

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

    for (const e of floor.edges) {
      const a = project(this.roomById(e.from).pos, bounds, transform);
      const b = project(this.roomById(e.to).pos, bounds, transform);
      this.stage.lineStyle(2, GC.edge).lineBetween(a.x, a.y, b.x, b.y);
    }

    for (const room of floor.rooms) {
      const p = project(room.pos, bounds, transform);
      const isCurrent = room.id === snap.currentRoomId;
      let fill = cleared.has(room.id) ? GC.nodeCleared : GC.node;
      if (room.id === floor.bossRoomId) fill = GC.boss;
      else if (room.id === floor.startRoomId) fill = GC.start;
      this.stage.fillStyle(fill).fillCircle(p.x, p.y, 14);

      if (adjacent.has(room.id)) this.stage.lineStyle(3, GC.adj).strokeCircle(p.x, p.y, 17);
      if (isCurrent) this.stage.lineStyle(3, GC.current).strokeCircle(p.x, p.y, 20);

      const iconImg = drawSprite(this, this.stage, roomSpriteKey(room.type), p.x, p.y, 22, { fallback: false });
      if (iconImg !== null) {
        this.transient.push(iconImg);
      } else {
        const label = this.add.text(p.x, p.y, room.type[0]!.toUpperCase(), {
          fontFamily: 'monospace', fontSize: '11px', color: C.dark,
        }).setOrigin(0.5);
        this.transient.push(label);
      }
    }

    const hint = this.add.text(W / 2, STAGE_Y + STAGE_H - 6, 'tap a highlighted room to move', {
      fontFamily: 'monospace', fontSize: '10px', color: C.dim,
    }).setOrigin(0.5, 1);
    this.transient.push(hint);

    const inv = this.session.inventory();
    const total = inv.consumable.count + inv.passive.count + inv.equipment.count;
    const cap = inv.consumable.limit + inv.passive.limit + inv.equipment.limit;
    const invLabel = this.add.text(W - 16, STAGE_Y + 4, `ITEMS ${total}/${cap}`, {
      fontFamily: 'monospace', fontSize: '11px', color: C.yellow,
    }).setOrigin(1, 0);
    this.transient.push(invLabel);
    const z = this.add.zone(W - 16 - invLabel.width, STAGE_Y + 4, invLabel.width, 18).setOrigin(0, 0).setInteractive({ useHandCursor: true });
    z.on('pointerdown', () => { playSfx(this, 'ui_click'); this.openInventory(); });
    this.buttonZones.push(z);
  }

  private tileSize(state: RunState): number {
    return Math.floor(GRID_PX / Math.max(state.grid.width, state.grid.height));
  }

  private gridX(state: RunState): number {
    return Math.floor((W - this.tileSize(state) * state.grid.width) / 2);
  }

  private sprite(key: string, x: number, y: number, size: number, tint?: number): void {
    const img = drawSprite(this, this.stage, key, x, y, size, tint === undefined ? {} : { tint });
    if (img !== null) { img.setDepth(1); this.transient.push(img); }
  }

  private renderCombat(): void {
    const state = this.combat;
    if (state === null) return;
    const tile = this.tileSize(state);
    const gx = this.gridX(state);

    for (let r = 0; r < state.grid.height; r++) {
      for (let c = 0; c < state.grid.width; c++) {
        const t = state.grid.tiles[r * state.grid.width + c]!;
        const px = gx + c * tile;
        const py = STAGE_Y + r * tile;
        this.sprite(tileSpriteKey(t), px + tile / 2, py + tile / 2, tile);
        this.stage.lineStyle(1, GC.tileBorder).strokeRect(px, py, tile, tile);
      }
    }

    const drawHp = (cx: number, cy: number, frac: number, color: number): void => {
      this.topGfx.fillStyle(GC.hpBg).fillRect(cx - tile / 2 + 2, cy - tile / 2 + 2, tile - 4, 3);
      if (frac > 0) this.topGfx.fillStyle(color).fillRect(cx - tile / 2 + 2, cy - tile / 2 + 2, Math.round((tile - 4) * frac), 3);
    };

    const addLabel = (cx: number, topY: number, text: string, color: string): void => {
      const t = this.add.text(cx, topY - 2, text, {
        fontFamily: 'monospace', fontSize: '9px', align: 'center', color,
      }).setOrigin(0.5, 1).setDepth(2);
      this.transient.push(t);
    };

    // S040: skip enemies during reveal animation — the reveal tweens draw them.
    if (!this.revealingEnemies) {
      for (const e of state.enemies) {
        const cx = gx + e.pos.x * tile + tile / 2;
        const cy = STAGE_Y + e.pos.y * tile + tile / 2;
        if (e.hp <= 0) { this.sprite(e.enemyDefId, cx, cy, tile * 0.9, GC.dead); continue; }
        this.sprite(e.enemyDefId, cx, cy, tile * 0.92);
        drawHp(cx, cy, e.hp / e.maxHp, GC.hpRed);
        const def = this.enemyRegistry.get(e.enemyDefId);
        const name = def ? def.name : e.enemyDefId;
        addLabel(cx, STAGE_Y + e.pos.y * tile, `${name}\n${e.hp}/${e.maxHp}`, def?.tier === 'boss' ? C.red : C.yellow);
      }
    }

    if (this.targeting !== null && state.phase === 'player') {
      const range = this.targeting.kind === 'ability' ? this.targeting.slot.def.range : Infinity;
      for (let r = 0; r < state.grid.height; r++) {
        for (let c = 0; c < state.grid.width; c++) {
          if (c === state.player.pos.x && r === state.player.pos.y) continue;
          if (chebyshev(state.player.pos, { x: c, y: r }) <= range) {
            this.topGfx.fillStyle(0x44ccff, 0.16).fillRect(gx + c * tile, STAGE_Y + r * tile, tile, tile);
          }
        }
      }

      // S044: AoE circle on hovered tile for ability targeting
      if (this.targeting.kind === 'ability' && this.abilityHoverTile !== null) {
        const def = this.targeting.slot.def;
        const { col: hc, row: hr } = this.abilityHoverTile;
        const inRange = chebyshev(state.player.pos, { x: hc, y: hr }) <= def.range;

        if (inRange) {
          const hx = gx + hc * tile + tile / 2;
          const hy = STAGE_Y + hr * tile + tile / 2;

          // Highlight the targeted tile
          this.topGfx.fillStyle(0xffdd44, 0.28).fillRect(gx + hc * tile, STAGE_Y + hr * tile, tile, tile);
          this.topGfx.lineStyle(2, 0xffdd44, 0.9).strokeRect(gx + hc * tile, STAGE_Y + hr * tile, tile, tile);

          // AoE radius circle (when > 0)
          if (def.aoeRadius > 0) {
            const radiusPx = (def.aoeRadius + 0.5) * tile;
            this.topGfx.fillStyle(0xffdd44, 0.08).fillCircle(hx, hy, radiusPx);
            this.topGfx.lineStyle(1.5, 0xffdd44, 0.55).strokeCircle(hx, hy, radiusPx);
          }

          // Damage range label
          const dmgVal = def.baseDamage + Math.floor(state.player.stats.int * def.intScaling);
          const label = def.aoeRadius > 0 ? `${dmgVal} AoE·${def.aoeRadius} · ${def.apCost}AP` : `${dmgVal} · ${def.apCost}AP`;
          const dmgLabel = this.add.text(hx, STAGE_Y + hr * tile - 3, label, {
            fontFamily: 'monospace', fontSize: '9px', color: '#ffdd44',
          }).setOrigin(0.5, 1).setDepth(2);
          this.transient.push(dmgLabel);
        }
      }
    }

    // S042: move preview — teal tint + border + "1 AP" cost label on the pending tile
    if (this.movePending !== null && state.phase === 'player') {
      const mx = gx + this.movePending.col * tile;
      const my = STAGE_Y + this.movePending.row * tile;
      this.topGfx.fillStyle(0xa0ffdc, 0.22).fillRect(mx, my, tile, tile);
      this.topGfx.lineStyle(2, 0xa0ffdc, 0.85).strokeRect(mx, my, tile, tile);
      const apLabel = this.add.text(mx + tile / 2, my - 3, '1 AP · tap to confirm', {
        fontFamily: 'monospace', fontSize: '9px', color: '#a0ffdc',
      }).setOrigin(0.5, 1).setDepth(2);
      this.transient.push(apLabel);
    }

    // S043: attack preview — red hover tint + damage range on hovered adjacent enemy
    if (this.attackHoverEnemyId !== null && state.phase === 'player') {
      const hovEnemy = state.enemies.find((e) => e.id === this.attackHoverEnemyId && e.hp > 0);
      if (hovEnemy !== undefined) {
        const ex = gx + hovEnemy.pos.x * tile;
        const ey = STAGE_Y + hovEnemy.pos.y * tile;
        this.topGfx.fillStyle(0xff4444, 0.22).fillRect(ex, ey, tile, tile);
        this.topGfx.lineStyle(2, 0xff6644, 0.85).strokeRect(ex, ey, tile, tile);
        const dmgRange = this.calcAttackRange(state, hovEnemy);
        const dmgLabel = this.add.text(ex + tile / 2, ey - 3, `${dmgRange} · 1 AP`, {
          fontFamily: 'monospace', fontSize: '9px', color: '#ff8866',
        }).setOrigin(0.5, 1).setDepth(2);
        this.transient.push(dmgLabel);
      }
    }

    const pp = state.player;
    const pcx = gx + pp.pos.x * tile + tile / 2;
    const pcy = STAGE_Y + pp.pos.y * tile + tile / 2;
    this.sprite('player', pcx, pcy, tile * 0.92);
    drawHp(pcx, pcy, pp.hp / pp.maxHp, GC.hpGreen);
    addLabel(pcx, STAGE_Y + pp.pos.y * tile, `YOU\n${pp.hp}/${pp.maxHp}`, C.green);
  }

  /** S047: in-combat pause menu overlay with RESUME and double-confirm SURRENDER. */
  private renderCombatMenu(): void {
    const cw = 260;
    const ch = this.surrenderConfirmPending ? 200 : 160;
    const cx = (W - cw) / 2;
    const cy = STAGE_Y + (STAGE_H - ch) / 2;

    // Dim the game behind
    const dim = this.add.graphics().setDepth(5);
    dim.fillStyle(0x000000, 0.6).fillRect(0, 0, W, H);

    const card = this.add.graphics().setDepth(5);
    card.fillStyle(0x0e1626).fillRoundedRect(cx, cy, cw, ch, 12);
    card.lineStyle(2, 0x2a3a55).strokeRoundedRect(cx, cy, cw, ch, 12);

    this.transient.push(dim, card,
      this.add.text(W / 2, cy + 20, 'PAUSED', {
        fontFamily: 'monospace', fontSize: '16px', color: '#e8edf5', letterSpacing: 4,
      }).setOrigin(0.5).setDepth(5),
    );

    // RESUME button
    const rowY = cy + 52;
    const rowW = cw - 32;
    const rowX = cx + 16;
    const resumeG = this.add.graphics().setDepth(5);
    resumeG.fillStyle(0x1a3028).fillRoundedRect(rowX, rowY, rowW, 40, 8);
    resumeG.lineStyle(1, 0xa0ffdc).strokeRoundedRect(rowX, rowY, rowW, 40, 8);
    this.transient.push(resumeG,
      this.add.text(W / 2, rowY + 20, 'RESUME', {
        fontFamily: 'monospace', fontSize: '14px', color: '#a0ffdc',
      }).setOrigin(0.5).setDepth(5),
    );
    const resumeZ = this.add.zone(rowX, rowY, rowW, 40).setOrigin(0, 0).setInteractive({ useHandCursor: true }).setDepth(5);
    resumeZ.on('pointerdown', () => { this.combatMenuOpen = false; this.surrenderConfirmPending = false; this.renderAll(); });
    this.buttonZones.push(resumeZ);

    // SURRENDER button (with double-confirm)
    const surrY = rowY + 52;
    const surrLabel = this.surrenderConfirmPending ? 'CONFIRM SURRENDER' : 'SURRENDER';
    const surrColor = this.surrenderConfirmPending ? '#ff4444' : '#7a8fad';
    const surrBorderColor = this.surrenderConfirmPending ? 0xff4444 : 0x3a3050;
    const surrG = this.add.graphics().setDepth(5);
    surrG.fillStyle(0x1a1420).fillRoundedRect(rowX, surrY, rowW, 40, 8);
    surrG.lineStyle(1, surrBorderColor).strokeRoundedRect(rowX, surrY, rowW, 40, 8);
    this.transient.push(surrG,
      this.add.text(W / 2, surrY + 20, surrLabel, {
        fontFamily: 'monospace', fontSize: '14px', color: surrColor,
      }).setOrigin(0.5).setDepth(5),
    );
    const surrZ = this.add.zone(rowX, surrY, rowW, 40).setOrigin(0, 0).setInteractive({ useHandCursor: true }).setDepth(5);
    surrZ.on('pointerdown', () => {
      if (!this.surrenderConfirmPending) {
        this.surrenderConfirmPending = true;
        this.renderAll();
      } else {
        // Second tap confirms: forfeit the run outright.
        this.combatMenuOpen = false;
        this.surrenderConfirmPending = false;
        this.combat = null;
        this.deathCause = 'surrender';
        this.say('player_death');
        playSfx(this, 'sfx_defeat');
        playMusic(this, 'music_menu');
        this.recordRun(false);
        void this.saves.clear();
        // S030 → S031/S032 via the shared death sequence.
        this.playDeathSequence();
      }
    });
    this.buttonZones.push(surrZ);

    if (this.surrenderConfirmPending) {
      this.transient.push(
        this.add.text(W / 2, surrY + 44, 'this ends your run permanently', {
          fontFamily: 'monospace', fontSize: '9px', color: '#7a8fad',
        }).setOrigin(0.5).setDepth(5),
      );
    }
  }

  /** S045: floating confirm prompt for instant-use (heal) items.
   *  Two tappable buttons: USE (fires the action) and CANCEL. */
  private renderItemConfirm(item: ItemDef): void {
    const effect = item.effect?.kind === 'heal' ? `+${item.effect.amount} HP` : '';
    const bw = 260;
    const bh = 72;
    const bx = (W - bw) / 2;
    const by = ITEM_Y - bh - 12;

    const bg = this.add.graphics().setDepth(4);
    bg.fillStyle(0x0a0e1a, 0.92).fillRoundedRect(bx, by, bw, bh, 10);
    bg.lineStyle(2, 0xffdd44, 0.85).strokeRoundedRect(bx, by, bw, bh, 10);

    this.transient.push(bg);
    this.transient.push(
      this.add.text(W / 2, by + 14, `USE ${item.name}?`, {
        fontFamily: 'monospace', fontSize: '12px', color: '#ffdd44',
      }).setOrigin(0.5, 0).setDepth(4),
    );
    if (effect) {
      this.transient.push(
        this.add.text(W / 2, by + 32, effect, {
          fontFamily: 'monospace', fontSize: '10px', color: '#a0ffdc',
        }).setOrigin(0.5, 0).setDepth(4),
      );
    }

    // USE button
    const useX = bx + 12;
    const useW = (bw - 36) / 2;
    const useG = this.add.graphics().setDepth(4);
    useG.fillStyle(0x1a3028).fillRoundedRect(useX, by + 46, useW, 18, 4);
    useG.lineStyle(1, 0xa0ffdc).strokeRoundedRect(useX, by + 46, useW, 18, 4);
    this.transient.push(useG,
      this.add.text(useX + useW / 2, by + 55, 'USE  1AP', {
        fontFamily: 'monospace', fontSize: '9px', color: '#a0ffdc',
      }).setOrigin(0.5).setDepth(4),
    );
    const useZone = this.add.zone(useX, by + 46, useW, 18).setOrigin(0, 0).setInteractive({ useHandCursor: true }).setDepth(4);
    useZone.on('pointerdown', () => {
      const pending = this.itemConfirmPending;
      this.itemConfirmPending = null;
      if (pending !== null) this.combatAction({ type: 'useItem', itemId: pending.id });
    });
    this.buttonZones.push(useZone);

    // CANCEL button
    const cancelX = bx + bw / 2 + 6;
    const cancelG = this.add.graphics().setDepth(4);
    cancelG.fillStyle(0x1a1a2e).fillRoundedRect(cancelX, by + 46, useW, 18, 4);
    cancelG.lineStyle(1, 0x3a3a55).strokeRoundedRect(cancelX, by + 46, useW, 18, 4);
    this.transient.push(cancelG,
      this.add.text(cancelX + useW / 2, by + 55, 'CANCEL', {
        fontFamily: 'monospace', fontSize: '9px', color: '#7a8fad',
      }).setOrigin(0.5).setDepth(4),
    );
    const cancelZone = this.add.zone(cancelX, by + 46, useW, 18).setOrigin(0, 0).setInteractive({ useHandCursor: true }).setDepth(4);
    cancelZone.on('pointerdown', () => { this.itemConfirmPending = null; this.renderAll(); });
    this.buttonZones.push(cancelZone);
  }

  private renderAbilityBar(): void {
    const state = this.combat;
    if (state === null || state.phase !== 'player') return;
    const n = state.player.abilities.length;
    if (n === 0) return;
    const margin = 16;
    const gap = 6;
    const btnW = Math.floor((W - 2 * margin - (n - 1) * gap) / n);
    const btnH = 36;
    // Tighten label size when buttons are narrow (many abilities granted by mutations)
    const labelSize = btnW >= 150 ? '10px' : btnW >= 95 ? '9px' : '8px';

    state.player.abilities.forEach((slot, i) => {
      const x = margin + i * (btnW + gap);
      const onCooldown = slot.cooldownRemaining > 0;
      const canAfford = state.player.ap >= slot.def.apCost;
      const ready = !onCooldown && canAfford;
      const active = this.targeting?.kind === 'ability' && this.targeting.slot.def.id === slot.def.id;

      const border = active ? 0xffdd44 : ready ? GC.btnBrd : 0x2a3050;
      const fillColor = active ? 0x1e2c1a : onCooldown ? 0x0e1020 : GC.btnBg;
      const textColor = active ? C.yellow : ready ? C.green : C.dim;

      this.stage.fillStyle(fillColor).fillRoundedRect(x, ABILITY_Y, btnW, btnH, 6);
      this.stage.lineStyle(1, border).strokeRoundedRect(x, ABILITY_Y, btnW, btnH, 6);

      // Cooldown progress bar: a dim fill across the bottom of the button
      if (onCooldown && slot.def.cooldown > 0) {
        const cdFrac = slot.cooldownRemaining / slot.def.cooldown;
        this.stage.fillStyle(0x3a3060, 0.7).fillRect(x + 1, ABILITY_Y + btnH - 5, Math.round((btnW - 2) * cdFrac), 4);
      }

      // Ability name: replace underscores with spaces, title-cased
      const name = slot.def.id.replace(/_/g, ' ');
      const apCostLabel = `${slot.def.apCost}AP`;
      const cdLabel = onCooldown ? ` · cd${slot.cooldownRemaining}` : '';

      const nameText = this.add.text(x + 6, ABILITY_Y + 10, name, {
        fontFamily: 'monospace', fontSize: labelSize, color: textColor, wordWrap: { width: btnW - 32 },
      }).setOrigin(0, 0);
      const apText = this.add.text(x + btnW - 5, ABILITY_Y + 10, `${apCostLabel}${cdLabel}`, {
        fontFamily: 'monospace', fontSize: '8px', color: onCooldown ? '#554466' : C.dim,
      }).setOrigin(1, 0);

      this.transient.push(nameText, apText);

      const z = this.add.zone(x, ABILITY_Y, btnW, btnH).setOrigin(0, 0).setInteractive({ useHandCursor: true });
      z.on('pointerdown', () => this.onAbilityButton(slot));
      this.buttonZones.push(z);
    });
  }

  private renderItemBar(): void {
    const state = this.combat;
    if (state === null || state.phase !== 'player') return;
    const items = state.player.items.filter((it) => it.category === 'consumable');
    if (items.length === 0) return;

    // Dynamic width: same fill-the-row logic as ability bar (up to 3 items shown)
    const shown = items.slice(0, 3);
    const margin = 16;
    const gap = 5;
    const btnW = Math.floor((W - 2 * margin - (shown.length - 1) * gap) / shown.length);
    const btnH = 28;

    shown.forEach((item, i) => {
      const x = margin + i * (btnW + gap);
      const ready = state.player.ap >= 1;
      const active = (this.targeting?.kind === 'item' && this.targeting.item.id === item.id)
        || this.itemConfirmPending?.id === item.id;
      const border = active ? 0xffdd44 : ready ? GC.btnBrd : 0x2a3050;
      const color = active ? C.yellow : ready ? C.green : C.dim;

      this.stage.fillStyle(active ? 0x1e2210 : GC.btnBg).fillRoundedRect(x, ITEM_Y, btnW, btnH, 6);
      this.stage.lineStyle(1, border).strokeRoundedRect(x, ITEM_Y, btnW, btnH, 6);

      const label = this.add.text(x + 5, ITEM_Y + btnH / 2, item.name, {
        fontFamily: 'monospace', fontSize: '9px', color, wordWrap: { width: btnW - 8 },
      }).setOrigin(0, 0.5);
      this.transient.push(label);

      const z = this.add.zone(x, ITEM_Y, btnW, btnH).setOrigin(0, 0).setInteractive({ useHandCursor: true });
      z.on('pointerdown', () => this.onItemButton(item));
      this.buttonZones.push(z);
    });

    if (this.targeting !== null) {
      const what = this.targeting.kind === 'ability'
        ? this.targeting.slot.def.id.replace(/_/g, ' ')
        : this.targeting.item.name;
      const hint = this.add.text(W / 2, ITEM_Y + 36, `tap a target tile  (tap ${what} again to cancel)`, {
        fontFamily: 'monospace', fontSize: '9px', color: C.yellow,
      }).setOrigin(0.5);
      this.transient.push(hint);
    }
  }

  private renderLevelUp(): void {
    const snap = this.session.snapshot;
    const stats = snap.player.stats;

    this.transient.push(
      this.add.text(W / 2, STAGE_Y + 12, 'LEVEL UP', {
        fontFamily: 'monospace', fontSize: '16px', color: C.yellow,
      }).setOrigin(0.5, 0),
      this.add.text(W / 2, STAGE_Y + 36, `${snap.pendingStatPoints} point(s) to spend  ·  tap a stat`, {
        fontFamily: 'monospace', fontSize: '10px', color: C.dim,
      }).setOrigin(0.5, 0),
    );

    const rowH = 56;
    const top = STAGE_Y + 64;
    ALLOCATABLE_STATS.forEach((stat, i) => {
      const x = 16;
      const y = top + i * (rowH + 8);
      const w = W - 32;
      this.stage.fillStyle(0x12243a).fillRoundedRect(x, y, w, rowH, 8);
      this.stage.lineStyle(1, GC.btnBrd).strokeRoundedRect(x, y, w, rowH, 8);
      this.transient.push(
        this.add.text(x + 14, y + 12, stat.toUpperCase(), { fontFamily: 'monospace', fontSize: '14px', color: C.text }),
        this.add.text(x + 14, y + 34, GameScene.statBlurb(stat), { fontFamily: 'monospace', fontSize: '9px', color: C.dim }),
        this.add.text(x + w - 14, y + rowH / 2, `${stats[stat]}  +1`, { fontFamily: 'monospace', fontSize: '14px', color: C.green }).setOrigin(1, 0.5),
      );
      const z = this.add.zone(x, y, w, rowH).setOrigin(0, 0).setInteractive({ useHandCursor: true });
      z.on('pointerdown', () => this.allocateStat(stat));
      this.buttonZones.push(z);
    });
  }

  private renderShop(): void {
    const stock = this.session.dispenserStock();
    const vein = this.session.snapshot.veinCrystals;
    this.transient.push(
      this.add.text(W / 2, STAGE_Y + 12, 'VEIN DISPENSER', { fontFamily: 'monospace', fontSize: '14px', color: C.yellow }).setOrigin(0.5, 0),
      this.add.text(W / 2, STAGE_Y + 34, `you hold ${vein} VEIN  ·  tap to buy`, { fontFamily: 'monospace', fontSize: '10px', color: C.dim }).setOrigin(0.5, 0),
    );
    if (stock.length === 0) {
      this.transient.push(this.add.text(W / 2, STAGE_Y + 120, 'sold out', { fontFamily: 'monospace', fontSize: '12px', color: C.dim }).setOrigin(0.5));
      return;
    }
    const rowH = 52;
    const top = STAGE_Y + 60;
    stock.forEach((item, i) => {
      const price = this.session.dispenserPriceOf(item);
      const afford = vein >= price;
      const x = 16;
      const y = top + i * (rowH + 8);
      const w = W - 32;
      this.stage.fillStyle(afford ? 0x12243a : 0x0e1626).fillRoundedRect(x, y, w, rowH, 8);
      this.stage.lineStyle(1, afford ? GC.btnBrd : GC.edge).strokeRoundedRect(x, y, w, rowH, 8);
      this.transient.push(
        this.add.text(x + 12, y + 10, item.name, { fontFamily: 'monospace', fontSize: '12px', color: afford ? C.text : C.dim }),
        this.add.text(x + 12, y + 30, `${item.category} · ${item.rarity}`, { fontFamily: 'monospace', fontSize: '9px', color: C.dim }),
        this.add.text(x + w - 12, y + rowH / 2, `${price} VEIN`, { fontFamily: 'monospace', fontSize: '12px', color: afford ? C.green : C.red }).setOrigin(1, 0.5),
      );
      if (afford) {
        const z = this.add.zone(x, y, w, rowH).setOrigin(0, 0).setInteractive({ useHandCursor: true });
        z.on('pointerdown', () => this.buyItem(item));
        this.buttonZones.push(z);
      }
    });
  }

  private itemRow(item: ItemDef, i: number, top: number, onTap?: () => void): void {
    const x = 16;
    const y = top + i * 60;
    const w = W - 32;
    const cursed = item.cursed === true;
    this.stage.fillStyle(cursed ? 0x2a1320 : 0x12243a).fillRoundedRect(x, y, w, 52, 8);
    this.stage.lineStyle(1, cursed ? GC.boss : GC.btnBrd).strokeRoundedRect(x, y, w, 52, 8);
    this.transient.push(
      this.add.text(x + 12, y + 9, item.name, { fontFamily: 'monospace', fontSize: '12px', color: cursed ? C.red : C.text }),
      this.add.text(x + 12, y + 28, `${item.category} · ${item.rarity}${cursed ? ' · CURSED' : ''}`, { fontFamily: 'monospace', fontSize: '9px', color: cursed ? C.red : C.dim }),
      this.add.text(x + w - 12, y + 26, GameScene.modifierLine(item), { fontFamily: 'monospace', fontSize: '10px', color: C.green }).setOrigin(1, 0.5),
    );
    if (onTap !== undefined) {
      const z = this.add.zone(x, y, w, 52).setOrigin(0, 0).setInteractive({ useHandCursor: true });
      z.on('pointerdown', onTap);
      this.buttonZones.push(z);
    }
  }

  private renderLoot(): void {
    const pending = this.session.lootPending();
    const hdr = this.add.text(W / 2, STAGE_Y + 12, 'LOOT FOUND', { fontFamily: 'monospace', fontSize: '14px', color: C.yellow }).setOrigin(0.5, 0).setAlpha(0);
    const sub = this.add.text(W / 2, STAGE_Y + 34, 'tap to take · LEAVE drops the rest', { fontFamily: 'monospace', fontSize: '10px', color: C.dim }).setOrigin(0.5, 0).setAlpha(0);
    this.transient.push(hdr, sub);
    this.tweens.add({ targets: [hdr, sub], alpha: 1, duration: 200, ease: 'Sine.easeOut' });

    // S027: stagger each item card in with an 80ms offset, creating per-item
    // Graphics objects so each can be tweened independently.
    pending.forEach((item, i) => {
      const x = 16;
      const y = STAGE_Y + 60 + i * 60;
      const w = W - 32;
      const cursed = item.cursed === true;

      // Per-item card background (own Graphics so alpha can be tweened).
      const card = this.add.graphics().setAlpha(0);
      card.fillStyle(cursed ? 0x2a1320 : 0x12243a).fillRoundedRect(x, y, w, 52, 8);
      card.lineStyle(1, cursed ? GC.boss : GC.btnBrd).strokeRoundedRect(x, y, w, 52, 8);

      const nameT = this.add.text(x + 12, y + 9, item.name, { fontFamily: 'monospace', fontSize: '12px', color: cursed ? C.red : C.text }).setAlpha(0);
      const tagT = this.add.text(x + 12, y + 28, `${item.category} · ${item.rarity}${cursed ? ' · CURSED' : ''}`, { fontFamily: 'monospace', fontSize: '9px', color: cursed ? C.red : C.dim }).setAlpha(0);
      const modT = this.add.text(x + w - 12, y + 26, GameScene.modifierLine(item), { fontFamily: 'monospace', fontSize: '10px', color: C.green }).setOrigin(1, 0.5).setAlpha(0);

      this.transient.push(card, nameT, tagT, modT);

      this.tweens.add({
        targets: [card, nameT, tagT, modT],
        alpha: 1,
        duration: 220,
        delay: i * 80,
        ease: 'Sine.easeOut',
      });

      const z = this.add.zone(x, y, w, 52).setOrigin(0, 0).setInteractive({ useHandCursor: true });
      z.on('pointerdown', () => this.onTakeLoot(item));
      this.buttonZones.push(z);
    });
  }

  private renderSwap(): void {
    const incoming = this.swapIncoming;
    if (incoming === null) { this.view = 'loot'; this.renderAll(); return; }
    const { count, limit } = this.session.inventory()[incoming.category];
    this.transient.push(
      this.add.text(W / 2, STAGE_Y + 12, 'INVENTORY FULL', { fontFamily: 'monospace', fontSize: '14px', color: C.red }).setOrigin(0.5, 0),
      this.add.text(W / 2, STAGE_Y + 34, `${incoming.category} slots full (${count}/${limit})`, { fontFamily: 'monospace', fontSize: '10px', color: C.dim }).setOrigin(0.5, 0),
      this.add.text(W / 2, STAGE_Y + 50, `take ${incoming.name} — tap below to swap`, { fontFamily: 'monospace', fontSize: '10px', color: C.yellow }).setOrigin(0.5, 0),
    );
    const carried = this.session.snapshot.player.items.filter((i) => i.category === incoming.category);
    carried.forEach((item, i) => this.itemRow(item, i, STAGE_Y + 78, item.cursed === true ? undefined : () => this.onSwapPick(item.id)));
  }

  private renderInventory(): void {
    const inv = this.session.inventory();
    this.transient.push(
      this.add.text(W / 2, STAGE_Y + 12, 'INVENTORY', { fontFamily: 'monospace', fontSize: '14px', color: C.yellow }).setOrigin(0.5, 0),
      this.add.text(W / 2, STAGE_Y + 32, `consumable ${inv.consumable.count}/${inv.consumable.limit}  passive ${inv.passive.count}/${inv.passive.limit}  equip ${inv.equipment.count}/${inv.equipment.limit}`,
        { fontFamily: 'monospace', fontSize: '9px', color: C.dim }).setOrigin(0.5, 0),
      this.add.text(W / 2, STAGE_Y + 48, 'tap an item to drop it', { fontFamily: 'monospace', fontSize: '9px', color: C.dim }).setOrigin(0.5, 0),
    );
    const items = this.session.snapshot.player.items;
    if (items.length === 0) {
      this.transient.push(this.add.text(W / 2, STAGE_Y + 120, 'empty', { fontFamily: 'monospace', fontSize: '12px', color: C.dim }).setOrigin(0.5));
      return;
    }
    items.forEach((item, i) => this.itemRow(item, i, STAGE_Y + 72, item.cursed === true ? undefined : () => this.onDropFromInventory(item.id)));
  }

  private strandCardRect(i: number): { x: number; y: number; w: number; h: number } {
    return { x: 16, y: STAGE_Y + 28 + i * 128, w: W - 32, h: 116 };
  }

  private renderStrand(): void {
    const cards = this.session.strandOffer;
    if (cards.length === 0) {
      this.stage.fillStyle(0x101830).fillRoundedRect(16, STAGE_Y + 40, W - 32, 150, 10);
      this.stage.lineStyle(1, 0xffdd44).strokeRoundedRect(16, STAGE_Y + 40, W - 32, 150, 10);
      this.transient.push(
        this.add.text(W / 2, STAGE_Y + 80, 'VEIN INTERMISSION', { fontFamily: 'monospace', fontSize: '16px', color: C.yellow }).setOrigin(0.5),
        this.add.text(W / 2, STAGE_Y + 120, '+100 VEIN Crystals', { fontFamily: 'monospace', fontSize: '13px', color: C.green }).setOrigin(0.5),
        this.add.text(W / 2, STAGE_Y + 150, '(saturated — 4 mutations held)', { fontFamily: 'monospace', fontSize: '10px', color: C.dim }).setOrigin(0.5),
      );
      return;
    }
    this.transient.push(this.add.text(W / 2, STAGE_Y + 12, 'STRAND EVENT — choose one', { fontFamily: 'monospace', fontSize: '12px', color: C.green }).setOrigin(0.5, 0));
    cards.forEach((card, i) => {
      const r = this.strandCardRect(i);
      const m = card.mutation;
      const selected = this.strandSelected === i;
      this.stage.fillStyle(selected ? 0x16243c : 0x0e1626).fillRoundedRect(r.x, r.y, r.w, r.h, 8);
      this.stage.lineStyle(selected ? 2 : 1, selected ? 0xffdd44 : GC.edge).strokeRoundedRect(r.x, r.y, r.w, r.h, 8);
      const wild = card.slot === 'wild' ? '  ·  WILD' : '';
      this.transient.push(
        this.add.text(r.x + 12, r.y + 10, `${m.family.toUpperCase()} · ${m.tier.toUpperCase()}${wild}`, { fontFamily: 'monospace', fontSize: '9px', color: C.dim }),
        this.add.text(r.x + 12, r.y + 26, m.name, { fontFamily: 'monospace', fontSize: '14px', color: selected ? C.yellow : C.text }),
        this.add.text(r.x + 12, r.y + 50, `Passive: ${GameScene.modifierSummary(m)}`, { fontFamily: 'monospace', fontSize: '10px', color: C.green }),
        this.add.text(r.x + 12, r.y + 68, `Active:  ${GameScene.abilitySummary(m)}`, { fontFamily: 'monospace', fontSize: '10px', color: C.green }),
        this.add.text(r.x + 12, r.y + 90, `SIG +${m.sigBonus}`, { fontFamily: 'monospace', fontSize: '10px', color: C.dim }),
      );
      const z = this.add.zone(r.x, r.y, r.w, r.h).setOrigin(0, 0).setInteractive({ useHandCursor: true });
      z.on('pointerdown', () => this.onStrandPointer(r.x + 1, r.y + 1));
      this.buttonZones.push(z);
    });
  }


  // ── Buttons ───────────────────────────────────────────────────────────────

  private renderButtons(): void {
    if (this.view === 'strand') {
      const cards = this.session.strandOffer;
      if (cards.length === 0) { this.button(20, 'CONTINUE', C.yellow, () => this.continueIntermission()); return; }
      if (this.strandSelected !== null) {
        this.button(20, 'TAKE', C.green, () => this.takeStrandCard());
        if (!this.strandRerollUsed) this.button(210, 'REROLL', C.yellow, () => this.rerollStrandCard());
      }
      return;
    }
    if (this.view === 'combat') {
      if (this.combat?.phase === 'player' && !this.revealingEnemies && !this.combatMenuOpen) {
        this.button(20, 'END TURN', C.green, () => this.combatAction({ type: 'endTurn' }));
      }
      // Pause/menu button — always available during combat (top-right corner)
      if (!this.combatMenuOpen) {
        const pBtnX = W - 52;
        const pBtnY = HUD_Y - 2;
        this.stage.fillStyle(0x1a2840).fillRoundedRect(pBtnX, pBtnY, 40, 28, 6);
        this.stage.lineStyle(1, 0x2a3a55).strokeRoundedRect(pBtnX, pBtnY, 40, 28, 6);
        const pauseLabel = this.add.text(pBtnX + 20, pBtnY + 14, '≡', {
          fontFamily: 'monospace', fontSize: '16px', color: C.dim,
        }).setOrigin(0.5);
        this.transient.push(pauseLabel);
        const pz = this.add.zone(pBtnX, pBtnY, 40, 28).setOrigin(0, 0).setInteractive({ useHandCursor: true });
        pz.on('pointerdown', () => { this.combatMenuOpen = true; this.surrenderConfirmPending = false; this.renderAll(); });
        this.buttonZones.push(pz);
      }
      return;
    }
    if (this.view === 'safe') { this.button(20, 'CONTINUE', C.green, () => this.leaveSafeRoom()); return; }
    if (this.view === 'shop') { this.button(20, 'LEAVE', C.green, () => this.leaveDispenser()); return; }
    if (this.view === 'loot') { this.button(20, 'LEAVE', C.dim, () => this.leaveLoot()); return; }
    if (this.view === 'swap') { this.button(20, 'LEAVE IT', C.dim, () => this.leaveSwap()); return; }
    if (this.view === 'inventory') { this.button(20, 'CLOSE', C.green, () => this.closeInventory()); return; }
    if (this.view === 'levelup') return;
    if (this.view === 'map' && this.session.snapshot.status === 'floor_complete') {
      this.button(20, 'DESCEND', C.yellow, () => this.descendFloor());
      return;
    }
  }

  private button(x: number, label: string, color: string, onTap: () => void): void {
    this.stage.fillStyle(GC.btnBg).fillRoundedRect(x, BTN_Y, 160, 44, 8);
    this.stage.lineStyle(1, GC.btnBrd).strokeRoundedRect(x, BTN_Y, 160, 44, 8);
    const t = this.add.text(x + 80, BTN_Y + 22, label, { fontFamily: 'monospace', fontSize: '14px', color }).setOrigin(0.5);
    this.transient.push(t);
    const z = this.add.zone(x + 80, BTN_Y + 22, 160, 44).setInteractive({ useHandCursor: true });
    z.on('pointerdown', () => { playSfx(this, 'ui_click'); onTap(); });
    this.buttonZones.push(z);
  }

  // ── HUD ───────────────────────────────────────────────────────────────────

  private updateHud(): void {
    const snap = this.session.snapshot;
    const combat = this.view === 'combat' ? this.combat : null;
    const here = combat?.player ?? snap.player;
    const apInfo = combat ? `  AP ${here.ap}/${here.maxAp}  T${combat.turn}` : '';
    const muts = snap.player.mutations.length;
    this.hudText.setText([
      `Floor ${snap.floorNumber}/${FINAL_FLOOR}   HP ${here.hp}/${here.maxHp}${apInfo}`,
      `SIG ${snap.sig}/40   MUT ${muts}/4   VEIN ${snap.veinCrystals}`,
    ]);
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private roomById(id: string): PopulatedRoom {
    const room = this.session.floor.rooms.find((r) => r.id === id);
    if (room === undefined) throw new Error(`GameScene: no room ${id}`);
    return room;
  }

  /** Returns a "min–max" or single value attack damage range string for the preview. */
  private calcAttackRange(state: RunState, enemy: RunState['enemies'][number]): string {
    const baseDmg = Math.floor(state.player.stats.str);  // MELEE_DAMAGE_MULT = 1.0
    const normalDmg = damageTo(enemy, baseDmg, 'physical');
    const critDmg = damageTo(enemy, Math.floor(baseDmg * CRIT_MULTIPLIER), 'physical');
    return normalDmg === critDmg ? `${normalDmg}` : `${normalDmg}–${critDmg}`;
  }

  /** T-195: short in-animation phrasing for each death cause. */
  private static deathCauseLabel(cause: DeathCause): string {
    switch (cause) {
      case 'enemy_kill': return 'slain in the dark';
      case 'boss_kill': return 'broken by a Warden';
      case 'hazard': return 'claimed by the VEIN';
      case 'status_tick': return 'withered away';
      case 'surrender': return 'you gave in';
      case 'mutation_backfire': return 'undone by your own strands';
    }
  }

  private static statBlurb(stat: keyof EntityStats): string {
    switch (stat) {
      case 'str': return 'melee damage';
      case 'res': return 'damage reduction';
      case 'agi': return 'move range + dodge';
      case 'int': return 'ability damage';
    }
  }

  private static modifierLine(item: ItemDef): string {
    const mods = item.modifiers ?? [];
    if (mods.length === 0) return GameScene.itemSummary(item);
    return mods
      .map((m) => (m.kind === 'stat' ? `+${m.delta} ${m.stat.toUpperCase()}` : m.kind === 'maxHp' ? `+${m.delta} HP` : `+${m.delta} AP`))
      .join(', ');
  }

  private static itemSummary(item: ItemDef): string {
    const e = item.effect;
    if (e === null) return item.category === 'consumable' ? 'no effect' : item.category;
    switch (e.kind) {
      case 'heal': return `heal ${e.amount}`;
      case 'damage': return `${e.amount} ${e.damageType} dmg${e.aoeRadius > 0 ? ` · AoE ${e.aoeRadius}` : ''}`;
      case 'applyStatus': return `${e.status} ${e.duration}t${e.aoeRadius > 0 ? ` · AoE ${e.aoeRadius}` : ''}`;
      default: return 'effect';
    }
  }

  private static modifierSummary(m: MutationDef): string {
    if (m.modifiers.length === 0) return '—';
    return m.modifiers
      .map((mod) => mod.kind === 'stat' ? `+${mod.delta} ${mod.stat.toUpperCase()}` : mod.kind === 'maxHp' ? `+${mod.delta} HP` : `+${mod.delta} AP`)
      .join(', ');
  }

  private static abilitySummary(m: MutationDef): string {
    return m.grantsAbility === null ? 'passive only' : `grants ${m.grantsAbility.id} (${m.grantsAbility.apCost} AP)`;
  }
}
