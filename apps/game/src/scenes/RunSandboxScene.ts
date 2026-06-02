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
import { restoreRunSession, runSessionCodec } from '../core/run/run-session-save';
import { decideResume } from '../core/run/resume-decision';
import type { RunSessionSave } from '../core/run/run-session';
import { SaveManager } from '../core/save/save-manager';
import { metaCodec, newMetaState, recordRunOutcome } from '../core/save';
import { createWebStorageAdapter } from '../platform/storage-web';
import { LaceNarrator } from '../core/lace';
import { computeBounds, computeLayout, project } from './floor-graph-layout';
import { drawTabBar, TAB_BAR_HEIGHT } from './tab-bar';
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
// Every mutation file, loaded eagerly — the Strand Event draw pool grows with
// content automatically (no per-file import to maintain). Glob patterns can't use
// path aliases, so this is the relative path to packages/content/mutations.
// `import.meta.glob` is a Vite macro typed by vite/client; tsc resolves it but the
// lint project doesn't pick up the ImportMeta augmentation, hence the disable.
// eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-assignment
const mutationModules = import.meta.glob('../../../../packages/content/mutations/*.json', { eager: true });
const mutationFiles = mutationModules as Record<string, { readonly default: unknown }>;

// Every item file, loaded eagerly — the Dispenser's floor pool grows with content
// automatically (same pattern as mutations above).
// eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-assignment
const itemModules = import.meta.glob('../../../../packages/content/items/*.json', { eager: true });
const itemFiles = itemModules as Record<string, { readonly default: unknown }>;

// ── Layout ────────────────────────────────────────────────────────────────────
const W = 390;
const HUD_Y = TAB_BAR_HEIGHT + 8;
const LACE_Y = HUD_Y + 60;
const STAGE_Y = LACE_Y + 36;
const STAGE_H = 430;
const BTN_Y = STAGE_Y + STAGE_H + 16;
const GRID_PX = 350;
// Ability + item bars sit between the grid (350px tall) and the bottom buttons.
const ABILITY_Y = STAGE_Y + 354;
const ITEM_Y = STAGE_Y + 392;

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
const FINAL_FLOOR = 2; // short, winnable demo descent (beat the Floor 2 boss to win)
// Demo cadence: a Strand Event after every floor's boss (the real game uses 5),
// so the short 2-floor demo still shows the mutation pick.
const STRAND_INTERVAL = 1;

type View = 'map' | 'combat' | 'strand' | 'shop' | 'levelup' | 'over';

export class RunSandboxScene extends Phaser.Scene {
  private session!: RunSession;
  private narrator!: LaceNarrator;
  private enemyRegistry!: ReadonlyMap<string, EnemyDef>;
  private template!: FloorTemplate;
  private laceLines: readonly LaceLine[] = [];
  private mutationPool: readonly MutationDef[] = [];
  private itemPool: readonly ItemDef[] = [];

  /** Strand Event UI state: which card is selected, and whether the reroll was spent. */
  private strandSelected: number | null = null;
  private strandRerollUsed = false;

  /** Run seed — same seed always replays the identical run (determinism, NFR P2). */
  private seed = MASTER_SEED;
  private saves!: SaveManager<RunSessionSave>;
  /** Persistent profile (hard currency, lifetime stats) — survives across runs. */
  private metaSaves!: SaveManager<MetaState>;
  private meta: MetaState = newMetaState();
  /** Per-run trackers folded into MetaState at run-end (T-113/T-114b). */
  private enemiesKilled = 0;
  private runStartMs = 0;
  /** Whether the current run's outcome has already been banked (guards double-count). */
  private runRecorded = false;
  /** Shards earned by the just-finished run, for the game-over readout (0 = none). */
  private lastRunShards = 0;

  private view: View = 'map';
  private combat: RunState | null = null;
  private combatRng!: Mulberry32;
  /** Active ability/item awaiting a target tap (null = not targeting). */
  private targeting:
    | { readonly kind: 'ability'; readonly slot: AbilitySlot }
    | { readonly kind: 'item'; readonly item: ItemDef }
    | null = null;

  private stage!: Phaser.GameObjects.Graphics;
  private overlay!: Phaser.GameObjects.Graphics;
  /** Above-sprite layer for HP bars, targeting tint, threat markers. */
  private topGfx!: Phaser.GameObjects.Graphics;
  private hudText!: Phaser.GameObjects.Text;
  private laceText!: Phaser.GameObjects.Text;
  /** Rolling, plain-English combat event log (for testers). */
  private combatLog!: Phaser.GameObjects.Text;
  private logLines: string[] = [];
  private transient: Phaser.GameObjects.GameObject[] = [];
  private buttonZones: Phaser.GameObjects.Zone[] = [];

  constructor() {
    super({ key: 'RunSandboxScene' });
  }

  preload(): void {
    queueSpriteLoads(this);
    queueAudioLoads(this);
  }

