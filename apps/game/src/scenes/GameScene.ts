import Phaser from 'phaser';
import type { EnemyDef } from '@shared-types/enemy';
import type { FloorTemplate } from '@shared-types/floor-template';
import type { PopulatedRoom } from '@shared-types/floor-plan';
import type { RunState } from '@shared-types/run-state';
import type { Action } from '@shared-types/action';
import type { AbilitySlot } from '@shared-types/ability';
import type { ItemDef } from '@shared-types/item';
import type { EntityStats } from '@shared-types/run-state';
import type { MetaState } from '@shared-types/meta-state';
import type { MutationDef } from '@shared-types/mutation';
import type { Effect } from '../core/turn-engine/effect';
import type { LaceContext, LaceLine } from '@shared-types/lace-line';
import { TurnEngine } from '../core/turn-engine/turn-engine';
import { chebyshev } from '../core/turn-engine/grid';
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
import { LaceNarrator } from '../core/lace';
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

type View = 'map' | 'combat' | 'strand' | 'shop' | 'levelup' | 'over' | 'loot' | 'swap' | 'inventory';

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

  private view: View = 'map';
  private combat: RunState | null = null;
  private combatRng!: Mulberry32;
  private swapIncoming: ItemDef | null = null;
  private targeting:
    | { readonly kind: 'ability'; readonly slot: AbilitySlot }
    | { readonly kind: 'item'; readonly item: ItemDef }
    | null = null;

  /** S040: true while the enemy-reveal animation is playing; suppresses enemy draw in renderCombat. */
  private revealingEnemies = false;

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

    const adapter = createWebStorageAdapter();
    this.saves = new SaveManager(adapter, runSessionCodec);
    this.metaSaves = new SaveManager(adapter, metaCodec, 'helix.meta');

    this.loadContent();
    this.startRun();
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
    this.revealingEnemies = false;
    this.say('run_start');
    this.playFloorMusic();
    this.persist();
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
    if (this.view === 'map') this.onMapPointer(x, y);
    else if (this.view === 'combat') this.onCombatPointer(x, y);
    else if (this.view === 'strand') this.onStrandPointer(x, y);
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
      if (room.type === 'lace_event') this.say('generic');
      else if (room.type === 'merchant') this.openDispenser();
      this.maybeShowLoot();
      this.persist();
      this.renderAll();
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

    if (this.targeting !== null) {
      this.onTargetTile(col, row);
      return;
    }

    const enemy = state.enemies.find((e) => e.hp > 0 && e.pos.x === col && e.pos.y === row);
    if (enemy) {
      if (chebyshev(state.player.pos, { x: col, y: row }) <= 1) this.combatAction({ type: 'attack', targetId: enemy.id });
      return;
    }
    if (col === state.player.pos.x && row === state.player.pos.y) return;
    if (chebyshev(state.player.pos, { x: col, y: row }) === 1) this.combatAction({ type: 'move', targetPos: { x: col, y: row } });
  }

  private onAbilityButton(slot: AbilitySlot): void {
    const state = this.combat;
    if (state === null || state.phase !== 'player') return;
    if (slot.cooldownRemaining > 0 || state.player.ap < slot.def.apCost) return;
    if (this.targeting?.kind === 'ability' && this.targeting.slot.def.id === slot.def.id) {
      this.targeting = null; this.renderAll(); return;
    }
    if (slot.def.targetType === 'self') {
      this.targeting = null;
      this.combatAction({ type: 'useAbility', abilityId: slot.def.id });
      return;
    }
    this.targeting = { kind: 'ability', slot };
    this.renderAll();
  }

  private onItemButton(item: ItemDef): void {
    const state = this.combat;
    if (state === null || state.phase !== 'player' || state.player.ap < 1) return;
    if (this.targeting?.kind === 'item' && this.targeting.item.id === item.id) {
      this.targeting = null; this.renderAll(); return;
    }
    if (item.effect?.kind === 'heal') {
      this.targeting = null;
      this.combatAction({ type: 'useItem', itemId: item.id });
      return;
    }
    this.targeting = { kind: 'item', item };
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
      if (fx.type === 'damageDealt' && fx.targetId === 'player') playerHurt = true;
    }
    if (playerHurt) playSfx(this, 'sfx_player_hurt');
  }

  private maybeEndCombat(): void {
    const state = this.combat;
    if (state === null) return;
    if (state.phase === 'player' || state.phase === 'enemy') return;

    const wasBoss = this.session.currentRoom().type === 'boss';
    this.session.endEncounter(state);
    this.combat = null;
    this.targeting = null;
    const status = this.session.snapshot.status;

    if (status === 'defeat') {
      this.say('player_death');
      playSfx(this, 'sfx_defeat');
      playMusic(this, 'music_menu');
      this.view = 'over';
      this.recordRun(false);
      void this.saves.clear();
    } else if (status === 'victory') {
      this.say('boss_killed');
      playSfx(this, 'sfx_victory');
      playMusic(this, 'music_menu');
      this.view = 'over';
      this.recordRun(true);
      void this.saves.clear();
    } else if (status === 'strand_event') {
      this.say('boss_killed');
      this.openStrandEvent();
    } else if (status === 'floor_complete') {
      this.say('floor_complete');
      if (wasBoss) this.playFloorMusic();
      this.view = 'map';
      this.persist();
    } else {
      this.say(wasBoss ? 'boss_killed' : 'room_cleared');
      if (wasBoss) this.playFloorMusic();
      this.view = 'map';
      this.persist();
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

  private descendFloor(): void {
    this.session.descend();
    this.say('floor_enter');
    playSfx(this, 'sfx_descend');
    this.playFloorMusic();
    this.persist();
    this.renderAll();
  }

  // ── Strand Event ──────────────────────────────────────────────────────────

  private openStrandEvent(): void {
    const _outcome = this.session.beginStrandEvent();
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
    this.view = 'inventory';
    this.renderAll();
  }

  private closeInventory(): void {
    this.view = 'map';
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
    else if (this.view === 'levelup') this.renderLevelUp();
    else if (this.view === 'loot') this.renderLoot();
    else if (this.view === 'swap') this.renderSwap();
    else if (this.view === 'inventory') this.renderInventory();
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
    }

    const pp = state.player;
    const pcx = gx + pp.pos.x * tile + tile / 2;
    const pcy = STAGE_Y + pp.pos.y * tile + tile / 2;
    this.sprite('player', pcx, pcy, tile * 0.92);
    drawHp(pcx, pcy, pp.hp / pp.maxHp, GC.hpGreen);
    addLabel(pcx, STAGE_Y + pp.pos.y * tile, `YOU\n${pp.hp}/${pp.maxHp}`, C.green);
  }

  private renderAbilityBar(): void {
    const state = this.combat;
    if (state === null || state.phase !== 'player') return;
    const n = state.player.abilities.length;
    if (n === 0) return;
    const margin = 16;
    const gap = 6;
    const btnW = Math.floor((W - 2 * margin - (n - 1) * gap) / n);
    const fontSize = btnW >= 150 ? '10px' : btnW >= 95 ? '9px' : '8px';

    state.player.abilities.forEach((slot, i) => {
      const x = margin + i * (btnW + gap);
      const ready = slot.cooldownRemaining === 0 && state.player.ap >= slot.def.apCost;
      const active = this.targeting?.kind === 'ability' && this.targeting.slot.def.id === slot.def.id;
      const border = active ? 0xffdd44 : ready ? GC.btnBrd : 0x2a3050;
      const color = active ? C.yellow : ready ? C.green : C.dim;

      this.stage.fillStyle(GC.btnBg).fillRoundedRect(x, ABILITY_Y, btnW, 32, 6);
      this.stage.lineStyle(1, border).strokeRoundedRect(x, ABILITY_Y, btnW, 32, 6);

      const cd = slot.cooldownRemaining > 0 ? ` cd${slot.cooldownRemaining}` : '';
      const label = this.add.text(x + 6, ABILITY_Y + 16, `${slot.def.id} ${slot.def.apCost}AP${cd}`, {
        fontFamily: 'monospace', fontSize, color, wordWrap: { width: btnW - 10 },
      }).setOrigin(0, 0.5);
      this.transient.push(label);

      const z = this.add.zone(x, ABILITY_Y, btnW, 32).setOrigin(0, 0).setInteractive({ useHandCursor: true });
      z.on('pointerdown', () => this.onAbilityButton(slot));
      this.buttonZones.push(z);
    });
  }

  private renderItemBar(): void {
    const state = this.combat;
    if (state === null || state.phase !== 'player') return;
    const items = state.player.items.filter((it) => it.category === 'consumable');
    items.slice(0, 3).forEach((item, i) => {
      const x = 20 + i * 118;
      const ready = state.player.ap >= 1;
      const active = this.targeting?.kind === 'item' && this.targeting.item.id === item.id;
      const border = active ? 0xffdd44 : ready ? GC.btnBrd : 0x2a3050;
      const color = active ? C.yellow : ready ? C.green : C.dim;

      this.stage.fillStyle(GC.btnBg).fillRoundedRect(x, ITEM_Y, 112, 28, 6);
      this.stage.lineStyle(1, border).strokeRoundedRect(x, ITEM_Y, 112, 28, 6);
      const label = this.add.text(x + 6, ITEM_Y + 14, item.name, {
        fontFamily: 'monospace', fontSize: '9px', color,
      }).setOrigin(0, 0.5);
      this.transient.push(label);

      const z = this.add.zone(x, ITEM_Y, 112, 28).setOrigin(0, 0).setInteractive({ useHandCursor: true });
      z.on('pointerdown', () => this.onItemButton(item));
      this.buttonZones.push(z);
    });

    if (this.targeting !== null) {
      const what = this.targeting.kind === 'ability'
        ? this.targeting.slot.def.id
        : this.targeting.item.name;
      const hint = this.add.text(W / 2, ITEM_Y + 38, `targeting ${what} — tap a tile (tap again to cancel)`, {
        fontFamily: 'monospace', fontSize: '10px', color: C.yellow,
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
    this.transient.push(
      this.add.text(W / 2, STAGE_Y + 12, 'LOOT FOUND', { fontFamily: 'monospace', fontSize: '14px', color: C.yellow }).setOrigin(0.5, 0),
      this.add.text(W / 2, STAGE_Y + 34, 'tap to take · LEAVE drops the rest', { fontFamily: 'monospace', fontSize: '10px', color: C.dim }).setOrigin(0.5, 0),
    );
    pending.forEach((item, i) => this.itemRow(item, i, STAGE_Y + 60, () => this.onTakeLoot(item)));
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

  private renderOver(): void {
    const status = this.session.snapshot.status;
    this.overlay.fillStyle(0x000000, 0.72).fillRect(0, STAGE_Y, W, STAGE_H + 120);
    const label = status === 'victory' ? 'VICTORY' : 'DEFEAT';
    const cy = STAGE_Y + STAGE_H / 2;
    this.transient.push(
      this.add.text(W / 2, cy - 48, label, {
        fontFamily: 'monospace', fontSize: '34px', color: status === 'victory' ? C.yellow : C.red,
        stroke: '#000000', strokeThickness: 4,
      }).setOrigin(0.5),
      this.add.text(W / 2, cy + 8, `+${this.lastRunShards.toFixed(2)} Shards earned`, {
        fontFamily: 'monospace', fontSize: '13px', color: C.green,
      }).setOrigin(0.5),
      this.add.text(W / 2, cy + 30, `balance: ${this.meta.shardCrystals.toFixed(2)} SC`, {
        fontFamily: 'monospace', fontSize: '11px', color: C.dim,
      }).setOrigin(0.5),
    );
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
      if (this.combat?.phase === 'player' && !this.revealingEnemies) {
        this.button(20, 'END TURN', C.green, () => this.combatAction({ type: 'endTurn' }));
      }
      return;
    }
    if (this.view === 'shop') { this.button(20, 'LEAVE', C.green, () => this.leaveDispenser()); return; }
    if (this.view === 'loot') { this.button(20, 'LEAVE', C.dim, () => this.leaveLoot()); return; }
    if (this.view === 'swap') { this.button(20, 'LEAVE IT', C.dim, () => this.leaveSwap()); return; }
    if (this.view === 'inventory') { this.button(20, 'CLOSE', C.green, () => this.closeInventory()); return; }
    if (this.view === 'levelup') return;
    if (this.view === 'over') {
      this.button(20, 'RETURN TO HUB', C.green, () => this.scene.start('HubScene', { meta: this.meta }));
      return;
    }
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