  create(): void {
    this.loadContent();
    this.add.graphics().fillStyle(H.bg).fillRect(0, 0, W, 844);

    // Layering by depth: stage (ground: tiles, borders, map, buttons) < sprites
    // (entities, depth 1) < topGfx (HP bars, targeting tint) < overlay (game-over).
    this.stage = this.add.graphics().setDepth(0);
    this.topGfx = this.add.graphics().setDepth(2);
    this.overlay = this.add.graphics().setDepth(3);
    this.hudText = this.add.text(16, HUD_Y, '', { fontFamily: 'monospace', fontSize: '13px', color: C.text, lineSpacing: 4 });
    this.laceText = this.add.text(16, LACE_Y, '', {
      fontFamily: 'monospace', fontSize: '11px', color: C.green, fontStyle: 'italic', wordWrap: { width: W - 32 },
    });
    // Combat event log: sits just below the action buttons, hidden outside combat.
    this.combatLog = this.add.text(16, BTN_Y + 44, '', {
      fontFamily: 'monospace', fontSize: '10px', color: C.dim, lineSpacing: 2, wordWrap: { width: W - 32 },
    }).setDepth(2);
    this.combatLog.setVisible(false);

    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => this.onPointer(p.x, p.y));
    drawTabBar(this, this.scene.key);

    const adapter = createWebStorageAdapter();
    this.saves = new SaveManager(adapter, runSessionCodec);
    // Separate namespace so the persistent profile survives the run save being
    // cleared at run-end.
    this.metaSaves = new SaveManager(adapter, metaCodec, 'helix.meta');
    void this.boot();
  }

  /** Loads the persistent profile, then resumes a saved run or starts fresh. The
   *  Resume Run? decision (S100) is delegated to {@link decideResume} (T-117); the
   *  modal that surfaces the choice to the player is T-136 — the sandbox auto-picks
   *  "Resume" for now. A missing/corrupt/terminal save falls through to a fresh run. */
  private async boot(): Promise<void> {
    const metaRes = await this.metaSaves.load();
    if (metaRes !== null && metaRes.ok) this.meta = metaRes.value;
    const res = await this.saves.load();
    const decision = decideResume(res);
    if (decision.kind === 'prompt' && res !== null && res.ok) this.resumeFrom(res.value);
    else this.startRun();
  }

  private resumeFrom(save: RunSessionSave): void {
    this.seed = save.seed;
    this.session = restoreRunSession(save, {
      template: this.template, registry: this.enemyRegistry, finalFloor: FINAL_FLOOR,
      mutations: this.mutationPool, strandEventEveryNFloors: STRAND_INTERVAL, itemPool: this.itemPool,
    });
    this.narrator = new LaceNarrator(this.laceLines, makeRng(this.seed, 'events'));
    this.combat = null;
    this.targeting = null;
    this.laceText.setText('LACE: ...you came back. The VEIN remembers where it left you.');
    this.playRoomMusic();
    // A run saved mid-combat resumes straight back into the fight (T-114), with
    // the combat RNG restored so rolls stay deterministic across the reload.
    const active = this.session.activeCombat();
    if (active !== null) {
      this.combat = active.state;
      this.combatRng = new Mulberry32(active.rngState);
      if (this.session.currentRoom().type === 'boss') playMusic(this, 'music_boss');
      this.view = 'combat';
      this.renderAll();
      return;
    }
    // A run saved mid-Strand-Event resumes straight into the pick; one with
    // unspent level-up points resumes into the allocation screen.
    if (save.status === 'strand_event') {
      this.view = 'strand';
      this.openStrandEvent();
    } else {
      this.view = this.session.snapshot.pendingStatPoints > 0 ? 'levelup' : 'map';
      this.renderAll();
    }
  }

  /** Persist the run at a room boundary (combat itself is not persisted). */
  private persist(): void {
    void this.saves.save(this.session.toSave());
  }

  /** Picks one of the two room tracks for a room — deterministic per room id (a
   *  stable hash), so each room consistently plays one variant and walking the
   *  floor alternates them without re-triggering the same track. */
  private roomMusicKey(roomId: string): string {
    let h = 0;
    for (let i = 0; i < roomId.length; i++) h = (Math.imul(h, 31) + roomId.charCodeAt(i)) | 0;
    return (Math.abs(h) % 2) === 0 ? 'music_room_1' : 'music_room_2';
  }

  /** Plays the current room's ambient track (no-op if it's already playing). */
  private playRoomMusic(): void {
    playMusic(this, this.roomMusicKey(this.session.snapshot.currentRoomId));
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

    const pool: MutationDef[] = [];
    for (const mod of Object.values(mutationFiles)) {
      const res = parseMutationDef(mod.default);
      if (!res.ok) throw new Error(`RunSandbox: bad mutation content — ${res.error.message}`);
      pool.push(res.mutation);
    }
    this.mutationPool = pool;

    const items: ItemDef[] = [];
    for (const mod of Object.values(itemFiles)) {
      const res = parseItemDef(mod.default);
      if (!res.ok) throw new Error(`RunSandbox: bad item content — ${res.error.message}`);
      items.push(res.item);
    }
    this.itemPool = items;
  }

  /** (Re)starts the run on the current seed — everything is derived from it. */
  private startRun(): void {
    this.session = new RunSession({
      seed: this.seed, template: this.template, registry: this.enemyRegistry, finalFloor: FINAL_FLOOR,
      mutations: this.mutationPool, strandEventEveryNFloors: STRAND_INTERVAL, itemPool: this.itemPool,
    });
    this.narrator = new LaceNarrator(this.laceLines, makeRng(this.seed, 'events'));
    this.view = 'map';
    this.combat = null;
    this.targeting = null;
    this.enemiesKilled = 0;
    this.runStartMs = Date.now();
    this.runRecorded = false;
    this.lastRunShards = 0;
    this.say('run_start');
    this.playRoomMusic();
    this.persist();
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
    else if (this.view === 'strand') this.onStrandPointer(x, y);
    // The shop's stock rows + LEAVE button are interactive zones (their own
    // pointerdown handlers), so no positional dispatch is needed here.
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
    // Each non-boss room plays its own ambient track (boss combat swaps to
    // music_boss below). No-op if the new room maps to the same track.
    if (room.type !== 'boss') this.playRoomMusic();
    const encounter = this.session.beginEncounter();
    if (encounter === null) {
      // Non-combat rooms auto-clear. lace_event rooms are narrative beats — let
      // the companion speak. (loot/merchant/trap rooms are content stubs for now.)
      if (room.type === 'lace_event') this.say('generic');
      else if (room.type === 'merchant') this.openDispenser();
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
    // Save-on-action (T-114): the run is now mid-fight — persist the encounter so
    // a reload resumes it rather than re-entering the room.
    this.session.syncCombat(this.combat, this.combatRng.state);
    this.persist();
    this.renderAll();
  }

  /** Opens the interactive VEIN Dispenser (merchant room): a tappable shelf of
   *  4–6 items at floor-zoned prices (T-108/T-115b/T-116b). An empty shelf (no
   *  item pool / non-merchant) keeps the map view and just narrates. */
  private openDispenser(): void {
    if (this.session.dispenserStock().length === 0) {
      this.laceText.setText('LACE: The Dispenser is dark. Nothing on offer here.');
      return;
    }
    this.say('generic');
    this.view = 'shop';
  }

  /** Buys `item` from the Dispenser, then re-renders so the shelf + VEIN update. */
  private buyItem(item: ItemDef): void {
    if (!this.session.canAfford(item)) {
      this.laceText.setText(`LACE: ${item.name} costs ${this.session.dispenserPriceOf(item)} VEIN — you can't afford it.`);
      this.renderAll();
      return;
    }
    this.session.purchaseItem(item);
    playSfx(this, 'ui_click');
    this.laceText.setText(`LACE: Acquired ${item.name}. The Dispenser hums, satisfied.`);
    this.persist();
    this.renderAll();
  }

  /** Leaves the Dispenser, returning to the floor map. */
  private leaveDispenser(): void {
    this.view = 'map';
    this.renderAll();
  }

  /** Spends one pending level-up point on `stat` (GDD §4.3). When the last point
   *  is spent, returns to the map; persists so the allocation survives a reload. */
  private allocateStat(stat: keyof EntityStats): void {
    if (this.session.snapshot.pendingStatPoints <= 0) return;
    this.session.allocateStatPoint(stat);
    playSfx(this, 'ui_click');
    this.persist();
    if (this.session.snapshot.pendingStatPoints === 0) this.view = 'map';
    this.renderAll();
  }

  /** Advance to the next floor after a boss clear. */
  private descendFloor(): void {
    this.session.descend();
    this.say('floor_enter');
    playSfx(this, 'sfx_descend');
    this.persist();
    this.renderAll();
  }

  // ── Strand Event (GDD §5) ─────────────────────────────────────────────────

  /** Opens the Strand Event view for the current floor (card draw or intermission). */
  private openStrandEvent(): void {
    const outcome = this.session.beginStrandEvent();
    this.strandSelected = null;
    this.strandRerollUsed = false;
    this.view = 'strand';
    // Intro: LACE's saturation/strand commentary (generic pool).
    if (outcome.kind === 'intermission') {
      this.laceText.setText('LACE: You are saturated. The VEIN offers crystals instead — a consolation it does not believe in.');
    } else {
      this.say('generic');
    }
    this.persist();
    this.renderAll();
  }

  private onStrandPointer(x: number, y: number): void {
    const cards = this.session.strandOffer;
    if (cards.length === 0) return; // intermission — only the CONTINUE button acts
    for (let i = 0; i < cards.length; i++) {
      const r = this.strandCardRect(i);
      if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) {
        this.strandSelected = i;
        this.laceText.setText(`LACE: ${cards[i]!.mutation.lace}`); // the card's own commentary
        this.renderAll();
        return;
      }
    }
  }

  /** Take the selected card: apply its mutation, then drop to floor_complete. */
  private takeStrandCard(): void {
    if (this.strandSelected === null) return;
    const card = this.session.strandOffer[this.strandSelected];
    if (card === undefined) return;
    this.session.chooseStrandMutation(card.mutation.id);
    playSfx(this, 'sfx_mutation');
    this.laceText.setText(`LACE: ${card.mutation.lace}`); // the applied mutation speaks
    this.view = 'map';
    this.persist();
    this.renderAll();
  }

  /** Reroll the selected card (one per Strand Event). */
  private rerollStrandCard(): void {
    if (this.strandSelected === null || this.strandRerollUsed) return;
    this.session.rerollStrandCard(this.strandSelected);
    this.strandRerollUsed = true;
    const card = this.session.strandOffer[this.strandSelected];
    if (card !== undefined) this.laceText.setText(`LACE: ${card.mutation.lace}`);
    this.renderAll();
  }

  /** Acknowledge a VEIN Intermission: bank the crystals and move on. */
  private continueIntermission(): void {
    this.session.acceptIntermission();
    this.view = 'map';
    this.persist();
    this.renderAll();
  }

  private onCombatPointer(x: number, y: number): void {
    const state = this.combat;
    if (state === null || state.phase !== 'player') return;
    const tile = this.tileSize(state);
    const col = Math.floor((x - this.gridX(state)) / tile);
    const row = Math.floor((y - STAGE_Y) / tile);
    if (col < 0 || col >= state.grid.width || row < 0 || row >= state.grid.height) return;

    // Ability/item targeting takes over the tap while something is selected.
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

  // ── Abilities ───────────────────────────────────────────────────────────────

  /** Tap on an ability button: toggle targeting, or fire immediately if self-cast. */
  private onAbilityButton(slot: AbilitySlot): void {
    const state = this.combat;
    if (state === null || state.phase !== 'player') return;
    if (slot.cooldownRemaining > 0 || state.player.ap < slot.def.apCost) return; // not usable
    if (this.targeting?.kind === 'ability' && this.targeting.slot.def.id === slot.def.id) {
      this.targeting = null; this.renderAll(); return; // toggle off
    }
    if (slot.def.targetType === 'self') {
      this.targeting = null;
      this.combatAction({ type: 'useAbility', abilityId: slot.def.id });
      return;
    }
    this.targeting = { kind: 'ability', slot };
    this.renderAll();
  }

  /** Tap on a consumable button: heals fire immediately, grenades enter tile targeting. */
  private onItemButton(item: ItemDef): void {
    const state = this.combat;
    if (state === null || state.phase !== 'player' || state.player.ap < 1) return;
    if (this.targeting?.kind === 'item' && this.targeting.item.id === item.id) {
      this.targeting = null; this.renderAll(); return; // toggle off
    }
    if (item.effect?.kind === 'heal') {
      this.targeting = null;
      this.combatAction({ type: 'useItem', itemId: item.id });
      return;
    }
    this.targeting = { kind: 'item', item }; // damage / status grenades need a tile
    this.renderAll();
  }

  /** Tap on the grid while targeting: resolve the selected ability/item. */
  private onTargetTile(col: number, row: number): void {
    const state = this.combat;
    const target = this.targeting;
    if (state === null || target === null) return;

    if (target.kind === 'item') {
      // Grenades target any in-bounds tile (already bounds-checked by the caller).
      this.targeting = null;
      this.combatAction({ type: 'useItem', itemId: target.item.id, targetPos: { x: col, y: row } });
      return;
    }

    const def = target.slot.def;
    if (chebyshev(state.player.pos, { x: col, y: row }) > def.range) return; // out of range — stay targeting
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
      // Save-on-action (T-114): persist every turn while the fight continues
      // (maybeEndCombat already persists/clears on a terminal result).
      if (this.combat !== null) this.persist();
    }
    this.renderAll();
  }

  private reactToCombatEffects(effects: readonly Effect[]): void {
    let playerHurt = false;
    for (const fx of effects) {
      if (fx.type === 'entityDied' && fx.entityId !== 'player') {
        this.enemiesKilled += 1; // lifetime-stat tracking for the run-end profile
        this.say('enemy_killed');
        playSfx(this, 'sfx_enemy_death');
      }
      if (fx.type === 'damageDealt' && fx.targetId === 'player') playerHurt = true;
      const line = this.describeEffect(fx);
      if (line !== null) this.pushLog(line);
    }
    if (playerHurt) playSfx(this, 'sfx_player_hurt'); // once per resolution, not per hit
  }

  /** Readable label for an entity id (`player` or `enemyDefId#n`): names the
   *  organism and its tier so a tester can tell who is who. */
  private entityLabel(id: string): string {
    if (id === 'player') return 'YOU';
    const defId = id.split('#')[0] ?? id;
    const def = this.enemyRegistry.get(defId);
    return def ? `${def.name} [${def.tier}]` : id;
  }

  /** One plain-English log line for a combat effect, or null to skip noise. */
  private describeEffect(fx: Effect): string | null {
    switch (fx.type) {
      case 'damageDealt':
        return `${this.entityLabel(fx.targetId)} takes ${fx.amount} ${fx.damageType}${fx.isCrit ? ' (CRIT)' : ''}`;
      case 'healingApplied':
        return `${this.entityLabel(fx.targetId)} heals ${fx.amount}`;
      case 'entityDied':
        return `${this.entityLabel(fx.entityId)} is destroyed`;
      case 'statusApplied':
        return `${this.entityLabel(fx.targetId)} gains ${fx.status} (${fx.turns}t)`;
      case 'statusExpired':
        return `${this.entityLabel(fx.targetId)}'s ${fx.status} fades`;
      case 'abilityUsed':
        return `${this.entityLabel(fx.entityId)} uses ${fx.abilityId}`;
      case 'itemUsed': {
        const used = this.combat?.player.items.find((it) => it.id === fx.itemId);
        const name = used?.name ?? fx.itemId;
        return used ? `YOU use ${name} — ${RunSandboxScene.itemSummary(used)}` : `YOU use ${name}`;
      }
      case 'entityMoved':
        // Label every actor's movement (incl. enemy-phase), with from→to tiles.
        return `${this.entityLabel(fx.entityId)} moves (${fx.from.x},${fx.from.y})→(${fx.to.x},${fx.to.y})`;
      case 'phaseChanged':
        return fx.to === 'enemy' ? '— enemy phase —' : '— your turn —';
      default:
        return null; // apSpent, telegraph, floorComplete/victory/defeat: not log noise
    }
  }

  /** Appends an event to the rolling combat log (keeps the last 6). */
  private pushLog(line: string): void {
    this.logLines.push(line);
    while (this.logLines.length > 6) this.logLines.shift();
  }

  /** Rebuilds the combat-log text: a live enemy roster + recent events, so a
   *  tester always sees what's on the board and what just happened. */
  private refreshCombatLog(state: RunState): void {
    const counts = new Map<string, number>();
    for (const e of state.enemies) {
      if (e.hp <= 0) continue;
      const def = this.enemyRegistry.get(e.enemyDefId);
      const key = def ? `${def.name} [${def.tier}]` : e.enemyDefId;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    const roster = counts.size === 0
      ? 'enemies: none'
      : 'enemies: ' + [...counts].map(([k, n]) => (n > 1 ? `${n}× ${k}` : k)).join(', ');
    // Legend of the tile types actually present on this board, so a tester can
    // decode what they're looking at (sprites/colours alone aren't self-evident).
    const tileKinds = [...new Set(state.grid.tiles)].filter((t) => t !== 'open');
    const legend = tileKinds.length === 0 ? '' : `tiles: ${tileKinds.join(', ')}`;
    const lines = [
      `— turn ${state.turn} · ${state.phase} —`,
      roster,
      ...(legend ? [legend] : []),
      ...this.logLines.map((l) => `• ${l}`),
    ];
    this.combatLog.setText(lines.join('\n'));
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
      playMusic(this, 'music_menu'); // run over → the calm menu/results track
      this.view = 'over';
      this.recordRun(false);
      void this.saves.clear(); // run over — discard the save
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
      if (wasBoss) this.playRoomMusic(); // leave the boss track for the room track
      this.view = 'map';
      this.persist();
    } else {
      this.say(wasBoss ? 'boss_killed' : 'room_cleared');
      if (wasBoss) this.playRoomMusic();
      this.view = 'map';
      this.persist();
    }

    // A kill may have granted level-up points (GDD §4.3). Surface the allocation
    // screen now, unless the run already ended (victory/defeat keep their view).
    if (this.view === 'map' && this.session.snapshot.pendingStatPoints > 0) {
      this.view = 'levelup';
    }
  }

  /** Folds the finished run into the persistent profile (T-113/T-114b): banks
   *  Shard Crystals from the run's VEIN income at the T-107 rate, plus lifetime
   *  stats, and persists the profile. Idempotent per run via {@link runRecorded}. */
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
    this.combatLog.setVisible(false); // combat-only overlay
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
      // Coloured disc encodes state (cleared/boss/start/current); the room-type
      // icon sits on top — a sprite if present, else a letter label.
      this.stage.fillStyle(fill).fillCircle(p.x, p.y, 14);

      if (adjacent.has(room.id)) this.stage.lineStyle(3, H.adj).strokeCircle(p.x, p.y, 17);
      if (isCurrent) this.stage.lineStyle(3, H.current).strokeCircle(p.x, p.y, 20);

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
  }

  private tileSize(state: RunState): number {
    return Math.floor(GRID_PX / Math.max(state.grid.width, state.grid.height));
  }

  private gridX(state: RunState): number {
    return Math.floor((W - this.tileSize(state) * state.grid.width) / 2);
  }

  /** Draw a sprite (or its manifest fallback) and register it for per-frame cleanup. */
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
        // Sprite if present, else the manifest fallback colour (the old look).
        this.sprite(tileSpriteKey(t), px + tile / 2, py + tile / 2, tile);
        this.stage.lineStyle(1, H.tileBorder).strokeRect(px, py, tile, tile);
      }
    }

    const drawHp = (cx: number, cy: number, frac: number, color: number): void => {
      this.topGfx.fillStyle(H.hpBg).fillRect(cx - tile / 2 + 2, cy - tile / 2 + 2, tile - 4, 3);
      if (frac > 0) this.topGfx.fillStyle(color).fillRect(cx - tile / 2 + 2, cy - tile / 2 + 2, Math.round((tile - 4) * frac), 3);
    };

    // Small name/HP label above an entity; pushed to `transient` (cleared each render).
    const addLabel = (cx: number, topY: number, text: string, color: string): void => {
      const t = this.add.text(cx, topY - 2, text, {
        fontFamily: 'monospace', fontSize: '9px', align: 'center', color,
      }).setOrigin(0.5, 1).setDepth(2);
      this.transient.push(t);
    };

    for (const e of state.enemies) {
      const cx = gx + e.pos.x * tile + tile / 2;
      const cy = STAGE_Y + e.pos.y * tile + tile / 2;
      if (e.hp <= 0) { this.sprite(e.enemyDefId, cx, cy, tile * 0.9, H.dead); continue; }
      this.sprite(e.enemyDefId, cx, cy, tile * 0.92);
      drawHp(cx, cy, e.hp / e.maxHp, H.hpRed);
      // Tester label: which organism is this, what tier, and its current HP.
      const def = this.enemyRegistry.get(e.enemyDefId);
      const name = def ? `${def.name} [${def.tier}]` : e.enemyDefId;
      addLabel(cx, STAGE_Y + e.pos.y * tile, `${name}\n${e.hp}/${e.maxHp}`, def?.tier === 'boss' ? C.red : C.yellow);
    }

    // Targeting overlay: tint valid target tiles. Abilities are range-limited;
    // items (grenades) can target any tile.
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
    drawHp(pcx, pcy, pp.hp / pp.maxHp, H.hpGreen);
    addLabel(pcx, STAGE_Y + pp.pos.y * tile, `YOU\n${pp.hp}/${pp.maxHp}`, C.green);

    this.combatLog.setVisible(true);
    this.refreshCombatLog(state);
  }

  /** Ability buttons below the grid; tap to target (or self-cast). */
  private renderAbilityBar(): void {
    const state = this.combat;
    if (state === null || state.phase !== 'player') return;

    // Fit every ability button within the screen width — a fixed stride pushed
    // the 3rd+ ability (granted by a mutation) off the right edge. Width scales
    // with the count (up to the GDD's 6 slots) so they all stay on-screen + tappable.
    const n = state.player.abilities.length;
    if (n === 0) return;
    const margin = 16;
    const gap = 6;
    const btnW = Math.floor((W - 2 * margin - (n - 1) * gap) / n);
    // Tighten the label when buttons get narrow (many abilities).
    const fontSize = btnW >= 150 ? '10px' : btnW >= 95 ? '9px' : '8px';

    state.player.abilities.forEach((slot, i) => {
      const x = margin + i * (btnW + gap);
      const ready = slot.cooldownRemaining === 0 && state.player.ap >= slot.def.apCost;
      const active = this.targeting?.kind === 'ability' && this.targeting.slot.def.id === slot.def.id;
      const border = active ? 0xffdd44 : ready ? H.btnBrd : 0x2a3050;
      const color = active ? C.yellow : ready ? C.green : C.dim;

      this.stage.fillStyle(H.btnBg).fillRoundedRect(x, ABILITY_Y, btnW, 32, 6);
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

  /** Consumable buttons below the ability bar, plus the active-targeting hint. */
  private renderItemBar(): void {
    const state = this.combat;
    if (state === null || state.phase !== 'player') return;

    const items = state.player.items.filter((it) => it.category === 'consumable');
    items.slice(0, 3).forEach((item, i) => {
      const x = 20 + i * 118;
      const ready = state.player.ap >= 1;
      const active = this.targeting?.kind === 'item' && this.targeting.item.id === item.id;
      const border = active ? 0xffdd44 : ready ? H.btnBrd : 0x2a3050;
      const color = active ? C.yellow : ready ? C.green : C.dim;

      this.stage.fillStyle(H.btnBg).fillRoundedRect(x, ITEM_Y, 112, 28, 6);
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
        : `${this.targeting.item.name} (${RunSandboxScene.itemSummary(this.targeting.item)})`;
      const hint = this.add.text(W / 2, ITEM_Y + 38, `targeting ${what} — tap a target tile (tap again to cancel)`, {
        fontFamily: 'monospace', fontSize: '10px', color: C.yellow,
      }).setOrigin(0.5);
      this.transient.push(hint);
    }
  }

  // ── Level-up stat allocation (GDD §4.3) rendering ───────────────────────────

  /** Short description of what each allocatable stat does (GDD §4.1). */
  private static statBlurb(stat: keyof EntityStats): string {
    switch (stat) {
      case 'str': return 'melee damage';
      case 'res': return 'damage reduction';
      case 'agi': return 'move range + dodge';
      case 'int': return 'ability damage';
    }
  }

  /** Draws the level-up screen: the player's current stats as tappable rows.
   *  Tapping spends one pending point (+1 to that stat). Auto-closes to the map
   *  when no points remain (handled in {@link allocateStat}). */
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
      this.stage.lineStyle(1, H.btnBrd).strokeRoundedRect(x, y, w, rowH, 8);

      this.transient.push(
        this.add.text(x + 14, y + 12, stat.toUpperCase(), {
          fontFamily: 'monospace', fontSize: '14px', color: C.text,
        }),
        this.add.text(x + 14, y + 34, RunSandboxScene.statBlurb(stat), {
          fontFamily: 'monospace', fontSize: '9px', color: C.dim,
        }),
        this.add.text(x + w - 14, y + rowH / 2, `${stats[stat]}  +1`, {
          fontFamily: 'monospace', fontSize: '14px', color: C.green,
        }).setOrigin(1, 0.5),
      );

      const z = this.add.zone(x, y, w, rowH).setOrigin(0, 0).setInteractive({ useHandCursor: true });
      z.on('pointerdown', () => this.allocateStat(stat));
      this.buttonZones.push(z);
    });
  }

  // ── VEIN Dispenser (merchant) rendering ─────────────────────────────────────

  /** Draws the interactive shop: a header with the VEIN balance, then one
   *  tappable row per stocked item (name · rarity · price). Affordable rows are
   *  green and buyable; unaffordable rows are dimmed and inert. Sold items leave
   *  the shelf (RunSession.purchaseItem), so a re-render shrinks the list. */
  private renderShop(): void {
    const stock = this.session.dispenserStock();
    const vein = this.session.snapshot.veinCrystals;

    this.transient.push(
      this.add.text(W / 2, STAGE_Y + 12, 'VEIN DISPENSER', {
        fontFamily: 'monospace', fontSize: '14px', color: C.yellow,
      }).setOrigin(0.5, 0),
      this.add.text(W / 2, STAGE_Y + 34, `you hold ${vein} VEIN  ·  tap to buy`, {
        fontFamily: 'monospace', fontSize: '10px', color: C.dim,
      }).setOrigin(0.5, 0),
    );

    if (stock.length === 0) {
      this.transient.push(
        this.add.text(W / 2, STAGE_Y + 120, 'sold out', {
          fontFamily: 'monospace', fontSize: '12px', color: C.dim,
        }).setOrigin(0.5),
      );
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
      this.stage.lineStyle(1, afford ? H.btnBrd : H.edge).strokeRoundedRect(x, y, w, rowH, 8);

      this.transient.push(
        this.add.text(x + 12, y + 10, `${item.name}`, {
          fontFamily: 'monospace', fontSize: '12px', color: afford ? C.text : C.dim,
        }),
        this.add.text(x + 12, y + 30, `${item.category} · ${item.rarity}`, {
          fontFamily: 'monospace', fontSize: '9px', color: C.dim,
        }),
        this.add.text(x + w - 12, y + rowH / 2, `${price} VEIN`, {
          fontFamily: 'monospace', fontSize: '12px', color: afford ? C.green : C.red,
        }).setOrigin(1, 0.5),
      );

      if (afford) {
        const z = this.add.zone(x, y, w, rowH).setOrigin(0, 0).setInteractive({ useHandCursor: true });
        z.on('pointerdown', () => this.buyItem(item));
        this.buttonZones.push(z);
      }
    });
  }

  // ── Strand Event rendering ──────────────────────────────────────────────────

  private strandCardRect(i: number): { x: number; y: number; w: number; h: number } {
    return { x: 16, y: STAGE_Y + 28 + i * 128, w: W - 32, h: 116 };
  }

  private static modifierSummary(m: MutationDef): string {
    if (m.modifiers.length === 0) return '—';
    return m.modifiers
      .map((mod) =>
        mod.kind === 'stat' ? `+${mod.delta} ${mod.stat.toUpperCase()}`
        : mod.kind === 'maxHp' ? `+${mod.delta} HP`
        : `+${mod.delta} AP`,
      )
      .join(', ');
  }

  private static abilitySummary(m: MutationDef): string {
    return m.grantsAbility === null ? 'passive only' : `grants ${m.grantsAbility.id} (${m.grantsAbility.apCost} AP)`;
  }

  /** One-line effect summary for an item, so a tester knows what it does. */
  private static itemSummary(item: ItemDef): string {
    const e = item.effect;
    if (e === null) return item.category === 'consumable' ? 'no effect' : item.category;
    switch (e.kind) {
      case 'heal':
        return `heal ${e.amount}`;
      case 'damage':
        return `${e.amount} ${e.damageType} dmg${e.aoeRadius > 0 ? ` · AoE ${e.aoeRadius}` : ''}`;
      case 'applyStatus':
        return `${e.status} ${e.duration}t${e.aoeRadius > 0 ? ` · AoE ${e.aoeRadius}` : ''}`;
      default:
        return 'effect';
    }
  }

  private renderStrand(): void {
    const cards = this.session.strandOffer;

    // VEIN Intermission (player at the mutation cap): no cards, a VC payout.
    if (cards.length === 0) {
      this.stage.fillStyle(0x101830).fillRoundedRect(16, STAGE_Y + 40, W - 32, 150, 10);
      this.stage.lineStyle(1, 0xffdd44).strokeRoundedRect(16, STAGE_Y + 40, W - 32, 150, 10);
      this.transient.push(
        this.add.text(W / 2, STAGE_Y + 80, 'VEIN INTERMISSION', {
          fontFamily: 'monospace', fontSize: '16px', color: C.yellow,
        }).setOrigin(0.5),
        this.add.text(W / 2, STAGE_Y + 120, '+100 VEIN Crystals', {
          fontFamily: 'monospace', fontSize: '13px', color: C.green,
        }).setOrigin(0.5),
        this.add.text(W / 2, STAGE_Y + 150, '(saturated — 4 mutations held)', {
          fontFamily: 'monospace', fontSize: '10px', color: C.dim,
        }).setOrigin(0.5),
      );
      return;
    }

    this.transient.push(
      this.add.text(W / 2, STAGE_Y + 12, 'STRAND EVENT — choose one', {
        fontFamily: 'monospace', fontSize: '12px', color: C.green,
      }).setOrigin(0.5, 0),
    );

    cards.forEach((card, i) => {
      const r = this.strandCardRect(i);
      const m = card.mutation;
      const selected = this.strandSelected === i;
      this.stage.fillStyle(selected ? 0x16243c : 0x0e1626).fillRoundedRect(r.x, r.y, r.w, r.h, 8);
      this.stage.lineStyle(selected ? 2 : 1, selected ? 0xffdd44 : H.edge).strokeRoundedRect(r.x, r.y, r.w, r.h, 8);

      const wild = card.slot === 'wild' ? '  ·  WILD' : '';
      this.transient.push(
        this.add.text(r.x + 12, r.y + 10, `${m.family.toUpperCase()} · ${m.tier.toUpperCase()}${wild}`, {
          fontFamily: 'monospace', fontSize: '9px', color: C.dim,
        }),
        this.add.text(r.x + 12, r.y + 26, m.name, {
          fontFamily: 'monospace', fontSize: '14px', color: selected ? C.yellow : C.text,
        }),
        this.add.text(r.x + 12, r.y + 50, `Passive: ${RunSandboxScene.modifierSummary(m)}`, {
          fontFamily: 'monospace', fontSize: '10px', color: C.green,
        }),
        this.add.text(r.x + 12, r.y + 68, `Active:  ${RunSandboxScene.abilitySummary(m)}`, {
          fontFamily: 'monospace', fontSize: '10px', color: C.green,
        }),
        this.add.text(r.x + 12, r.y + 90, `SIG +${m.sigBonus}`, {
          fontFamily: 'monospace', fontSize: '10px', color: C.dim,
        }),
      );

      const z = this.add.zone(r.x, r.y, r.w, r.h).setOrigin(0, 0).setInteractive({ useHandCursor: true });
      z.on('pointerdown', () => this.onStrandPointer(r.x + 1, r.y + 1));
      this.buttonZones.push(z);
    });
  }

  private renderOver(): void {
    const status = this.session.snapshot.status;
    this.overlay.fillStyle(0x000000, 0.6).fillRect(0, STAGE_Y, W, STAGE_H);
    const label = status === 'victory' ? 'VICTORY' : 'DEFEAT';
    const cy = STAGE_Y + STAGE_H / 2;
    this.transient.push(
      this.add.text(W / 2, cy - 40, label, {
        fontFamily: 'monospace', fontSize: '30px', color: status === 'victory' ? C.yellow : C.red,
        stroke: '#000000', strokeThickness: 4,
      }).setOrigin(0.5),
      // Run-end Shard payout (T-114b) + the persistent balance it banked into.
      this.add.text(W / 2, cy + 8, `+${this.lastRunShards.toFixed(2)} Shards earned`, {
        fontFamily: 'monospace', fontSize: '13px', color: C.green,
      }).setOrigin(0.5),
      this.add.text(W / 2, cy + 30, `Shard balance: ${this.meta.shardCrystals.toFixed(2)}`, {
        fontFamily: 'monospace', fontSize: '11px', color: C.dim,
      }).setOrigin(0.5),
    );
  }

  // ── Buttons ─────────────────────────────────────────────────────────────────

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
      // End Turn is always available during the player phase — it does NOT
      // require spending all AP.
      if (this.combat?.phase === 'player') {
        this.button(20, 'END TURN', C.green, () => this.combatAction({ type: 'endTurn' }));
      }
      return;
    }
    if (this.view === 'shop') {
      this.button(20, 'LEAVE', C.green, () => this.leaveDispenser());
      return;
    }
    // Level-up: no bottom buttons — you must spend every pending point (tap a
    // stat row); the screen auto-closes to the map when the last point is spent.
    if (this.view === 'levelup') return;
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
    z.on('pointerdown', () => { playSfx(this, 'ui_click'); onTap(); });
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
    const muts = snap.player.mutations.length;
    this.hudText.setText([
      `Floor ${snap.floorNumber}/${FINAL_FLOOR}    ${this.view.toUpperCase()}    ${snap.status}`,
      `HP ${here.hp}/${here.maxHp}${combatInfo}    SIG ${snap.sig}/40    MUT ${muts}/4`,
      `Room ${snap.currentRoomId} (${this.session.currentRoom().type})   seed 0x${this.seed.toString(16).padStart(8, '0')}`,
    ]);
  }

  private roomById(id: string): PopulatedRoom {
    const room = this.session.floor.rooms.find((r) => r.id === id);
    if (room === undefined) throw new Error(`RunSandbox: no room ${id}`);
    return room;
  }
}
