import Phaser from 'phaser';
import type { EnemyDef } from '@shared-types/enemy';
import { isBossTier } from '@shared-types/enemy';
import { MAX_FLOOR } from '@shared-types/campaign';
import type { FloorTemplate } from '@shared-types/floor-template';
import type { PopulatedRoom } from '@shared-types/floor-plan';
import type { RunState } from '@shared-types/run-state';
import type { Action } from '@shared-types/action';
import type { AbilitySlot } from '@shared-types/ability';
import type { ItemDef } from '@shared-types/item';
import type { EntityStats, DeathCause, StatusEffect } from '@shared-types/run-state';
import type { MetaState } from '@shared-types/meta-state';
import type { MutationDef, MutationFamily } from '@shared-types/mutation';
import { dominantTraitFor, unlockedSynergies } from '../core/mutation';
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
import { getStorageAdapter } from '../platform/storage';
import { adService } from '../platform/ads-bootstrap';
import { LaceNarrator } from '../core/lace';
import type { RunSummaryData } from './PostRunScene';
import { computeBounds, computeLayout, project } from './floor-graph-layout';
import type { Viewport } from './floor-graph-layout';
import { computeFogReveal, edgeVisible } from './map-fog';
import { floorProgress, compactMinimapRect } from './minimap';
import { roomGlyph } from './room-glyph';
import { pickEvent, resolveEvent, type EventOutcome } from './event-room';
import { rarityLook, rarityGlows } from './loot-reveal';
import { affordLabel } from './merchant';
import { reachableMoves, attackPreview, showMoveConfirmHint } from './combat-preview';
import { FAMILY_LOOK, TIER_LOOK, showStrandConfirmHint, familyCountIn } from './strand-event';
import { isInVision, fogAlpha } from './combat-fog';
import { threatenedTiles, enemyInReach } from './combat-threat';
import { statusBadges, statusHex } from './combat-status';
import { queueSpriteLoads, drawSprite } from './sprites/sprite-registry';
import { roomSpriteKey, tileSpriteKey } from './sprites/sprite-manifest';
import { queueAudioLoads, playSfx, playMusic, getCategoryVolume, setCategoryVolume } from './audio/audio-registry';
import { logEvent } from '../core/platform/analytics-adapter';
import { wardenPreLine, wardenPostLine } from '../core/lace/warden-lines';
import type { OriginDef } from '@shared-types/origin';
import { parseOriginDef } from '../core/content/origin-loader';
import { applyOriginPerk, newRunPlayer } from '../core/run/start-player';
import type { SigmaStrainDef } from '@shared-types/sigma-strain';
import type { DamageType, PlayerState } from '@shared-types/run-state';
import { parseSigmaStrainDef } from '../core/content/sigma-strain-loader';
import { aggregateStrainFx, applyStrainFxToPlayer, ZERO_STRAIN_FX, type StrainFx } from '../core/strains';
import { applyMutation } from '../core/mutation';
import type { SessionStrainFx } from '../core/run/run-session-types';
import { parseCodexEntries } from '../core/content/codex-loader';
import { parsePrefixTable, parseTraitTable, parseSuffixTable } from '../core/name-gen/name-tables';
import { generateOrganismName, type NameTables } from '../core/name-gen/name-gen';

import laceCore from '@content/lace-lines/core.json';
import prefixesJson from '@content/organism-names/prefixes.json';
import traitsJson from '@content/organism-names/traits.json';
import suffixesJson from '@content/organism-names/suffixes.json';
// eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-assignment
const enemyModules = import.meta.glob('../../../../packages/content/enemies/*.json', { eager: true });
const enemyFiles = enemyModules as Record<string, { readonly default: unknown }>;
// eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-assignment
const floorModules = import.meta.glob('../../../../packages/content/floors/*.json', { eager: true });
const floorFiles = floorModules as Record<string, { readonly default: unknown }>;
// eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-assignment
const mutationModules = import.meta.glob('../../../../packages/content/mutations/*.json', { eager: true });
const mutationFiles = mutationModules as Record<string, { readonly default: unknown }>;
// eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-assignment
const itemModules = import.meta.glob('../../../../packages/content/items/*.json', { eager: true });
// eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-assignment
const originModules = import.meta.glob('../../../../packages/content/origins/*.json', { eager: true });
const originFiles = originModules as Record<string, { readonly default: unknown }>;
// eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-assignment
const strainModules = import.meta.glob('../../../../packages/content/sigma-strains/*.json', { eager: true });
const strainFiles = strainModules as Record<string, { readonly default: unknown }>;
// eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-assignment
const codexModules = import.meta.glob('../../../../packages/content/codex/*.json', { eager: true });
const codexFiles = codexModules as Record<string, { readonly default: unknown }>;
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
  fog: 0x0e1626, fogEdge: 0x32465f,
  tileBg: 0x0d1220, tileBorder: 0x1e2a40, hazard: 0x4a2030,
  player: 0xa0ffdc, enemy: 0xff6644, dead: 0x1c1c2e, hpBg: 0x333344, hpGreen: 0x44ff88, hpRed: 0xff3333,
  btnBg: 0x1a3028, btnBrd: 0xa0ffdc,
};

const FINAL_FLOOR = MAX_FLOOR; // canonical campaign shape (T-523)
const STRAND_INTERVAL = 5;

type View = 'map' | 'combat' | 'strand' | 'shop' | 'levelup' | 'loot' | 'swap' | 'inventory' | 'event' | 'safe';

/**
 * S040+ Production game scene — T-161.
 *
 * The player-facing run loop. Receives { meta, originId, seed } from
 * FloorTransitionScene; the full 20-floor descent plays out here.
 *
 * The production scene: no dev tab bar, no debug overlays, proper game-over
 * routing back to HubScene, seed sourced from RunPreviewScene.
 *
 * S040 enemy reveal (T-161): on combat entry, enemies fade in one-by-one
 * (staggered 150ms each) before handing control to the player.
 */
export class GameScene extends Phaser.Scene {
  private session!: RunSession;
  private narrator!: LaceNarrator;
  private enemyRegistry!: ReadonlyMap<string, EnemyDef>;
  private template!: FloorTemplate;
  private floorTemplates: ReadonlyMap<number, FloorTemplate> = new Map();
  private laceLines: readonly LaceLine[] = [];
  private mutationPool: readonly MutationDef[] = [];
  private itemPool: readonly ItemDef[] = [];
  private origins: OriginDef[] = [];
  /** The Sigma Strain catalog (T-306) — unlock milestones + run-start effects. */
  private strainPool: SigmaStrainDef[] = [];
  /** The profile's aggregated strain effects, recomputed at every run start. */
  private strainFx: StrainFx = ZERO_STRAIN_FX;
  /** Kills this run per enemy basic-attack damage type (strain counters, T-306). */
  private killsByType: Partial<Record<DamageType, number>> = {};
  /** Damage type of the most recent hit on the player — attributes deaths. */
  private lastPlayerHitType: DamageType | null = null;
  /** Xenobiologist Origin (T-307): out-of-vision enemies render with readouts. */
  private hpRevealActive = false;

  private strandSelected: number | null = null;
  private strandRerollUsed = false;
  /** T-185: whether the player has tapped TAKE once and is awaiting the second confirm tap. */
  private strandConfirmPending = false;
  /** T-182/T-188: which cards to animate in on next renderStrand ('all' = all, number = one slot, null = none). */
  private strandAnimateCards: 'all' | number | null = null;
  /** T-191: families that just earned a Dominant Trait — triggers the celebration overlay. */
  private dominantTraitReveal: MutationFamily[] = [];
  /** T-181: whether the S060 not-skippable Strand Event intro has played this run. */
  private strandIntroShown = false;

  private seed = 0;
  private originId = 'void_diver';
  private saves!: SaveManager<RunSessionSave>;
  private metaSaves!: SaveManager<MetaState>;
  private meta: MetaState = newMetaState();
  private enemiesKilled = 0;
  private damageTakenThisRun = 0;
  private nameTables: NameTables | null = null;
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
  /** A save passed in by the boot S100 modal or the Hub's Continue Descent
   *  card (T-510) — when present, create() resumes it instead of starting fresh. */
  private resumeSave: RunSessionSave | null = null;

  private view: View = 'map';
  /** T-175: current ability bar page (0-indexed); page N shows slots N×6 … N×6+5. */
  private abilityPage = 0;
  /** T-155: when true the expanded full-floor map overlay is showing (read-only). */
  private mapOverlayOpen = false;
  /** T-176: set once an Event Room choice is made — drives the resolved-outcome panel. */
  private eventOutcome: EventOutcome | null = null;
  /** T-177: true once the one-per-visit ad refresh has been used at this Dispenser. */
  private shopAdRefreshUsed = false;
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
  /** S049/T-170: true while the enemy phase is animating beat-by-beat. */
  private enemySeqActive = false;
  /** T-170: enemy-phase playback speed — 1 normally, 2 after a fast-forward tap. */
  private enemySeqSpeed = 1;
  /** S047: whether the in-combat pause menu is open. */
  private combatMenuOpen = false;
  /** S047: whether the player has already confirmed once for surrender (double-confirm). */
  private surrenderConfirmPending = false;
  /** T-168: which sub-panel is showing inside the combat menu (null = root). */
  private combatMenuPanel: 'settings' | null = null;
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
    this.resumeSave = (data['resumeSave'] as RunSessionSave | undefined) ?? null;
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

    const adapter = getStorageAdapter();
    this.saves = new SaveManager(adapter, runSessionCodec);
    this.metaSaves = new SaveManager(adapter, metaCodec, 'helix.meta');

    this.loadContent();
    if (this.pendingRevive) {
      void this.resumeWithRevive();
    } else if (this.resumeSave !== null) {
      this.resumeFromSave(this.resumeSave);
    } else {
      this.startRun();
    }
  }

  // ── Content loading ────────────────────────────────────────────────────────

  private loadContent(): void {
    const defs: EnemyDef[] = [];
    for (const mod of Object.values(enemyFiles)) {
      const res = parseEnemyDef(mod.default);
      if (!res.ok) throw new Error(`GameScene: bad enemy content — ${res.error.message}`);
      defs.push(res.enemy);
    }
    this.enemyRegistry = buildEnemyRegistry(defs);

    // One template per floor (zones 1–4). Floors without a shipped template fall
    // back to the floor-1 template inside RunSession.
    const byFloor = new Map<number, FloorTemplate>();
    for (const mod of Object.values(floorFiles)) {
      const res = parseFloorTemplate(mod.default);
      if (!res.ok) throw new Error(`GameScene: bad floor content — ${res.error.message}`);
      byFloor.set(res.template.floor, res.template);
    }
    this.floorTemplates = byFloor;
    const floor1 = byFloor.get(1);
    if (floor1 === undefined) throw new Error('GameScene: missing floor 1 template');
    this.template = floor1;

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

    const prefixes = parsePrefixTable(prefixesJson);
    if (!prefixes.ok) throw new Error(`GameScene: bad organism-names/prefixes.json — ${prefixes.error.message}`);
    const traits = parseTraitTable(traitsJson);
    if (!traits.ok) throw new Error(`GameScene: bad organism-names/traits.json — ${traits.error.message}`);
    const suffixes = parseSuffixTable(suffixesJson);
    if (!suffixes.ok) throw new Error(`GameScene: bad organism-names/suffixes.json — ${suffixes.error.message}`);
    this.nameTables = { prefixes: prefixes.prefixes, traits: traits.traits, suffixes: suffixes.suffixes };

    // Origins (T-301): parsed defs drive both the run's perk and the save's
    // originId resolution on resume.
    this.origins = Object.values(originFiles).flatMap((mod) => {
      const res = parseOriginDef(mod.default);
      if (!res.ok) throw new Error(`GameScene: bad origin content — ${res.error.message}`);
      return [res.origin];
    });

    // Sigma Strains (T-306): the meta-progression catalog. Unlocks fold in at
    // run end (recordRunOutcome); effects apply at run start (startRun).
    this.strainPool = Object.values(strainFiles).flatMap((mod) => {
      const res = parseSigmaStrainDef(mod.default);
      if (!res.ok) throw new Error(`GameScene: bad sigma-strain content — ${res.error.message}`);
      return [res.strain];
    });
  }

  // ── Run lifecycle ─────────────────────────────────────────────────────────

  /** The slice of the aggregated strain effects the RunSession consumes (T-306). */
  private sessionStrainFx(): SessionStrainFx {
    return {
      veinBonusPercent: this.strainFx.veinBonusPercent,
      startingVein: this.strainFx.startingVein,
      extraWildCard: this.strainFx.extraWildCard,
      firstCardMatchesLastFamily: this.strainFx.firstCardMatchesLastFamily,
    };
  }

  /** The Archivist Origin (T-307): a fresh run begins with `count` undiscovered
   *  Codex entries revealed. Seeded-random over the locked set, folded straight
   *  into the profile (the Codex is meta-progression, GDD §2.7). */
  private grantCodexHeadStart(origin: OriginDef | undefined): void {
    if (origin?.perk.kind !== 'codexHeadStart') return;
    const discovered = new Set(this.meta.codexEntryIds);
    const locked = Object.values(codexFiles).flatMap((mod) => {
      const res = parseCodexEntries(mod.default);
      return res.ok ? res.entries.filter((e) => !discovered.has(e.id)).map((e) => e.id) : [];
    });
    if (locked.length === 0) return; // everything already found
    const rng = makeRng(this.seed, 'codexgrant');
    const granted: string[] = [];
    for (let i = 0; i < origin.perk.count && locked.length > 0; i++) {
      granted.push(...locked.splice(rng.nextInt(locked.length), 1));
    }
    this.meta = { ...this.meta, codexEntryIds: [...this.meta.codexEntryIds, ...granted] };
    void this.metaSaves.save(this.meta);
  }

  /** Convergence Echo (T-306): carry one seeded-random mutation from the last
   *  run into this one. No SIG accrual — the strain is a memory, not a pick. */
  private applyCarriedMutation(player: PlayerState): PlayerState {
    if (!this.strainFx.carryMutation || this.meta.lastRunMutationIds.length === 0) return player;
    const rng = makeRng(this.seed, 'straincarry');
    const id = this.meta.lastRunMutationIds[rng.nextInt(this.meta.lastRunMutationIds.length)];
    const def = this.mutationPool.find((m) => m.id === id);
    return def === undefined ? player : applyMutation(player, def);
  }

  /** Advances the per-damage-type kill tally for the strain counters (T-306). */
  private tallyKillByType(entityId: string): void {
    const enemy = this.combat?.enemies.find((e) => e.id === entityId);
    const def = enemy !== undefined ? this.enemyRegistry.get(enemy.enemyDefId) : undefined;
    if (def !== undefined) {
      this.killsByType[def.damageType] = (this.killsByType[def.damageType] ?? 0) + 1;
    }
  }

  private startRun(): void {
    const origin = this.origins.find((o) => o.id === this.originId);
    this.hpRevealActive = origin?.perk.kind === 'enemyHpReveal'; // T-307 Xenobiologist
    this.grantCodexHeadStart(origin); // T-307 The Archivist
    // Sigma Strains (T-306): aggregate the profile's unlocked effects, apply
    // the player-level ones (max-HP nudge, typed resists), then — for
    // Convergence Echo — carry one seeded-random mutation from the last run.
    this.strainFx = aggregateStrainFx(this.strainPool, this.meta.sigmaStrainIds);
    let player = applyStrainFxToPlayer(
      origin !== undefined
        ? applyOriginPerk(newRunPlayer(), origin.perk, this.itemPool)
        : newRunPlayer(),
      this.strainFx,
    );
    player = this.applyCarriedMutation(player);
    this.session = new RunSession({
      seed: this.seed,
      template: this.template,
      floorTemplates: this.floorTemplates,
      registry: this.enemyRegistry,
      finalFloor: FINAL_FLOOR,
      mutations: this.mutationPool,
      strandEventEveryNFloors: STRAND_INTERVAL,
      itemPool: this.itemPool,
      player,
      ...(origin !== undefined ? { origin } : {}),
      strainFx: this.sessionStrainFx(),
    });
    this.narrator = new LaceNarrator(this.laceLines, makeRng(this.seed, 'events'));
    this.view = 'map';
    this.combat = null;
    this.targeting = null;
    this.enemiesKilled = 0;
    this.killsByType = {};
    this.lastPlayerHitType = null;
    this.damageTakenThisRun = 0;
    this.runStartMs = Date.now();
    this.runRecorded = false;
    this.lastRunShards = 0;
    this.deathCause = 'enemy_kill';
    this.achievementsEarned = [];
    this.reviveUsed = false;
    this.strandIntroShown = false;
    adService.reset(); // fresh per-run ad cap + cooldown (UFD E032)
    this.revealingEnemies = false;
    logEvent('run_start', {
      seed: this.seed,
      originId: this.originId,
      floorCount: FINAL_FLOOR,
      isTutorial: false,
    });
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
    const origin = this.origins.find((o) => o.id === result.value.originId);
    this.hpRevealActive = origin?.perk.kind === 'enemyHpReveal'; // T-307
    // T-306: session-level strain effects re-derive from the profile; the
    // player-level results already live on the saved player.
    this.strainFx = aggregateStrainFx(this.strainPool, this.meta.sigmaStrainIds);
    this.session = new RunSession({
      seed: this.seed,
      template: this.template,
      floorTemplates: this.floorTemplates,
      registry: this.enemyRegistry,
      finalFloor: FINAL_FLOOR,
      mutations: this.mutationPool,
      strandEventEveryNFloors: STRAND_INTERVAL,
      itemPool: this.itemPool,
      ...(origin !== undefined ? { origin } : {}),
      strainFx: this.sessionStrainFx(),
    });
    this.session.applySave(result.value);
    this.session.revive();
    this.persist();
    this.narrator = new LaceNarrator(this.laceLines, makeRng(this.seed, 'events'));
    this.view = 'map';
    this.combat = null;
    this.targeting = null;
    this.enemiesKilled = 0;
    this.killsByType = {};
    this.lastPlayerHitType = null;
    this.damageTakenThisRun = 0;
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

  /**
   * T-510: resume a saved run handed over by the boot S100 modal or the Hub's
   * "Continue Descent" card (DR-009). A checkpointed save descends immediately —
   * the resume lands at a fresh floor entrance, never replays the cleared act
   * end. A mid-fight save (v5+) re-enters combat with its exact RNG state;
   * a mid-floor save resumes exploring at the saved room.
   */
  private resumeFromSave(save: RunSessionSave): void {
    this.seed = save.seed; // narration/music keys derive from the run's seed
    // T-301: session-level Origin perks (draw affinity, zone VEIN bonus)
    // resolve from the saved originId; player-level perk results already
    // live on the saved player.
    const origin = this.origins.find((o) => o.id === save.originId);
    this.hpRevealActive = origin?.perk.kind === 'enemyHpReveal'; // T-307
    // T-306: session-level strain effects re-derive from the profile; the
    // player-level results already live on the saved player.
    this.strainFx = aggregateStrainFx(this.strainPool, this.meta.sigmaStrainIds);
    this.session = new RunSession({
      seed: save.seed,
      template: this.template,
      floorTemplates: this.floorTemplates,
      registry: this.enemyRegistry,
      finalFloor: FINAL_FLOOR,
      mutations: this.mutationPool,
      strandEventEveryNFloors: STRAND_INTERVAL,
      itemPool: this.itemPool,
      ...(origin !== undefined ? { origin } : {}),
      strainFx: this.sessionStrainFx(),
    });
    this.session.applySave(save);
    this.narrator = new LaceNarrator(this.laceLines, makeRng(this.seed, 'events'));
    this.view = 'map';
    this.combat = null;
    this.targeting = null;
    this.enemiesKilled = 0;
    this.killsByType = {};
    this.lastPlayerHitType = null;
    this.damageTakenThisRun = 0;
    this.runStartMs = Date.now();
    this.runRecorded = false;
    this.lastRunShards = 0;
    this.deathCause = 'enemy_kill';
    this.achievementsEarned = [];
    this.reviveUsed = false;
    this.strandIntroShown = true; // a resumed run has seen its intro beats
    this.revealingEnemies = false;

    const checkpoint = this.session.checkpoint();
    if (checkpoint !== null && this.session.snapshot.status === 'floor_complete') {
      // Continue Descent: consume the checkpoint and land on the next floor's
      // entrance (UFD 02 S017 / S029).
      this.session.descend();
      const hours = save.suspendedAtMs !== undefined
        ? (Date.now() - save.suspendedAtMs) / 3_600_000
        : 0;
      logEvent('descent_resumed', {
        actN: checkpoint.act + 1,
        hoursSinceSuspend: Math.round(hours * 100) / 100,
      });
      this.narrator.signalMood('new_floor');
      if (this.session.snapshot.floorNumber >= 16) this.narrator.signalMood('deep_floor');
    } else {
      const ac = this.session.activeCombat();
      if (ac !== null) {
        // Mid-fight save (T-114): re-enter the encounter at its exact RNG state.
        this.combat = ac.state;
        this.combatRng = makeRng(ac.state.seed, 'combat');
        this.combatRng.state = ac.rngState >>> 0;
        this.view = 'combat';
      }
    }
    // T-512 (DR-009): one situational recap on ANY resume — checkpoint or
    // mid-floor — delivered before input is accepted, exactly once.
    this.say('resume_recap');
    this.persist();
    this.playFloorMusic();
    this.renderAll();
  }

  /** T-503: hand-written Warden treatment — replaces the templated
   *  boss_start / boss_killed fragments for the four Zone Wardens, reacting to
   *  the player's dominant family when a variant exists. Returns false when
   *  the current boss is not a Warden (caller falls back to the corpus). */
  private sayWardenLine(kind: 'pre' | 'post'): boolean {
    const wardenId = this.session.currentRoom().enemies
      .map((spawn) => spawn.enemyDefId)
      .find((id) => this.enemyRegistry.get(id)?.tier === 'zone_warden');
    if (wardenId === undefined) return false;
    const family = this.session.snapshot.player.dominantTraits?.[0];
    const line = kind === 'pre' ? wardenPreLine(wardenId, family) : wardenPostLine(wardenId);
    if (line === null) return false;
    this.laceText.setText(`LACE: ${line}`);
    return true;
  }

  /** The DR-008 tier of the current room's boss, for boss_tier analytics
   *  params (T-513). Undefined when the room holds no boss-tier enemy. */
  private currentBossTier(): 'floor_boss' | 'zone_warden' | undefined {
    for (const spawn of this.session.currentRoom().enemies) {
      const def = this.enemyRegistry.get(spawn.enemyDefId);
      if (def !== undefined && isBossTier(def.tier)) return def.tier;
    }
    return undefined;
  }

  private persist(): void {
    // T-513: the scene stamps the save with the wall clock (the deterministic
    // core never reads one) — feeds descent_resumed.hoursSinceSuspend.
    void this.saves.save({ ...this.session.toSave(), suspendedAtMs: Date.now() });
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
    // T-190: pass the player's dominant family (if any) for grammar flavour.
    const traits = this.session?.snapshot.player.dominantTraits;
    const family = traits && traits.length > 0 ? traits[0] : undefined;
    const line = this.narrator.narrate(context, { family });
    if (line !== null) this.laceText.setText(`LACE: ${line.text}`);
  }

  // ── Input ─────────────────────────────────────────────────────────────────

  private onPointer(x: number, y: number): void {
    // T-155: the expanded map is a read-only modal — any tap dismisses it.
    if (this.mapOverlayOpen) { this.closeMapOverlay(); return; }
    if (this.revealingEnemies) return; // block input during S040 reveal
    // T-170: a tap during the enemy phase fast-forwards playback to 2× (the cap).
    if (this.enemySeqActive) { this.enemySeqSpeed = 2; return; }
    if (this.combatMenuOpen) return;   // S047: menu zones handle their own input
    if (this.view === 'map') this.onMapPointer(x, y);
    else if (this.view === 'combat') this.onCombatPointer(x, y);
    else if (this.view === 'strand') this.onStrandPointer(x, y);
  }

  /** S043/S044: track hovered tile for attack-preview and AoE-circle preview.
   *  Re-renders only on change to avoid frame thrash. */
  private onPointerMove(x: number, y: number): void {
    const state = this.combat;
    if (state === null || state.phase !== 'player' || this.revealingEnemies || this.enemySeqActive) return;
    const tile = this.tileSize(state);
    const col = Math.floor((x - this.gridX(state)) / tile);
    const row = Math.floor((y - this.gridY(state)) / tile);
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
    // Capture whether this room was already cleared before moving — used below
    // to gate once-only interactions (event choices, safe-room healing).
    const alreadyCleared = this.session.snapshot.clearedRoomIds.includes(id);
    const hpBefore = this.session.snapshot.player.hp;
    this.session.moveTo(id);
    const room = this.session.currentRoom();
    logEvent('room_enter', {
      roomType: room.type,
      floorNumber: this.session.snapshot.floorNumber,
    });
    const encounter = this.session.beginEncounter();
    if (encounter === null) {
      if (room.type === 'lace_event' && !alreadyCleared) this.openEventRoom();
      else if (room.type === 'merchant') this.openDispenser();
      else if (room.type === 'safe') this.openSafeRoom(this.session.snapshot.player.hp - hpBefore);
      if (this.view !== 'event' && this.view !== 'safe') {
        this.maybeShowLoot();
        this.persist();
        this.renderAll();
      }
      return;
    }
    logEvent('combat_start', {
      roomType: room.type as 'combat' | 'boss',
      floorNumber: this.session.snapshot.floorNumber,
      enemyCount: encounter.enemies.length,
      ...(room.type === 'boss' ? { bossTier: this.currentBossTier() } : {}),
    });
    if (room.type !== 'boss' || !this.sayWardenLine('pre')) {
      this.say(room.type === 'boss' ? 'boss_start' : 'combat_start');
    }
    if (room.type === 'boss') playMusic(this, 'music_boss');
    this.combat = encounter;
    this.combatRng = makeRng(encounter.seed, 'combat');
    this.targeting = null;
    this.abilityPage = 0;
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

  /** S051/T-173: brief centred "CLEARED" flash with the XP gained, dismissing
   *  itself after ~1.5s total (180ms in · 1050ms hold · 270ms out). The label
   *  does a small scale pop for a beat of juice; the XP line only shows when XP
   *  was actually earned. */
  private playCombatVictoryFlash(xpGained: number): void {
    const bw = 220;
    const bh = xpGained > 0 ? 60 : 44;
    const bx = (W - bw) / 2;
    const by = STAGE_Y + (STAGE_H - bh) / 2;

    const bg = this.add.graphics().setDepth(4).setAlpha(0);
    bg.fillStyle(0x000000, 0.7).fillRoundedRect(bx, by, bw, bh, 10);
    bg.lineStyle(2, 0xa0ffdc, 0.7).strokeRoundedRect(bx, by, bw, bh, 10);

    const label = this.add.text(W / 2, by + 16, 'CLEARED', {
      fontFamily: 'monospace', fontSize: '18px', color: '#a0ffdc', letterSpacing: 5,
    }).setOrigin(0.5, 0).setDepth(4).setAlpha(0).setScale(0.8);

    const targets: Phaser.GameObjects.GameObject[] = [bg, label];
    if (xpGained > 0) {
      const xpLabel = this.add.text(W / 2, by + 38, `+${xpGained} XP`, {
        fontFamily: 'monospace', fontSize: '11px', color: '#ffdd44',
      }).setOrigin(0.5, 0).setDepth(4).setAlpha(0);
      targets.push(xpLabel);
    }

    // Fade everything in; pop the label scale to 1 on a back-ease for juice.
    this.tweens.add({ targets, alpha: 1, duration: 180, ease: 'Sine.easeOut' });
    this.tweens.add({
      targets: label, scale: 1, duration: 240, ease: 'Back.easeOut',
      onComplete: () => {
        this.time.delayedCall(1050, () => {
          this.tweens.add({
            targets, alpha: 0, duration: 270, ease: 'Sine.easeIn',
            onComplete: () => targets.forEach((g) => g.destroy()),
          });
        });
      },
    });
  }

  // ── S049 Sequential enemy phase ──────────────────────────────────────────

  /** Base delay between enemy-phase beats; halved while fast-forwarding (T-170). */
  private static readonly ENEMY_BEAT_MS = 240;

  /**
   * Plays the enemy phase one readable beat at a time (T-170). The resolved
   * effects are grouped into beats — one per enemy move/attack and per status
   * tick — and each beat's visuals (move flash, hit flash + damage number,
   * status pulse, death) play in initiative order. Tapping anywhere during the
   * sequence fast-forwards it to 2× (the cap). When the last beat finishes,
   * the "YOUR TURN" banner fires and input resumes.
   */
  private playEnemyPhaseSequence(effects: readonly Effect[]): void {
    const beats = this.buildEnemyBeats(effects);
    if (beats.length === 0) { this.finishEnemyPhase(); return; }

    this.enemySeqActive = true;
    this.enemySeqSpeed = 1;

    const runBeat = (i: number): void => {
      // Combat may have ended mid-sequence (player died on a tick) — bail out.
      if (this.combat === null) { this.enemySeqActive = false; return; }
      if (i >= beats.length) { this.enemySeqActive = false; this.finishEnemyPhase(); return; }
      this.playBeat(beats[i]!);
      this.time.delayedCall(GameScene.ENEMY_BEAT_MS / this.enemySeqSpeed, () => runBeat(i + 1));
    };
    runBeat(0);
  }

  /** Splits an enemy-phase effect list into ordered beats. A new beat starts on
   *  each enemy move / damage / heal; status and death effects fold into the
   *  beat they accompany so an on-hit status reads as one moment. */
  private buildEnemyBeats(effects: readonly Effect[]): Effect[][] {
    const beats: Effect[][] = [];
    let current: Effect[] | null = null;
    for (const fx of effects) {
      switch (fx.type) {
        case 'entityMoved':
          if (fx.entityId === 'player') break; // enemy phase only
          current = [fx]; beats.push(current); break;
        case 'damageDealt':
        case 'healingApplied':
          current = [fx]; beats.push(current); break;
        case 'statusApplied':
        case 'statusExpired':
        case 'entityDied':
          if (current !== null) current.push(fx);
          else { current = [fx]; beats.push(current); }
          break;
        default: break; // phaseChanged / outcome effects are handled outside the sequence
      }
    }
    return beats;
  }

  /** Plays the visuals for a single enemy-phase beat. */
  private playBeat(beat: readonly Effect[]): void {
    for (const fx of beat) {
      if (fx.type === 'entityMoved') {
        this.playEnemyActionFlash(fx.to);
      } else if (fx.type === 'damageDealt') {
        this.playHitFlash(fx.targetId);
        this.floatForEffect(fx);
      } else if (fx.type === 'healingApplied') {
        this.floatForEffect(fx);
      } else if (fx.type === 'statusApplied') {
        this.playStatusFlash(fx.targetId, fx.status, true);
      } else if (fx.type === 'statusExpired') {
        this.playStatusFlash(fx.targetId, fx.status, false);
      } else if (fx.type === 'entityDied' && fx.entityId !== 'player') {
        this.say('enemy_killed');
        playSfx(this, 'sfx_enemy_death');
      }
    }
  }

  /** Fires the "YOUR TURN" banner once the enemy sequence has fully played out. */
  private finishEnemyPhase(): void {
    if (this.combat !== null && this.combat.phase === 'player') {
      const { ap, maxAp } = this.combat.player;
      this.playYourTurnFlash(ap, maxAp);
    }
  }

  /** S046/T-170: enemy-phase bookkeeping that must happen immediately (counts,
   *  death cause, the ENEMY PHASE banner) — the readable visuals are deferred to
   *  {@link playEnemyPhaseSequence}. */
  private applyEnemyPhaseBookkeeping(effects: readonly Effect[]): void {
    let playerHurt = false;
    for (const fx of effects) {
      if (fx.type === 'entityDied' && fx.entityId !== 'player') {
        this.enemiesKilled += 1;
        this.tallyKillByType(fx.entityId);
      }
      if (fx.type === 'defeat') this.deathCause = fx.cause;
      if (fx.type === 'damageDealt' && fx.targetId === 'player') {
        playerHurt = true;
        this.damageTakenThisRun += fx.amount;
        this.lastPlayerHitType = fx.damageType; // attributes a death (T-306)
      }
      if (fx.type === 'phaseChanged' && fx.to === 'enemy') this.playEnemyPhaseFlash();
    }
    if (playerHurt) playSfx(this, 'sfx_player_hurt');
  }

  /** A brief orange/amber tile flash at `pos` to indicate an enemy just acted there. */
  private playEnemyActionFlash(pos: { x: number; y: number }): void {
    const state = this.combat;
    if (state === null) return;
    const tile = this.tileSize(state);
    const gx = this.gridX(state);
    const gy = this.gridY(state);
    const g = this.add.graphics().setDepth(3).setAlpha(0.55);
    g.fillStyle(0xffaa44, 1).fillRect(gx + pos.x * tile, gy + pos.y * tile, tile, tile);
    this.tweens.add({
      targets: g, alpha: 0, duration: 200, ease: 'Sine.easeOut',
      onComplete: () => g.destroy(),
    });
  }

  // ── S048 Hit flash ────────────────────────────────────────────────────────

  /** Current tile position of an entity in the live combat state, or null if
   *  it is gone (e.g. an enemy removed between effect and animation). */
  private entityPos(entityId: string): { x: number; y: number } | null {
    const state = this.combat;
    if (state === null) return null;
    if (entityId === 'player') return state.player.pos;
    const enemy = state.enemies.find((e) => e.id === entityId);
    return enemy?.pos ?? null;
  }

  /** Briefly flashes a bright overlay rect at the entity's tile position.
   *  Red for enemies, white for the player (damage taken). */
  private playHitFlash(entityId: string): void {
    const state = this.combat;
    if (state === null) return;
    const tilePos = this.entityPos(entityId);
    if (tilePos === null) return;
    const flashColor = entityId === 'player' ? 0xffffff : 0xff4444;

    const tile = this.tileSize(state);
    const gx = this.gridX(state);
    const gy = this.gridY(state);
    const px = gx + tilePos.x * tile;
    const py = gy + tilePos.y * tile;

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

  /** T-169: float the damage / heal number carried by an effect, if any. */
  private floatForEffect(fx: Effect): void {
    if (fx.type === 'damageDealt' && fx.amount > 0) {
      const toPlayer = fx.targetId === 'player';
      const color = fx.isCrit ? '#ffdd44' : toPlayer ? '#ff6644' : '#ffffff';
      this.floatCombatNumber(fx.targetId, fx.isCrit ? `${fx.amount}!` : `${fx.amount}`, color, fx.isCrit);
    } else if (fx.type === 'healingApplied' && fx.amount > 0) {
      this.floatCombatNumber(fx.targetId, `+${fx.amount}`, '#a0ffdc', false);
    }
  }

  /** T-169: a combat number (damage / heal) that rises from an entity's tile and
   *  fades. Crits render larger and bold so big hits read at a glance. */
  private floatCombatNumber(entityId: string, text: string, color: string, big: boolean): void {
    const state = this.combat;
    if (state === null) return;
    const pos = this.entityPos(entityId);
    if (pos === null) return;

    const tile = this.tileSize(state);
    const gx = this.gridX(state);
    const gy = this.gridY(state);
    const cx = gx + pos.x * tile + tile / 2;
    const cy = gy + pos.y * tile + tile / 2;

    const label = this.add.text(cx, cy - tile * 0.15, text, {
      fontFamily: 'monospace', fontSize: big ? '15px' : '11px', color,
      fontStyle: big ? 'bold' : 'normal',
    }).setOrigin(0.5).setDepth(4);

    this.tweens.add({
      targets: label,
      y: cy - tile * 0.95,
      alpha: 0,
      duration: 650,
      ease: 'Sine.easeOut',
      onComplete: () => label.destroy(),
    });
  }

  // ── S050 Status tick visualisation ────────────────────────────────────────

  /** Flash the entity's tile and show a brief status icon/label when a status
   *  is applied (bright tint) or expires (fading grey). */
  private playStatusFlash(entityId: string, status: StatusEffect, applied: boolean): void {
    const state = this.combat;
    if (state === null) return;
    const tilePos = this.entityPos(entityId);
    if (tilePos === null) return;

    const tile = this.tileSize(state);
    const gx = this.gridX(state);
    const gy = this.gridY(state);
    const px = gx + tilePos.x * tile;
    const py = gy + tilePos.y * tile;

    const color = applied ? statusHex(status) : 0x888888;
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
    const gy = this.gridY(state);
    const reveals: Phaser.GameObjects.Graphics[] = [];
    let completed = 0;

    const onAllDone = (): void => {
      reveals.forEach((r) => r.destroy());
      this.revealingEnemies = false;
      this.renderAll();
    };

    enemies.forEach((e, i) => {
      const cx = gx + e.pos.x * tile + tile / 2;
      const cy = gy + e.pos.y * tile + tile / 2;
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
    const row = Math.floor((y - this.gridY(state)) / tile);
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
    if (state === null || state.phase !== 'player' || this.enemySeqActive) return;
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
    if (state === null || state.phase !== 'player' || state.player.ap < 1 || this.enemySeqActive) return;
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
    // T-190: attacking at ≤25% HP signals risky play to LACE.
    if (action.type === 'attack' && state.player.hp <= Math.round(state.player.maxHp * 0.25)) {
      this.narrator.signalMood('risky_play');
    }
    const result = TurnEngine.apply(state, action, this.combatRng);
    if (result.errors.length === 0) {
      if (action.type === 'attack') playSfx(this, 'sfx_attack');
      else if (action.type === 'useAbility') playSfx(this, 'sfx_ability');
      else if (action.type === 'useItem') playSfx(this, 'sfx_item');
      this.combat = result.state;
      this.session.syncCombat(result.state, this.combatRng.state);

      // S049/T-170: an ended turn runs the enemy phase as a readable, tappable
      // sequence; all other actions resolve their visuals immediately.
      if (action.type === 'endTurn') {
        this.applyEnemyPhaseBookkeeping(result.effects);
        this.maybeEndCombat();
        if (this.combat !== null) {
          this.persist();
          this.renderAll();            // show the post-phase board, then play beats over it
          this.playEnemyPhaseSequence(result.effects);
          return;
        }
      } else {
        this.reactToCombatEffects(result.effects);
        this.maybeEndCombat();
        if (this.combat !== null) this.persist();
      }
    }
    this.renderAll();
  }

  private reactToCombatEffects(effects: readonly Effect[]): void {
    let playerHurt = false;
    for (const fx of effects) {
      if (fx.type === 'entityDied' && fx.entityId !== 'player') {
        this.enemiesKilled += 1;
        this.tallyKillByType(fx.entityId);
        this.say('enemy_killed');
        playSfx(this, 'sfx_enemy_death');
      }
      // T-195: capture the death cause for the post-run summary.
      if (fx.type === 'defeat') this.deathCause = fx.cause;
      if (fx.type === 'damageDealt' && fx.targetId === 'player') {
        playerHurt = true;
        this.damageTakenThisRun += fx.amount;
        this.lastPlayerHitType = fx.damageType; // attributes a death (T-306)
      }
      // S048/T-169: flash the hit entity's tile + float the damage/heal number.
      if (fx.type === 'damageDealt') this.playHitFlash(fx.targetId);
      this.floatForEffect(fx);
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

    logEvent('combat_end', {
      outcome: state.phase === 'defeat' ? 'defeat' : 'victory',
      turnsElapsed: state.turn,
      ...(this.session.currentRoom().type === 'boss' ? { bossTier: this.currentBossTier() } : {}),
    });

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
    this.combatMenuPanel = null;
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
      if (!this.sayWardenLine('post')) this.say('boss_killed');
      playSfx(this, 'sfx_victory');
      playMusic(this, 'music_menu');
      this.recordRun(true);
      void this.saves.clear();
      // S031/S032: route to the run summary + meta rewards.
      this.goToPostRun(true);
      return;
    } else if (status === 'strand_event') {
      if (!this.sayWardenLine('post')) this.say('boss_killed');
      this.openStrandEvent();
    } else if (status === 'floor_complete') {
      this.say('floor_complete');
      if (wasBoss) this.playFloorMusic();
      this.view = 'map';
      this.persist();
      this.playCombatVictoryFlash(xpGained);
      // T-190: high-HP victory → LACE reads as defensive play.
      const ps = this.session.snapshot.player;
      if (ps.hp >= Math.round(ps.maxHp * 0.75)) this.narrator.signalMood('defensive_play');
    } else {
      if (!wasBoss || !this.sayWardenLine('post')) {
        this.say(wasBoss ? 'boss_killed' : 'room_cleared');
      }
      if (wasBoss) this.playFloorMusic();
      this.view = 'map';
      this.persist();
      this.playCombatVictoryFlash(xpGained);
      // T-190: high-HP victory → LACE reads as defensive play.
      const ps = this.session.snapshot.player;
      if (ps.hp >= Math.round(ps.maxHp * 0.75)) this.narrator.signalMood('defensive_play');
    }

    if (this.view === 'map' && this.session.snapshot.pendingStatPoints > 0) {
      this.view = 'levelup';
    }
    this.maybeShowLoot();
  }

  private recordRun(won: boolean): void {
    if (this.runRecorded) return;
    this.runRecorded = true;
    // T-190: repeated death signals contempt in LACE (runs − wins = prior losses).
    const priorLosses = this.meta.lifetime.runs - this.meta.lifetime.wins;
    if (!won && priorLosses > 0) this.narrator.signalMood('death_loop');
    const snap = this.session.snapshot;
    const durationMs = Date.now() - this.runStartMs;
    const outcome = won ? 'win' : this.deathCause === 'surrender' ? 'surrender' : 'loss';
    logEvent('run_end', {
      outcome,
      floorReached: snap.floorNumber,
      mutationCount: snap.player.mutations.length,
      durationMs,
      ...(won ? {} : { deathCause: this.deathCause }),
    });
    const before = this.meta.shardCrystals;
    // T-306: the typed tallies advance the strain counters; crossing a
    // milestone unlocks its strain inside recordRunOutcome.
    const dominantFamily =
      snap.player.mutations.length > 0 ? this.primaryFamily(snap.player.mutations) : undefined;
    this.meta = recordRunOutcome(
      this.meta,
      {
        won,
        floorReached: snap.floorNumber,
        enemiesKilled: this.enemiesKilled,
        playtimeMs: durationMs,
        veinEarned: snap.veinEarned,
        killsByType: this.killsByType,
        ...(!won && this.lastPlayerHitType !== null
          ? { deathDamageType: this.lastPlayerHitType }
          : {}),
        ...(dominantFamily !== undefined ? { dominantFamily } : {}),
        mutationIds: snap.player.mutations,
      },
      this.strainPool,
    );
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

    // T-287: generate the deterministic organism name from the run's build.
    const mutationIds = snap.player.mutations;
    const buildSignature = [...mutationIds].sort().join(',');
    const dominants = (snap.player.dominantTraits ?? []) as MutationFamily[];
    const family: MutationFamily = dominants[0] ?? this.primaryFamily(mutationIds);
    let organismName = 'The Fledgling Diver';
    if (this.nameTables !== null) {
      try {
        organismName = generateOrganismName({
          runSeed: this.seed,
          buildSignature,
          family,
          facts: {
            floorReached: snap.floorNumber,
            damageTaken: this.damageTakenThisRun,
            enemiesKilled: this.enemiesKilled,
            won,
          },
          tables: this.nameTables,
        });
      } catch {
        /* tables validated in loadContent — guard only */
      }
    }

    const summary: RunSummaryData = {
      meta: this.meta,
      won,
      floorReached: snap.floorNumber,
      finalFloor: FINAL_FLOOR,
      enemiesKilled: this.enemiesKilled,
      shardsEarned: this.lastRunShards,
      veinEarned: snap.veinEarned,
      mutations: names,
      dominantTraits: dominants,
      playtimeMs: Date.now() - this.runStartMs,
      deathCause: won ? null : this.deathCause,
      achievementsEarned: this.achievementsEarned,
      // Surrender is a deliberate forfeit — never offer the revive ad for it.
      reviveAvailable: !won && !this.reviveUsed && this.deathCause !== 'surrender',
      organismName,
    };
    this.scene.start('PostRunScene', summary as unknown as Record<string, unknown>);
  }

  /** Returns the mutation family the player has the most mutations in (fallback for no dominant trait). */
  private primaryFamily(mutationIds: readonly string[]): MutationFamily {
    const counts = new Map<MutationFamily, number>();
    for (const id of mutationIds) {
      const def = this.mutationPool.find((m) => m.id === id);
      if (def !== undefined) counts.set(def.family, (counts.get(def.family) ?? 0) + 1);
    }
    let best: MutationFamily = 'abyssal';
    let bestCount = 0;
    for (const [f, n] of counts) {
      if (n > bestCount) { best = f; bestCount = n; }
    }
    return best;
  }

  // ── Dispenser ─────────────────────────────────────────────────────────────

  private openDispenser(): void {
    this.shopAdRefreshUsed = false;
    this.say('generic');
    this.view = 'shop';
    this.persist();
    this.renderAll();
  }

  private buyItem(item: ItemDef): void {
    if (!this.session.canAfford(item)) {
      const price = this.session.dispenserPriceOf(item);
      const short = price - this.session.snapshot.veinCrystals;
      this.laceText.setText(`LACE: ${item.name} costs ${price} VEIN — you're ${short} short.`);
      playSfx(this, 'ui_back');
      this.renderAll(); return;
    }
    if (!this.session.canCarry(item)) {
      const { count, limit } = this.session.inventory()[item.category];
      this.laceText.setText(`LACE: ${item.category} slots full (${count}/${limit}). Drop something first.`);
      playSfx(this, 'ui_back');
      this.renderAll(); return;
    }
    this.session.purchaseItem(item);
    playSfx(this, 'ui_confirm');
    this.laceText.setText(`LACE: Acquired ${item.name}.`);
    this.persist();
    this.renderAll();
  }

  private leaveDispenser(): void {
    this.view = 'map';
    this.maybeShowLoot();
    this.persist();
    this.renderAll();
  }

  /** T-177: watch a rewarded ad to refresh the Dispenser's stock (1/visit cap). */
  private async shopAdRefresh(): Promise<void> {
    if (this.shopAdRefreshUsed) return;
    const outcome = await adService.requestReward('merchant_refresh');
    if (!outcome.granted) {
      this.laceText.setText('LACE: No signal. The Dispenser stays as is.');
      this.renderAll(); return;
    }
    this.shopAdRefreshUsed = true;
    this.session.refreshDispenserStock();
    playSfx(this, 'ui_confirm');
    this.laceText.setText('LACE: The Dispenser cycles. New stock loaded.');
    this.persist();
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
  private openEventRoom(): void {
    this.view = 'event';
    this.eventOutcome = null;
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

  /** T-176: apply a chosen response, then hold on the resolved-outcome panel
   *  (the player taps CONTINUE to return to the map). */
  private chooseEvent(reward: EventOutcome['reward']): void {
    const outcome = resolveEvent(reward, this.session.snapshot.player.maxHp);
    if (outcome.reward === 'heal') this.session.healPlayer(outcome.amount);
    else this.session.grantVein(outcome.amount); // 'vein' and 'sig' both grant VEIN
    this.eventOutcome = outcome;
    this.laceText.setText(`LACE: ${outcome.lace}`);
    playSfx(this, 'ui_confirm');
    this.persist();
    this.renderAll();
  }

  private leaveEventRoom(): void {
    this.eventOutcome = null;
    this.view = 'map';
    this.maybeShowLoot();
    this.persist();
    this.renderAll();
  }

  private renderEvent(): void {
    const evt = pickEvent(this.session.snapshot.currentRoomId);

    this.transient.push(
      this.add.text(W / 2, STAGE_Y + 10, evt.title, {
        fontFamily: 'monospace', fontSize: '14px', color: C.yellow, letterSpacing: 2,
      }).setOrigin(0.5, 0),
      this.add.text(W / 2, STAGE_Y + 34, evt.sub, {
        fontFamily: 'monospace', fontSize: '10px', color: C.dim,
        wordWrap: { width: W - 40 }, align: 'center',
      }).setOrigin(0.5, 0),
    );

    // Resolved: show the outcome the player chose instead of the choices.
    if (this.eventOutcome !== null) {
      this.renderEventOutcome(this.eventOutcome);
      return;
    }

    const cardTop = STAGE_Y + 76;
    const cardH = 78;
    const cardGap = 10;

    evt.choices.forEach((choice, i) => {
      const x = 16;
      const y = cardTop + i * (cardH + cardGap);
      const w = W - 32;

      // Own Graphics per card so its entrance can be tweened independently.
      const card = this.add.graphics().setAlpha(0);
      card.fillStyle(0x0e1830).fillRoundedRect(x, y, w, cardH, 8);
      card.lineStyle(1, GC.edge).strokeRoundedRect(x, y, w, cardH, 8);
      // A coloured spine marks the choice's flavour (bold / patient / cautious).
      const spine = choice.reward === 'heal' ? GC.hpGreen : choice.reward === 'vein' ? GC.current : GC.adj;
      card.fillStyle(spine, 0.9).fillRoundedRect(x, y, 4, cardH, 2);

      const labelT = this.add.text(x + 16, y + 14, choice.label, { fontFamily: 'monospace', fontSize: '12px', color: C.text }).setAlpha(0);
      const descT = this.add.text(x + 16, y + 38, choice.desc, {
        fontFamily: 'monospace', fontSize: '9px', color: C.dim, wordWrap: { width: w - 30 },
      }).setAlpha(0);
      this.transient.push(card, labelT, descT);

      // Stagger each card up from slightly below (40ms apart).
      [card, labelT, descT].forEach((o) => { o.y += 8; });
      this.tweens.add({
        targets: [card, labelT, descT], alpha: 1, y: '-=8',
        duration: 200, delay: 60 + i * 70, ease: 'Sine.easeOut',
      });

      const z = this.add.zone(x, y, w, cardH).setOrigin(0, 0).setInteractive({ useHandCursor: true });
      z.on('pointerdown', () => this.chooseEvent(choice.reward));
      this.buttonZones.push(z);
    });
  }

  /** T-176: the resolved-outcome card shown after a choice (CONTINUE in the button row). */
  private renderEventOutcome(outcome: EventOutcome): void {
    const px = 28;
    const py = STAGE_Y + 96;
    const pw = W - 56;
    const ph = 150;
    const accent = outcome.reward === 'heal' ? GC.hpGreen : GC.current;

    const card = this.add.graphics().setAlpha(0).setScale(0.96);
    card.fillStyle(0x0e1830).fillRoundedRect(px, py, pw, ph, 12);
    card.lineStyle(2, accent, 0.7).strokeRoundedRect(px, py, pw, ph, 12);

    const headline = this.add.text(W / 2, py + 42, outcome.headline, {
      fontFamily: 'monospace', fontSize: '17px', color: outcome.reward === 'heal' ? C.green : C.yellow,
    }).setOrigin(0.5).setAlpha(0);
    const lace = this.add.text(W / 2, py + 92, outcome.lace, {
      fontFamily: 'monospace', fontSize: '10px', color: C.dim, fontStyle: 'italic',
      wordWrap: { width: pw - 36 }, align: 'center', lineSpacing: 3,
    }).setOrigin(0.5).setAlpha(0);

    this.transient.push(card, headline, lace);
    this.tweens.add({ targets: card, alpha: 1, scale: 1, duration: 220, ease: 'Back.easeOut' });
    this.tweens.add({ targets: [headline, lace], alpha: 1, duration: 260, delay: 120, ease: 'Sine.easeOut' });
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

  /** S072 REST (DR-009, T-510): suspend the run at the act-end checkpoint and
   *  return to the Hub. The save written here carries the checkpoint, so the
   *  Hub shows the "Continue Descent" card; pause-only — never a retry point. */
  private restAtCheckpoint(): void {
    const checkpoint = this.session.checkpoint();
    if (checkpoint !== null) {
      logEvent('descent_checkpoint_rested', { floorNumber: checkpoint.floor, act: checkpoint.act });
    }
    this.persist();
    playSfx(this, 'ui_confirm');
    this.scene.start('HubScene', { meta: this.meta });
  }

  /** S029 narration card (T-194) → S022 reveal mask (T-149) → new floor. */
  private descendFloor(): void {
    const completedFloor = this.session.snapshot.floorNumber;
    const floorStartMs = this.runStartMs; // approximation; per-floor timer is future work
    logEvent('floor_complete', {
      floorNumber: completedFloor,
      durationMs: Date.now() - floorStartMs,
    });
    const nextFloor = completedFloor + 1;
    this.playDescentNarration(nextFloor, () => this.playFloorRevealMask(() => {
      this.session.descend();
      // T-190: mood signals for new/deep floors.
      this.narrator.signalMood('new_floor');
      if (this.session.snapshot.floorNumber >= 16) this.narrator.signalMood('deep_floor');
      this.say('floor_enter');
      this.playFloorMusic();
      this.persist();
      this.renderAll();
    }));
  }

  /**
   * T-149: full-screen black mask that covers the scene while `generate` runs,
   * then fades out (~700 ms) to reveal the freshly rendered floor.
   * Depth 10 sits above all normal game content (topGfx=2, overlay=3, menus=5).
   */
  private playFloorRevealMask(generate: () => void): void {
    const mask = this.add.graphics().setDepth(10);
    mask.fillStyle(0x000000).fillRect(0, 0, W, H);
    mask.setAlpha(0);
    this.tweens.add({
      targets: mask, alpha: 1, duration: 180, ease: 'Sine.easeIn',
      onComplete: () => {
        generate();
        this.tweens.add({
          targets: mask, alpha: 0, duration: 700, ease: 'Sine.easeOut',
          onComplete: () => mask.destroy(),
        });
      },
    });
  }

  /** T-189: Green body-flash when a mutation is applied — communicates the
   *  DNA-level change to the player's geometry. Screen-wide pulse (depth 5)
   *  that fades in quickly then washes out over ~500 ms. */
  private playMutationPulse(): void {
    const flash = this.add.graphics().setDepth(5).setAlpha(0);
    flash.fillStyle(0x44ff99, 0.38).fillRect(0, STAGE_Y, W, H - STAGE_Y);
    this.tweens.add({
      targets: flash, alpha: 1, duration: 90, ease: 'Sine.easeOut',
      onComplete: () => {
        this.tweens.add({
          targets: flash, alpha: 0, duration: 520, ease: 'Sine.easeIn',
          onComplete: () => flash.destroy(),
        });
      },
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
    this.strandConfirmPending = false;
    this.dominantTraitReveal = [];
    this.strandAnimateCards = 'all';
    this.view = 'strand';
    if (this.session.isProtoStrand()) {
      logEvent('proto_strand_shown', { floorNumber: this.session.snapshot.floorNumber });
    } else {
      logEvent('strand_event_open', {
        floorNumber: this.session.snapshot.floorNumber,
        mutationCount: this.session.snapshot.player.mutations.length,
      });
    }
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
        if (this.strandSelected !== i) this.strandConfirmPending = false;
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

    // T-185: two-tap confirm for new players
    if (showStrandConfirmHint(this.meta.lifetime.runs) && !this.strandConfirmPending) {
      this.strandConfirmPending = true;
      this.renderAll();
      return;
    }
    this.strandConfirmPending = false;

    // T-191: capture dominant traits and synergy count before applying mutation
    const prevSnap = this.session.snapshot;
    const prevOwnedDefs = this.mutationPool.filter((m) => prevSnap.player.mutations.includes(m.id));
    const prevSynCount = unlockedSynergies(prevOwnedDefs).length;
    const prevTraits = [...(prevSnap.player.dominantTraits ?? [])];
    const wasProto = this.session.isProtoStrand(); // resolving the pick clears it
    this.session.chooseStrandMutation(card.mutation.id);
    playSfx(this, 'sfx_mutation');
    this.laceText.setText(`LACE: ${card.mutation.lace}`);

    const mut = card.mutation;
    logEvent('mutation_chosen', {
      mutationId: mut.id,
      family: mut.family,
      tier: mut.tier,
      slot: mut.grantsAbility !== null ? 'active' : 'passive',
    });
    if (wasProto) logEvent('proto_strand_selected', { mutationId: mut.id, family: mut.family });
    this.playMutationPulse();

    // T-190: new hybrid synergy → reverent mood signal.
    const afterSnap = this.session.snapshot;
    const afterOwnedDefs = this.mutationPool.filter((m) => afterSnap.player.mutations.includes(m.id));
    if (unlockedSynergies(afterOwnedDefs).length > prevSynCount) this.narrator.signalMood('hybrid_synergy');

    // Detect newly unlocked dominant traits
    const afterTraits = (this.session.snapshot.player.dominantTraits ?? []) as MutationFamily[];
    const newTraits = afterTraits.filter((f) => !prevTraits.includes(f));
    for (const family of newTraits) {
      logEvent('dominant_trait_unlocked', { family, traitId: `${family}_dominant` });
    }
    if (newTraits.length > 0) {
      this.dominantTraitReveal = newTraits;
      this.persist();
      this.renderAll();
      // Auto-dismiss celebration after 3 seconds; player can also tap CONTINUE
    } else {
      this.view = 'map';
      this.sayCheckpointRestLine();
      this.persist();
      this.renderAll();
    }
  }

  private rerollStrandCard(): void {
    if (this.strandSelected === null || this.strandRerollUsed) return;
    const idx = this.strandSelected;
    this.session.rerollStrandCard(idx);
    this.strandRerollUsed = true;
    logEvent('strand_reroll', { floorNumber: this.session.snapshot.floorNumber });
    this.strandConfirmPending = false;
    this.strandAnimateCards = idx; // T-188: animate only the replaced card
    const card = this.session.strandOffer[idx];
    if (card !== undefined) this.laceText.setText(`LACE: ${card.mutation.lace}`);
    this.renderAll();
  }

  private continueIntermission(): void {
    this.session.acceptIntermission();
    this.view = 'map';
    this.sayCheckpointRestLine();
    this.persist();
    this.renderAll();
  }

  /** S072 framing line (UFD 04 amendment) — shown once the Strand Event
   *  resolves and the Descend/Rest choice is on screen. Also the analytics
   *  funnel point: the choice appearing IS the checkpoint offer (T-513). */
  private sayCheckpointRestLine(): void {
    const checkpoint = this.session.checkpoint();
    if (checkpoint === null) return;
    logEvent('descent_checkpoint_offered', { floorNumber: checkpoint.floor, act: checkpoint.act });
    this.laceText.setText('LACE: Rest. The VEIN is patient. Your new strand will settle.');
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
      playSfx(this, 'ui_confirm');
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

    // T-155: compact minimap on the room/combat screens, and its expanded view.
    if (this.mapOverlayOpen) {
      this.renderMapOverlay();
    } else if (GameScene.MINIMAP_VIEWS.has(this.view) && !this.combatMenuOpen && this.itemConfirmPending === null) {
      this.renderMinimapWidget();
    }

    this.renderButtons();
    this.updateHud();
  }

  /** The full navigation map's viewport (the STAGE area). */
  private static readonly MAP_VIEWPORT: Viewport = { x: 16, y: STAGE_Y, width: W - 32, height: STAGE_H };

  /** Layout (bounds + transform) for a floor graph fitted to `vp`. Single source
   *  of truth so the renderer and the tap hit-test always agree on node positions. */
  private layoutFor(vp: Viewport, radius: number, labels: boolean): {
    bounds: ReturnType<typeof computeBounds>;
    transform: ReturnType<typeof computeLayout>;
  } {
    const bounds = computeBounds(this.session.floor.rooms);
    const transform = computeLayout(bounds, vp, {
      minScale: radius * 1.6,
      maxScale: labels ? 70 : 28,
      padding: radius + 4,
    });
    return { bounds, transform };
  }

  private mapTransform(): { bounds: ReturnType<typeof computeBounds>; transform: ReturnType<typeof computeLayout> } {
    return this.layoutFor(GameScene.MAP_VIEWPORT, 14, true);
  }

  /** Rooms the player has stood in: cleared rooms plus wherever they are now.
   *  Drives the map-level fog of war (T-154) and survives save/resume. */
  private visitedRooms(): Set<string> {
    const snap = this.session.snapshot;
    return new Set([...snap.clearedRoomIds, snap.currentRoomId]);
  }

  /**
   * Draw the floor's room graph (with fog) into `g`, fitted to viewport `vp`.
   * Shared by the full navigation map (T-150/154), the compact minimap widget
   * and the expanded map overlay (T-155). The big views pass `labels: true` to
   * draw room icons/glyphs + "?" markers; the compact widget leaves them off and
   * just plots coloured dots. `showAdj` draws the green "you can move here" ring,
   * which only the live, interactive map enables.
   */
  private drawFloorGraph(
    g: Phaser.GameObjects.Graphics,
    vp: Viewport,
    opts: { radius: number; labels: boolean; showAdj: boolean; textDepth: number },
  ): void {
    const floor = this.session.floor;
    const { bounds, transform } = this.layoutFor(vp, opts.radius, opts.labels);
    const snap = this.session.snapshot;
    const cleared = new Set(snap.clearedRoomIds);
    const adjacent = opts.showAdj ? new Set(this.session.adjacentRooms()) : new Set<string>();

    // T-154: map-level fog of war. Corridors lead outward from explored ground
    // and unvisited rooms read as bare "?" outlines until entered (safe rooms
    // excepted — always shown), so descending a floor stays a discovery.
    const visited = this.visitedRooms();
    const reveal = computeFogReveal(floor, visited);
    const r = opts.radius;
    const edgeW = Math.max(1, Math.round(r / 7));

    for (const e of floor.edges) {
      if (!edgeVisible(e, visited)) continue;
      const a = project(this.roomById(e.from).pos, bounds, transform);
      const b = project(this.roomById(e.to).pos, bounds, transform);
      g.lineStyle(edgeW, GC.edge).lineBetween(a.x, a.y, b.x, b.y);
    }

    for (const room of floor.rooms) {
      const rev = reveal.get(room.id);
      if (rev === undefined || rev.level === 'hidden') continue;
      const p = project(room.pos, bounds, transform);

      // Discovered-but-unknown rooms render as a hollow outline with a "?".
      if (rev.level === 'discovered' && !rev.typeKnown) {
        g.fillStyle(GC.fog, 0.55).fillCircle(p.x, p.y, r);
        g.lineStyle(edgeW, GC.fogEdge).strokeCircle(p.x, p.y, r);
        if (adjacent.has(room.id)) g.lineStyle(3, GC.adj).strokeCircle(p.x, p.y, r + 3);
        if (opts.labels) {
          const q = this.add.text(p.x, p.y, '?', {
            fontFamily: 'monospace', fontSize: '13px', color: C.dim,
          }).setOrigin(0.5).setDepth(opts.textDepth);
          this.transient.push(q);
        }
        continue;
      }

      const isCurrent = room.id === snap.currentRoomId;
      let fill = cleared.has(room.id) ? GC.nodeCleared : GC.node;
      if (room.id === floor.bossRoomId) fill = GC.boss;
      else if (room.id === floor.startRoomId) fill = GC.start;
      g.fillStyle(fill).fillCircle(p.x, p.y, r);

      if (adjacent.has(room.id)) g.lineStyle(3, GC.adj).strokeCircle(p.x, p.y, r + 3);
      if (isCurrent) g.lineStyle(Math.max(2, edgeW + 1), GC.current).strokeCircle(p.x, p.y, r + (opts.labels ? 6 : 2));

      if (!opts.labels) continue;
      const iconImg = drawSprite(this, g, roomSpriteKey(room.type), p.x, p.y, r + 8, { fallback: false });
      if (iconImg !== null) {
        iconImg.setDepth(opts.textDepth);
        this.transient.push(iconImg);
      } else {
        // T-156: a distinct *shape* glyph per room type so the map never relies
        // on colour alone (a11y). A dark stroke keeps it legible on both the
        // bright (start/boss) and dark (combat/loot) node fills.
        const glyph = this.add.text(p.x, p.y, roomGlyph(room.type), {
          fontFamily: 'monospace', fontSize: `${Math.round(r * 0.9)}px`, color: C.text,
          stroke: C.dark, strokeThickness: 3,
        }).setOrigin(0.5).setDepth(opts.textDepth);
        this.transient.push(glyph);
      }
    }
  }

  private renderMap(): void {
    this.drawFloorGraph(this.stage, GameScene.MAP_VIEWPORT, {
      radius: 14, labels: true, showAdj: true, textDepth: 1,
    });

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

  // ── Minimap (T-155) ─────────────────────────────────────────────────────────

  /** Views that should carry the compact minimap (anywhere the full map isn't
   *  on-screen but the player still benefits from spatial context). */
  private static readonly MINIMAP_VIEWS: ReadonlySet<View> = new Set<View>([
    'combat', 'strand', 'shop', 'event', 'safe', 'loot', 'swap',
  ]);

  /** T-155: a compact, tappable minimap pinned to the top-right corner. Shows the
   *  fogged floor graph as dots; tapping it expands the full read-only map. */
  private renderMinimapWidget(): void {
    const size = 64;
    const rect = compactMinimapRect(W, size, 6, 8);

    // Panel backdrop.
    this.overlay.fillStyle(GC.bg, 0.82).fillRoundedRect(rect.x, rect.y, rect.width, rect.height, 6);
    this.overlay.lineStyle(1, GC.fogEdge, 0.9).strokeRoundedRect(rect.x, rect.y, rect.width, rect.height, 6);

    // Inset the graph a touch so dots don't kiss the border.
    const inset = 6;
    this.drawFloorGraph(this.overlay, {
      x: rect.x + inset, y: rect.y + inset, width: rect.width - 2 * inset, height: rect.height - 2 * inset - 8,
    }, { radius: 3, labels: false, showAdj: false, textDepth: 4 });

    const prog = floorProgress(
      this.session.floor.rooms.map((rm) => rm.id),
      new Set(this.session.snapshot.clearedRoomIds),
    );
    const label = this.add.text(rect.x + rect.width / 2, rect.y + rect.height - 2, `MAP  ${prog.cleared}/${prog.total}`, {
      fontFamily: 'monospace', fontSize: '8px', color: C.dim,
    }).setOrigin(0.5, 1).setDepth(4);
    this.transient.push(label);

    const z = this.add.zone(rect.x, rect.y, rect.width, rect.height).setOrigin(0, 0).setInteractive({ useHandCursor: true });
    z.on('pointerdown', () => this.openMapOverlay());
    this.buttonZones.push(z);
  }

  private openMapOverlay(): void {
    if (this.mapOverlayOpen) return;
    this.mapOverlayOpen = true;
    playSfx(this, 'ui_click');
    this.renderAll();
  }

  private closeMapOverlay(): void {
    this.mapOverlayOpen = false;
    playSfx(this, 'ui_back');
    this.renderAll();
  }

  /** T-155: full-screen read-only floor map, expanded from the compact minimap. */
  private renderMapOverlay(): void {
    this.overlay.fillStyle(GC.bg, 0.95).fillRect(0, 0, W, H);

    const title = this.add.text(W / 2, 40, `FLOOR ${this.session.snapshot.floorNumber}`, {
      fontFamily: 'monospace', fontSize: '18px', color: C.text,
    }).setOrigin(0.5).setDepth(4);
    this.transient.push(title);

    const prog = floorProgress(
      this.session.floor.rooms.map((rm) => rm.id),
      new Set(this.session.snapshot.clearedRoomIds),
    );
    const sub = this.add.text(W / 2, 64, `${prog.cleared}/${prog.total} rooms explored`, {
      fontFamily: 'monospace', fontSize: '11px', color: C.dim,
    }).setOrigin(0.5).setDepth(4);
    this.transient.push(sub);

    // Big read-only graph (no move ring — this view doesn't navigate).
    this.drawFloorGraph(this.overlay, { x: 24, y: 92, width: W - 48, height: H - 200 }, {
      radius: 16, labels: true, showAdj: false, textDepth: 4,
    });

    const hint = this.add.text(W / 2, H - 60, 'tap anywhere to close', {
      fontFamily: 'monospace', fontSize: '12px', color: C.green,
    }).setOrigin(0.5).setDepth(4);
    this.transient.push(hint);
  }

  /** T-158: minimum tile size so art stays legible on large floors. */
  private static readonly TILE_MIN = 22;

  private tileSize(state: RunState): number {
    return Math.max(GameScene.TILE_MIN, Math.floor(GRID_PX / Math.max(state.grid.width, state.grid.height)));
  }

  /** T-158: X origin of the combat grid. Centers small grids; pans to follow
   *  the player when the grid overflows the screen width. */
  private gridX(state: RunState): number {
    const tile = this.tileSize(state);
    const totalW = tile * state.grid.width;
    if (totalW <= W) return Math.floor((W - totalW) / 2);
    const raw = Math.round(W / 2 - (state.player.pos.x * tile + tile / 2));
    return Math.max(W - totalW, Math.min(0, raw));
  }

  /** T-158: Y origin of the combat grid. Centers small grids; pans to follow
   *  the player when the grid overflows the stage height. */
  private gridY(state: RunState): number {
    const tile = this.tileSize(state);
    const totalH = tile * state.grid.height;
    if (totalH <= STAGE_H) return STAGE_Y + Math.floor((STAGE_H - totalH) / 2);
    const raw = Math.round(STAGE_Y + STAGE_H / 2 - (state.player.pos.y * tile + tile / 2));
    return Math.max(STAGE_Y + STAGE_H - totalH, Math.min(STAGE_Y, raw));
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
    const gy = this.gridY(state);

    for (let r = 0; r < state.grid.height; r++) {
      for (let c = 0; c < state.grid.width; c++) {
        const t = state.grid.tiles[r * state.grid.width + c]!;
        const px = gx + c * tile;
        const py = gy + r * tile;
        this.sprite(tileSpriteKey(t), px + tile / 2, py + tile / 2, tile);
        this.stage.lineStyle(1, GC.tileBorder).strokeRect(px, py, tile, tile);
      }
    }

    // T-159: threat / reach overlay. During the player's planning phase, faintly
    // shade every tile a living enemy can strike this turn, so the player can see
    // where it is unsafe to stand before committing a move (GDD §6.2.1). Hidden
    // during the enemy phase and the reveal so it doesn't fight the action.
    if (state.phase === 'player' && !this.revealingEnemies) {
      const threatened = threatenedTiles(state);
      for (const key of threatened) {
        const [tc, tr] = key.split(',').map(Number) as [number, number];
        this.topGfx.fillStyle(0xff4444, 0.1).fillRect(gx + tc * tile, gy + tr * tile, tile, tile);
        this.topGfx.lineStyle(1, 0xff4444, 0.18).strokeRect(gx + tc * tile + 0.5, gy + tr * tile + 0.5, tile - 1, tile - 1);
      }
    }

    // T-441b: tactical fog — draw a darkening overlay on tiles beyond vision.
    // Applied after the threat overlay so threat tiles stay legible through thin fog.
    const playerPos = state.player.pos;
    for (let r = 0; r < state.grid.height; r++) {
      for (let c = 0; c < state.grid.width; c++) {
        const alpha = fogAlpha(playerPos, { x: c, y: r });
        if (alpha > 0) {
          this.topGfx.fillStyle(0x010408, alpha).fillRect(gx + c * tile, gy + r * tile, tile, tile);
        }
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
        const cy = gy + e.pos.y * tile + tile / 2;
        // T-441b: living enemies outside vision radius are hidden (not revealed
        // until seen) — unless the Xenobiologist Origin is active (T-307: every
        // organism and its integrity readout is always visible; the fog overlay
        // still darkens its tile). Dead enemies always show as markers.
        if (e.hp > 0 && !isInVision(playerPos, e.pos) && !this.hpRevealActive) continue;
        if (e.hp <= 0) { this.sprite(e.enemyDefId, cx, cy, tile * 0.9, GC.dead); continue; }
        this.sprite(e.enemyDefId, cx, cy, tile * 0.92);
        drawHp(cx, cy, e.hp / e.maxHp, GC.hpRed);
        const def = this.enemyRegistry.get(e.enemyDefId);
        const name = def ? def.name : e.enemyDefId;
        addLabel(cx, gy + e.pos.y * tile, `${name}\n${e.hp}/${e.maxHp}`, def !== undefined && isBossTier(def.tier) ? C.red : C.yellow);

        // T-159: in-reach marker — a red caret over any enemy that can strike the
        // player from where it stands right now (player phase only).
        if (state.phase === 'player' && enemyInReach(e, state.player.pos)) {
          const markerY = gy + e.pos.y * tile + 1;
          this.topGfx.fillStyle(0xff4444, 0.95);
          this.topGfx.fillTriangle(cx - 5, markerY, cx + 5, markerY, cx, markerY + 6);
        }

        // T-159: boss wind-up tell. Baseline enemies are read from their threat
        // range (above); only scripted boss telegraphs get an explicit icon.
        if (def !== undefined && isBossTier(def.tier) && e.telegraph !== null && e.telegraph !== 'idle') {
          const tg = this.add.text(cx, gy + e.pos.y * tile - 12, this.telegraphIcon(e.telegraph), {
            fontFamily: 'monospace', fontSize: '13px', color: '#ff4444',
          }).setOrigin(0.5, 1).setDepth(3);
          this.transient.push(tg);
        }

        // T-172: persistent active-status badges below the enemy.
        this.drawStatusBadges(cx, gy + e.pos.y * tile + tile, e.statuses);
      }
    }

    if (this.targeting !== null && state.phase === 'player') {
      const range = this.targeting.kind === 'ability' ? this.targeting.slot.def.range : Infinity;
      for (let r = 0; r < state.grid.height; r++) {
        for (let c = 0; c < state.grid.width; c++) {
          if (c === state.player.pos.x && r === state.player.pos.y) continue;
          if (chebyshev(state.player.pos, { x: c, y: r }) <= range) {
            this.topGfx.fillStyle(0x44ccff, 0.16).fillRect(gx + c * tile, gy + r * tile, tile, tile);
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
          const hy = gy + hr * tile + tile / 2;

          // Highlight the targeted tile
          this.topGfx.fillStyle(0xffdd44, 0.28).fillRect(gx + hc * tile, gy + hr * tile, tile, tile);
          this.topGfx.lineStyle(2, 0xffdd44, 0.9).strokeRect(gx + hc * tile, gy + hr * tile, tile, tile);

          // AoE radius circle (when > 0)
          if (def.aoeRadius > 0) {
            const radiusPx = (def.aoeRadius + 0.5) * tile;
            this.topGfx.fillStyle(0xffdd44, 0.08).fillCircle(hx, hy, radiusPx);
            this.topGfx.lineStyle(1.5, 0xffdd44, 0.55).strokeCircle(hx, hy, radiusPx);
          }

          // Damage range label
          const dmgVal = def.baseDamage + Math.floor(state.player.stats.int * def.intScaling);
          const label = def.aoeRadius > 0 ? `${dmgVal} AoE·${def.aoeRadius} · ${def.apCost}AP` : `${dmgVal} · ${def.apCost}AP`;
          const dmgLabel = this.add.text(hx, gy + hr * tile - 3, label, {
            fontFamily: 'monospace', fontSize: '9px', color: '#ffdd44',
          }).setOrigin(0.5, 1).setDepth(2);
          this.transient.push(dmgLabel);
        }
      }
    }

    // T-163 S042: move preview.
    // Dim reachable tiles so the player sees the option space at a glance.
    if (state.phase === 'player' && this.targeting === null) {
      const blockedKeys = new Set([
        ...state.enemies.filter((e) => e.hp > 0).map((e) => `${e.pos.x},${e.pos.y}`),
        ...Array.from({ length: state.grid.width * state.grid.height }, (_, i) => {
          const t = state.grid.tiles[i];
          return t === 'wall' ? `${i % state.grid.width},${Math.floor(i / state.grid.width)}` : null;
        }).filter((k): k is string => k !== null),
      ]);
      const reachable = reachableMoves(state.player.pos, state.grid, blockedKeys);
      for (const p of reachable) {
        const px = gx + p.x * tile;
        const py = gy + p.y * tile;
        this.topGfx.fillStyle(0xa0ffdc, 0.06).fillRect(px, py, tile, tile);
      }
    }

    if (this.movePending !== null && state.phase === 'player') {
      // Arrow from player tile centre toward destination centre.
      const pcx = gx + state.player.pos.x * tile + tile / 2;
      const pcy = gy + state.player.pos.y * tile + tile / 2;
      const mx = gx + this.movePending.col * tile;
      const my = gy + this.movePending.row * tile;
      const mcx = mx + tile / 2;
      const mcy = my + tile / 2;
      this.topGfx.lineStyle(2, 0xa0ffdc, 0.6).lineBetween(pcx, pcy, mcx, mcy);
      // Arrowhead at the destination.
      const angle = Math.atan2(mcy - pcy, mcx - pcx);
      const aLen = 6;
      this.topGfx.fillStyle(0xa0ffdc, 0.9);
      this.topGfx.fillTriangle(
        mcx + Math.cos(angle) * aLen, mcy + Math.sin(angle) * aLen,
        mcx + Math.cos(angle + 2.4) * aLen, mcy + Math.sin(angle + 2.4) * aLen,
        mcx + Math.cos(angle - 2.4) * aLen, mcy + Math.sin(angle - 2.4) * aLen,
      );
      // Destination tile highlight.
      this.topGfx.fillStyle(0xa0ffdc, 0.2).fillRect(mx, my, tile, tile);
      this.topGfx.lineStyle(2, 0xa0ffdc, 0.85).strokeRect(mx, my, tile, tile);
      // Hint text — only shown to new players (first N runs) to avoid friction.
      const hint = showMoveConfirmHint(this.meta.lifetime.runs) ? '1 AP · tap to confirm' : '1 AP';
      const apLabel = this.add.text(mcx, my - 3, hint, {
        fontFamily: 'monospace', fontSize: '9px', color: '#a0ffdc',
      }).setOrigin(0.5, 1).setDepth(2);
      this.transient.push(apLabel);
    }

    // T-164 S043: attack preview — hover tint + full damage range + crit chance.
    if (this.attackHoverEnemyId !== null && state.phase === 'player') {
      const hovEnemy = state.enemies.find((e) => e.id === this.attackHoverEnemyId && e.hp > 0);
      if (hovEnemy !== undefined) {
        const ex = gx + hovEnemy.pos.x * tile;
        const ey = gy + hovEnemy.pos.y * tile;
        this.topGfx.fillStyle(0xff4444, 0.22).fillRect(ex, ey, tile, tile);
        this.topGfx.lineStyle(2, 0xff6644, 0.85).strokeRect(ex, ey, tile, tile);
        const preview = attackPreview(state.player.stats, hovEnemy);
        const previewLabel = this.add.text(ex + tile / 2, ey - 3, preview.label, {
          fontFamily: 'monospace', fontSize: '9px', color: '#ff8866',
        }).setOrigin(0.5, 1).setDepth(2);
        this.transient.push(previewLabel);
      }
    }

    const pp = state.player;
    const pcx = gx + pp.pos.x * tile + tile / 2;
    const pcy = gy + pp.pos.y * tile + tile / 2;
    this.sprite('player', pcx, pcy, tile * 0.92);
    drawHp(pcx, pcy, pp.hp / pp.maxHp, GC.hpGreen);
    addLabel(pcx, gy + pp.pos.y * tile, `YOU\n${pp.hp}/${pp.maxHp}`, C.green);
    // T-172: persistent active-status badges below the player.
    this.drawStatusBadges(pcx, gy + pp.pos.y * tile + tile, pp.statuses);
  }

  /** T-172: renders a centred row of active-status badges (glyph + turns) just
   *  below a combatant, so ongoing DoTs and debuffs stay visible between ticks. */
  private drawStatusBadges(
    cx: number,
    topY: number,
    statuses: readonly { readonly effect: StatusEffect; readonly turnsRemaining: number }[],
  ): void {
    const badges = statusBadges(statuses);
    if (badges.length === 0) return;
    const cellW = 15;
    const rowW = badges.length * cellW;
    let x = cx - rowW / 2 + cellW / 2;
    for (const b of badges) {
      const t = this.add.text(x, topY + 1, `${b.glyph}${b.turns}`, {
        fontFamily: 'monospace', fontSize: '9px', color: b.color,
      }).setOrigin(0.5, 0).setDepth(2);
      this.transient.push(t);
      x += cellW;
    }
  }

  /** S047 / T-168: in-combat pause menu — root or settings sub-panel. */
  private renderCombatMenu(): void {
    if (this.combatMenuPanel === 'settings') {
      this.renderCombatMenuSettings();
    } else {
      this.renderCombatMenuRoot();
    }
  }

  /** Root menu: RESUME · SETTINGS · SURRENDER (double-confirm). */
  private renderCombatMenuRoot(): void {
    const cw = 260;
    const ch = this.surrenderConfirmPending ? 236 : 196;
    const cx = (W - cw) / 2;
    const cy = STAGE_Y + (STAGE_H - ch) / 2;

    const dim = this.add.graphics().setDepth(5);
    dim.fillStyle(0x000000, 0.6).fillRect(0, 0, W, H);

    const card = this.add.graphics().setDepth(5).setAlpha(0);
    card.fillStyle(0x0e1626).fillRoundedRect(cx, cy, cw, ch, 12);
    card.lineStyle(2, 0x2a3a55).strokeRoundedRect(cx, cy, cw, ch, 12);
    this.tweens.add({ targets: card, alpha: 1, duration: 120, ease: 'Power2' });

    const combat = this.combat;
    const hpLine = combat
      ? `HP ${combat.player.hp}/${combat.player.maxHp}  ·  turn ${combat.turn}`
      : '';

    this.transient.push(dim, card,
      this.add.text(W / 2, cy + 16, 'PAUSED', {
        fontFamily: 'monospace', fontSize: '16px', color: '#e8edf5', letterSpacing: 4,
      }).setOrigin(0.5).setDepth(5),
      this.add.text(W / 2, cy + 36, hpLine, {
        fontFamily: 'monospace', fontSize: '9px', color: '#7a8fad',
      }).setOrigin(0.5).setDepth(5),
    );

    const rowW = cw - 32;
    const rowX = cx + 16;
    let nextY = cy + 56;

    // ── RESUME ────────────────────────────────────────────────────────────────
    const resumeG = this.add.graphics().setDepth(5);
    resumeG.fillStyle(0x1a3028).fillRoundedRect(rowX, nextY, rowW, 36, 8);
    resumeG.lineStyle(1, 0xa0ffdc).strokeRoundedRect(rowX, nextY, rowW, 36, 8);
    this.transient.push(resumeG,
      this.add.text(W / 2, nextY + 18, 'RESUME', {
        fontFamily: 'monospace', fontSize: '13px', color: '#a0ffdc',
      }).setOrigin(0.5).setDepth(5),
    );
    const resumeZ = this.add.zone(rowX, nextY, rowW, 36).setOrigin(0, 0).setInteractive({ useHandCursor: true }).setDepth(5);
    resumeZ.on('pointerdown', () => {
      this.combatMenuOpen = false;
      this.surrenderConfirmPending = false;
      this.combatMenuPanel = null;
      this.renderAll();
    });
    this.buttonZones.push(resumeZ);
    nextY += 44;

    // ── SETTINGS ──────────────────────────────────────────────────────────────
    const settG = this.add.graphics().setDepth(5);
    settG.fillStyle(0x1a2030).fillRoundedRect(rowX, nextY, rowW, 36, 8);
    settG.lineStyle(1, 0x2a3a55).strokeRoundedRect(rowX, nextY, rowW, 36, 8);
    this.transient.push(settG,
      this.add.text(rowX + 14, nextY + 18, 'SETTINGS', {
        fontFamily: 'monospace', fontSize: '13px', color: '#e8edf5',
      }).setOrigin(0, 0.5).setDepth(5),
      this.add.text(rowX + rowW - 14, nextY + 18, '›', {
        fontFamily: 'monospace', fontSize: '16px', color: '#7a8fad',
      }).setOrigin(1, 0.5).setDepth(5),
    );
    const settZ = this.add.zone(rowX, nextY, rowW, 36).setOrigin(0, 0).setInteractive({ useHandCursor: true }).setDepth(5);
    settZ.on('pointerdown', () => {
      this.combatMenuPanel = 'settings';
      this.renderAll();
    });
    this.buttonZones.push(settZ);
    nextY += 44;

    // ── SURRENDER (double-confirm) ────────────────────────────────────────────
    const surrLabel = this.surrenderConfirmPending ? 'CONFIRM SURRENDER' : 'SURRENDER';
    const surrColor = this.surrenderConfirmPending ? '#ff4444' : '#7a8fad';
    const surrBorder = this.surrenderConfirmPending ? 0xff4444 : 0x3a3050;
    const surrG = this.add.graphics().setDepth(5);
    surrG.fillStyle(0x1a1420).fillRoundedRect(rowX, nextY, rowW, 36, 8);
    surrG.lineStyle(1, surrBorder).strokeRoundedRect(rowX, nextY, rowW, 36, 8);
    this.transient.push(surrG,
      this.add.text(W / 2, nextY + 18, surrLabel, {
        fontFamily: 'monospace', fontSize: '13px', color: surrColor,
      }).setOrigin(0.5).setDepth(5),
    );
    const surrZ = this.add.zone(rowX, nextY, rowW, 36).setOrigin(0, 0).setInteractive({ useHandCursor: true }).setDepth(5);
    surrZ.on('pointerdown', () => {
      if (!this.surrenderConfirmPending) {
        this.surrenderConfirmPending = true;
        this.renderAll();
      } else {
        this.combatMenuOpen = false;
        this.surrenderConfirmPending = false;
        this.combat = null;
        this.deathCause = 'surrender';
        this.say('player_death');
        playSfx(this, 'sfx_defeat');
        playMusic(this, 'music_menu');
        this.recordRun(false);
        void this.saves.clear();
        this.playDeathSequence();
      }
    });
    this.buttonZones.push(surrZ);

    if (this.surrenderConfirmPending) {
      this.transient.push(
        this.add.text(W / 2, nextY + 40, 'this ends your run permanently', {
          fontFamily: 'monospace', fontSize: '9px', color: '#7a8fad',
        }).setOrigin(0.5).setDepth(5),
      );
    }
  }

  /** Settings sub-panel: ‹ BACK · MUSIC toggle · SFX toggle. */
  private renderCombatMenuSettings(): void {
    const cw = 260;
    const ch = 184;
    const cx = (W - cw) / 2;
    const cy = STAGE_Y + (STAGE_H - ch) / 2;

    const dim = this.add.graphics().setDepth(5);
    dim.fillStyle(0x000000, 0.6).fillRect(0, 0, W, H);

    const card = this.add.graphics().setDepth(5).setAlpha(0);
    card.fillStyle(0x0e1626).fillRoundedRect(cx, cy, cw, ch, 12);
    card.lineStyle(2, 0x2a3a55).strokeRoundedRect(cx, cy, cw, ch, 12);
    this.tweens.add({ targets: card, alpha: 1, duration: 120, ease: 'Power2' });

    // Header row: ‹ back arrow + title
    const backT = this.add.text(cx + 14, cy + 16, '‹', {
      fontFamily: 'monospace', fontSize: '18px', color: '#7a8fad',
    }).setOrigin(0, 0.5).setDepth(5);
    const titleT = this.add.text(W / 2, cy + 16, 'SETTINGS', {
      fontFamily: 'monospace', fontSize: '14px', color: '#e8edf5', letterSpacing: 3,
    }).setOrigin(0.5, 0.5).setDepth(5);
    this.transient.push(dim, card, backT, titleT);

    const backZ = this.add.zone(cx, cy, 64, 36).setOrigin(0, 0).setInteractive({ useHandCursor: true }).setDepth(5);
    backZ.on('pointerdown', () => { this.combatMenuPanel = null; this.renderAll(); });
    backZ.on('pointerover', () => backT.setColor('#a0ffdc'));
    backZ.on('pointerout', () => backT.setColor('#7a8fad'));
    this.buttonZones.push(backZ);

    // Divider
    const divG = this.add.graphics().setDepth(5);
    divG.lineStyle(1, 0x1e2a40).lineBetween(cx + 12, cy + 36, cx + cw - 12, cy + 36);
    this.transient.push(divG);

    const rowW = cw - 32;
    const rowX = cx + 16;
    const toggleRow = (y: number, label: string, on: boolean, onToggle: () => void): void => {
      const bg = this.add.graphics().setDepth(5);
      bg.fillStyle(0x141c2c).fillRoundedRect(rowX, y, rowW, 40, 8);
      bg.lineStyle(1, on ? 0x2a4a38 : 0x2a2a40).strokeRoundedRect(rowX, y, rowW, 40, 8);

      const labelT = this.add.text(rowX + 14, y + 20, label, {
        fontFamily: 'monospace', fontSize: '12px', color: '#e8edf5',
      }).setOrigin(0, 0.5).setDepth(5);

      const pillW = 44; const pillH = 22; const pillX = rowX + rowW - 14 - pillW; const pillY = y + 9;
      const pill = this.add.graphics().setDepth(5);
      pill.fillStyle(on ? 0x22aa66 : 0x2a2a40).fillRoundedRect(pillX, pillY, pillW, pillH, pillH / 2);
      const knobX = on ? pillX + pillW - 13 : pillX + 3;
      pill.fillStyle(0xffffff).fillCircle(knobX + 8, pillY + pillH / 2, 8);

      const stateT = this.add.text(pillX - 8, y + 20, on ? 'ON' : 'OFF', {
        fontFamily: 'monospace', fontSize: '9px', color: on ? '#a0ffdc' : '#7a8fad',
      }).setOrigin(1, 0.5).setDepth(5);

      this.transient.push(bg, labelT, pill, stateT);

      const z = this.add.zone(rowX, y, rowW, 40).setOrigin(0, 0).setInteractive({ useHandCursor: true }).setDepth(5);
      z.on('pointerdown', () => { onToggle(); this.renderAll(); });
      this.buttonZones.push(z);
    };

    const musicOn = getCategoryVolume('music') > 0;
    const sfxOn = getCategoryVolume('sfx') > 0;

    toggleRow(cy + 48, 'MUSIC', musicOn, () => {
      setCategoryVolume('music', musicOn ? 0 : 1);
      playSfx(this, 'ui_confirm');
    });
    toggleRow(cy + 100, 'SOUND EFFECTS', sfxOn, () => {
      setCategoryVolume('sfx', sfxOn ? 0 : 1);
      playSfx(this, 'ui_confirm');
    });

    // Subtle hint
    this.transient.push(
      this.add.text(W / 2, cy + ch - 14, 'settings apply immediately', {
        fontFamily: 'monospace', fontSize: '8px', color: '#3a4a60',
      }).setOrigin(0.5).setDepth(5),
    );
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

  /** T-175: fixed 6-slot ability bar; swipe arrows appear when the player has >6 abilities. */
  private renderAbilityBar(): void {
    const state = this.combat;
    if (state === null || state.phase !== 'player') return;
    const all = state.player.abilities;
    if (all.length === 0) return;

    const SLOTS = 6;
    const totalPages = Math.ceil(all.length / SLOTS);
    const hasPages = totalPages > 1;

    // With pagination arrows, shrink the bar to leave room on each side.
    const arrowW = hasPages ? 18 : 0;
    const margin = 8 + arrowW;
    const gap = 4;
    const btnW = Math.floor((W - 2 * margin - (SLOTS - 1) * gap) / SLOTS);
    const btnH = 36;

    // Ensure page is in range (could be stale from a previous render)
    this.abilityPage = Math.min(this.abilityPage, totalPages - 1);
    const pageStart = this.abilityPage * SLOTS;

    for (let slot = 0; slot < SLOTS; slot++) {
      const x = margin + slot * (btnW + gap);
      const abilitySlot = all[pageStart + slot];

      if (abilitySlot === undefined) {
        // Empty slot placeholder
        this.stage.fillStyle(0x0a0f18).fillRoundedRect(x, ABILITY_Y, btnW, btnH, 6);
        this.stage.lineStyle(1, 0x1e2a40, 0.5).strokeRoundedRect(x, ABILITY_Y, btnW, btnH, 6);
        continue;
      }

      const onCooldown = abilitySlot.cooldownRemaining > 0;
      const canAfford = state.player.ap >= abilitySlot.def.apCost;
      const ready = !onCooldown && canAfford;
      const active = this.targeting?.kind === 'ability' && this.targeting.slot.def.id === abilitySlot.def.id;

      const border = active ? 0xffdd44 : ready ? GC.btnBrd : 0x2a3050;
      const fillColor = active ? 0x1e2c1a : onCooldown ? 0x0e1020 : GC.btnBg;
      const textColor = active ? C.yellow : ready ? C.green : C.dim;

      this.stage.fillStyle(fillColor).fillRoundedRect(x, ABILITY_Y, btnW, btnH, 6);
      this.stage.lineStyle(1, border).strokeRoundedRect(x, ABILITY_Y, btnW, btnH, 6);

      if (onCooldown && abilitySlot.def.cooldown > 0) {
        const cdFrac = abilitySlot.cooldownRemaining / abilitySlot.def.cooldown;
        this.stage.fillStyle(0x3a3060, 0.7).fillRect(x + 1, ABILITY_Y + btnH - 5, Math.round((btnW - 2) * cdFrac), 4);
      }

      // Truncate name to fit the narrow slot
      const rawName = abilitySlot.def.id.replace(/_/g, ' ');
      const maxChars = Math.floor((btnW - 12) / 5.5); // ~5.5px per char at 8px monospace
      const name = rawName.length > maxChars ? rawName.slice(0, maxChars - 1) + '…' : rawName;
      const apLabel = `${abilitySlot.def.apCost}AP`;
      const cdLabel = onCooldown ? `cd${abilitySlot.cooldownRemaining}` : '';

      const nameText = this.add.text(x + 4, ABILITY_Y + 6, name, {
        fontFamily: 'monospace', fontSize: '8px', color: textColor,
      }).setOrigin(0, 0);
      const apText = this.add.text(x + btnW - 4, ABILITY_Y + 6, apLabel, {
        fontFamily: 'monospace', fontSize: '8px', color: onCooldown ? '#554466' : C.dim,
      }).setOrigin(1, 0);
      this.transient.push(nameText, apText);

      if (cdLabel !== '') {
        const cdText = this.add.text(x + btnW / 2, ABILITY_Y + btnH - 7, cdLabel, {
          fontFamily: 'monospace', fontSize: '7px', color: '#554466',
        }).setOrigin(0.5, 0);
        this.transient.push(cdText);
      }

      const z = this.add.zone(x, ABILITY_Y, btnW, btnH).setOrigin(0, 0).setInteractive({ useHandCursor: true });
      z.on('pointerdown', () => this.onAbilityButton(abilitySlot));
      this.buttonZones.push(z);
    }

    // Pagination arrows
    if (hasPages) {
      const cy = ABILITY_Y + btnH / 2;
      if (this.abilityPage > 0) {
        const lt = this.add.text(4, cy, '‹', {
          fontFamily: 'monospace', fontSize: '16px', color: C.dim,
        }).setOrigin(0, 0.5);
        this.transient.push(lt);
        const lz = this.add.zone(0, ABILITY_Y, arrowW + 4, btnH).setOrigin(0, 0).setInteractive({ useHandCursor: true });
        lz.on('pointerdown', () => { this.abilityPage--; this.renderAll(); });
        this.buttonZones.push(lz);
      }
      if (this.abilityPage < totalPages - 1) {
        const rt = this.add.text(W - 4, cy, '›', {
          fontFamily: 'monospace', fontSize: '16px', color: C.dim,
        }).setOrigin(1, 0.5);
        this.transient.push(rt);
        const rz = this.add.zone(W - arrowW - 4, ABILITY_Y, arrowW + 4, btnH).setOrigin(0, 0).setInteractive({ useHandCursor: true });
        rz.on('pointerdown', () => { this.abilityPage++; this.renderAll(); });
        this.buttonZones.push(rz);
      }
      // Page indicator dot row
      const dotY = ABILITY_Y + btnH + 3;
      for (let p = 0; p < totalPages; p++) {
        const dot = this.add.graphics();
        dot.fillStyle(p === this.abilityPage ? 0xa0ffdc : 0x2a3a50).fillCircle(W / 2 + (p - totalPages / 2 + 0.5) * 10, dotY, 3);
        this.transient.push(dot);
      }
    }
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

    // Header.
    const hdr = this.add.text(W / 2, STAGE_Y + 12, 'VEIN DISPENSER', { fontFamily: 'monospace', fontSize: '14px', color: C.yellow }).setOrigin(0.5, 0).setAlpha(0);
    const sub = this.add.text(W / 2, STAGE_Y + 34, `you hold ${vein} VEIN  ·  tap to buy`, { fontFamily: 'monospace', fontSize: '10px', color: C.dim }).setOrigin(0.5, 0).setAlpha(0);
    this.transient.push(hdr, sub);
    this.tweens.add({ targets: [hdr, sub], alpha: 1, duration: 200, ease: 'Sine.easeOut' });

    if (stock.length === 0) {
      this.transient.push(this.add.text(W / 2, STAGE_Y + 120, 'sold out', { fontFamily: 'monospace', fontSize: '12px', color: C.dim }).setOrigin(0.5));
      return;
    }

    // Bounded list: compress the row pitch so a full 4–6 item shelf always fits
    // the stage without colliding with the bottom button row. The natural pitch
    // is 66px and only shrinks when the shelf is full. LEAVE + the T-177 ad
    // refresh both live in renderButtons() now, so the cards own the whole stage.
    const top = STAGE_Y + 56;
    const { step, rowH } = this.listMetrics(top, stock.length, 66);
    const rowW = W - 32;

    stock.forEach((item, i) => {
      const price = this.session.dispenserPriceOf(item);
      const afford = vein >= price;
      const look = rarityLook(item.rarity);
      const accent = afford ? look.hex : GC.edge;
      const x = 16;
      const y = top + i * step;
      const cx = x + rowW / 2;
      const cy = y + rowH / 2;

      // Own Graphics per card — scale-pop entrance.
      const card = this.add.graphics().setAlpha(0).setScale(0.88).setPosition(cx, cy);
      card.fillStyle(afford ? 0x12243a : 0x0e1626).fillRoundedRect(-rowW / 2, -rowH / 2, rowW, rowH, 8);
      card.lineStyle(2, accent, afford ? 1 : 0.4).strokeRoundedRect(-rowW / 2, -rowH / 2, rowW, rowH, 8);
      card.fillStyle(accent, afford ? 0.9 : 0.3).fillRoundedRect(-rowW / 2, -rowH / 2, 4, rowH, 2);

      const nameT = this.add.text(x + 14, cy - 10, item.name, { fontFamily: 'monospace', fontSize: '12px', color: afford ? C.text : C.dim }).setOrigin(0, 0.5).setAlpha(0);
      const tagT = this.add.text(x + 14, cy + 9, `${item.category} · ${look.label}`, { fontFamily: 'monospace', fontSize: '9px', color: afford ? look.color : C.dim }).setOrigin(0, 0.5).setAlpha(0);
      const priceT = this.add.text(x + rowW - 12, cy, affordLabel(price, vein), {
        fontFamily: 'monospace', fontSize: '11px', color: afford ? C.green : C.red,
      }).setOrigin(1, 0.5).setAlpha(0);
      this.transient.push(card, nameT, tagT, priceT);
      this.tweens.add({ targets: card, alpha: 1, scale: 1, duration: 240, delay: i * 70, ease: 'Back.easeOut' });
      this.tweens.add({ targets: [nameT, tagT, priceT], alpha: 1, duration: 200, delay: i * 70 + 80, ease: 'Sine.easeOut' });

      if (afford) {
        const z = this.add.zone(x, y, rowW, rowH).setOrigin(0, 0).setInteractive({ useHandCursor: true });
        z.on('pointerdown', () => this.buyItem(item));
        this.buttonZones.push(z);
      }
    });
  }

  private itemRow(item: ItemDef, i: number, top: number, step: number, rowH: number, onTap?: () => void): void {
    const x = 16;
    const y = top + i * step;
    const w = W - 32;
    const cy = y + rowH / 2;
    const cursed = item.cursed === true;
    this.stage.fillStyle(cursed ? 0x2a1320 : 0x12243a).fillRoundedRect(x, y, w, rowH, 8);
    this.stage.lineStyle(1, cursed ? GC.boss : GC.btnBrd).strokeRoundedRect(x, y, w, rowH, 8);
    // When the list is full the rows compress; below ~44px the two-line layout
    // no longer fits, so name + tag collapse onto a single centred line.
    if (rowH < 44) {
      this.transient.push(
        this.add.text(x + 12, cy, item.name, { fontFamily: 'monospace', fontSize: '11px', color: cursed ? C.red : C.text }).setOrigin(0, 0.5),
        this.add.text(x + w - 12, cy, `${item.category} · ${item.rarity}${cursed ? ' · CURSED' : ''}`, { fontFamily: 'monospace', fontSize: '9px', color: cursed ? C.red : C.dim }).setOrigin(1, 0.5),
      );
    } else {
      this.transient.push(
        this.add.text(x + 12, cy - 10, item.name, { fontFamily: 'monospace', fontSize: '12px', color: cursed ? C.red : C.text }).setOrigin(0, 0.5),
        this.add.text(x + 12, cy + 9, `${item.category} · ${item.rarity}${cursed ? ' · CURSED' : ''}`, { fontFamily: 'monospace', fontSize: '9px', color: cursed ? C.red : C.dim }).setOrigin(0, 0.5),
        this.add.text(x + w - 12, cy, GameScene.modifierLine(item), { fontFamily: 'monospace', fontSize: '10px', color: C.green }).setOrigin(1, 0.5),
      );
    }
    if (onTap !== undefined) {
      const z = this.add.zone(x, y, w, rowH).setOrigin(0, 0).setInteractive({ useHandCursor: true });
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

    const cardW = W - 32;
    const top = STAGE_Y + 60;
    const { step, rowH: cardH } = this.listMetrics(top, pending.length, 60);

    // S027: each item card pops in with a Back-eased scale + fade, staggered;
    // rarity drives the accent colour, a banner, and (rare+) a pulsing aura.
    pending.forEach((item, i) => {
      const x = 16;
      const y = top + i * step;
      const cx = x + cardW / 2;
      const cy = y + cardH / 2;
      const cursed = item.cursed === true;
      const look = rarityLook(item.rarity);
      const accent = cursed ? GC.boss : look.hex;
      const glows = !cursed && rarityGlows(item.rarity);

      // Rare+ aura behind the card — a soft, slow pulse so the eye lands there.
      if (glows) {
        const aura = this.add.graphics().setAlpha(0);
        aura.fillStyle(look.hex, 0.18 + 0.18 * look.glow).fillRoundedRect(x - 4, y - 4, cardW + 8, cardH + 8, 10);
        this.transient.push(aura);
        this.tweens.add({
          targets: aura, alpha: { from: 0, to: 1 }, duration: 260, delay: i * 90,
          onComplete: () => this.tweens.add({
            targets: aura, alpha: 0.45, duration: 720, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
          }),
        });
      }

      // Per-item card (own Graphics so it can be scaled/faded from its centre).
      const card = this.add.graphics().setAlpha(0).setScale(0.85);
      card.fillStyle(cursed ? 0x2a1320 : 0x12243a).fillRoundedRect(-cardW / 2, -cardH / 2, cardW, cardH, 8);
      card.lineStyle(2, accent).strokeRoundedRect(-cardW / 2, -cardH / 2, cardW, cardH, 8);
      card.fillStyle(accent, 0.9).fillRoundedRect(-cardW / 2, -cardH / 2, 4, cardH, 2); // rarity spine
      card.setPosition(cx, cy);

      const nameT = this.add.text(x + 14, cy - 10, item.name, { fontFamily: 'monospace', fontSize: '12px', color: cursed ? C.red : C.text }).setOrigin(0, 0.5).setAlpha(0);
      const rarityTag = cursed ? 'CURSED' : look.label;
      const tagT = this.add.text(x + 14, cy + 9, `${item.category} · ${rarityTag}`, {
        fontFamily: 'monospace', fontSize: '9px', color: cursed ? C.red : look.color,
      }).setOrigin(0, 0.5).setAlpha(0);
      const modT = this.add.text(x + cardW - 12, cy, GameScene.modifierLine(item), { fontFamily: 'monospace', fontSize: '10px', color: C.green }).setOrigin(1, 0.5).setAlpha(0);

      this.transient.push(card, nameT, tagT, modT);

      this.tweens.add({ targets: card, alpha: 1, scale: 1, duration: 260, delay: i * 90, ease: 'Back.easeOut' });
      this.tweens.add({ targets: [nameT, tagT, modT], alpha: 1, duration: 220, delay: i * 90 + 80, ease: 'Sine.easeOut' });

      const z = this.add.zone(x, y, cardW, cardH).setOrigin(0, 0).setInteractive({ useHandCursor: true });
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
    const top = STAGE_Y + 78;
    const { step, rowH } = this.listMetrics(top, carried.length, 60);
    carried.forEach((item, i) => this.itemRow(item, i, top, step, rowH, item.cursed === true ? undefined : () => this.onSwapPick(item.id)));
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
    const top = STAGE_Y + 72;
    const { step, rowH } = this.listMetrics(top, items.length, 60);
    items.forEach((item, i) => this.itemRow(item, i, top, step, rowH, item.cursed === true ? undefined : () => this.onDropFromInventory(item.id)));
  }

  private strandCardRect(i: number): { x: number; y: number; w: number; h: number } {
    return { x: 16, y: STAGE_Y + 32 + i * 112, w: W - 32, h: 100 };
  }

  private renderStrand(): void {
    // T-191: dominant trait celebration overlay takes over the strand view.
    if (this.dominantTraitReveal.length > 0) {
      this.renderDominantTraitReveal();
      return;
    }

    // T-181: S060 not-skippable intro — first Strand Event of each run.
    if (!this.strandIntroShown) {
      this.renderStrandIntro();
      return;
    }

    const cards = this.session.strandOffer;

    // T-192: VEIN Intermission — polished gold panel.
    if (cards.length === 0) {
      this.renderIntermissionPanel();
      return;
    }

    // Title
    const proto = this.session.isProtoStrand();
    const titleT = this.add.text(W / 2, STAGE_Y + 8, proto ? 'PROTO-STRAND' : 'STRAND EVENT', {
      fontFamily: 'monospace', fontSize: '12px', color: C.green, letterSpacing: 4,
    }).setOrigin(0.5, 0);
    const subT = this.add.text(W / 2, STAGE_Y + 24, proto ? 'an early adaptation stirs — choose' : 'choose your mutation', {
      fontFamily: 'monospace', fontSize: '9px', color: C.dim,
    }).setOrigin(0.5, 0);
    this.transient.push(titleT, subT);

    // Owned families for T-184 synergy hint
    const ownedIds = this.session.snapshot.player.mutations;
    const ownedFamilies: MutationFamily[] = ownedIds
      .map((id) => this.mutationPool.find((m) => m.id === id))
      .filter((m): m is MutationDef => m !== undefined)
      .map((m) => m.family);

    const animate = this.strandAnimateCards;
    this.strandAnimateCards = null; // consume

    for (let i = 0; i < cards.length; i++) {
      const card = cards[i]!;
      const r = this.strandCardRect(i);
      const m = card.mutation;
      const selected = this.strandSelected === i;
      const confirming = selected && this.strandConfirmPending;
      const look = FAMILY_LOOK[m.family];
      const tierLook = TIER_LOOK[m.tier];

      // Card background — own Graphics so it can be scaled/faded from its centre (T-182).
      const cx = r.x + r.w / 2;
      const cy = r.y + r.h / 2;
      const hw = r.w / 2;
      const hh = r.h / 2;
      const cardG = this.add.graphics();
      cardG.fillStyle(selected ? look.bgHex : 0x0c1220);
      cardG.fillRoundedRect(-hw, -hh, r.w, r.h, 8);
      cardG.lineStyle(confirming ? 2 : selected ? 2 : 1, confirming ? 0xffdd44 : selected ? look.accentHex : 0x1e2a40);
      cardG.strokeRoundedRect(-hw, -hh, r.w, r.h, 8);
      // Family spine (T-183)
      cardG.fillStyle(look.accentHex, selected ? 1.0 : 0.5);
      cardG.fillRoundedRect(-hw, -hh, 4, r.h, { tl: 8, bl: 8, tr: 0, br: 0 } as unknown as number);
      cardG.setPosition(cx, cy);

      // Header: family · tier badge
      const wild = card.slot === 'wild' ? '  ·  WILD' : '';
      const headerT = this.add.text(r.x + 14, r.y + 8, `${m.family.toUpperCase()}${wild}`, {
        fontFamily: 'monospace', fontSize: '8px', color: look.accentLabel,
      });
      // Tier badge — top right
      const tierT = this.add.text(r.x + r.w - 12, r.y + 8, tierLook.badge, {
        fontFamily: 'monospace', fontSize: '8px', color: tierLook.label,
      }).setOrigin(1, 0);
      // Mutation name
      const nameT = this.add.text(r.x + 14, r.y + 22, m.name, {
        fontFamily: 'monospace', fontSize: '13px',
        color: confirming ? C.yellow : selected ? look.accentLabel : C.text,
      });
      // Passive + active
      const passiveT = this.add.text(r.x + 14, r.y + 44, `Passive: ${GameScene.modifierSummary(m)}`, {
        fontFamily: 'monospace', fontSize: '9px', color: C.green,
      });
      const activeT = this.add.text(r.x + 14, r.y + 60, `Active: ${GameScene.abilitySummary(m)}`, {
        fontFamily: 'monospace', fontSize: '9px', color: C.green,
      });
      // SIG bonus
      const sigT = this.add.text(r.x + 14, r.y + 80, `SIG +${m.sigBonus}`, {
        fontFamily: 'monospace', fontSize: '8px', color: C.dim,
      });
      // Reroll available indicator on selected card (T-186)
      const rerollIndicator = (selected && !this.strandRerollUsed)
        ? this.add.text(r.x + r.w - 12, r.y + 80, '↺ reroll', {
            fontFamily: 'monospace', fontSize: '8px', color: C.yellow,
          }).setOrigin(1, 0)
        : null;

      const textObjs = [headerT, tierT, nameT, passiveT, activeT, sigT];
      if (rerollIndicator !== null) textObjs.push(rerollIndicator);
      this.transient.push(cardG, ...textObjs);

      // T-182/T-188: entrance animation for new or rerolled card
      const shouldAnimate = animate === 'all' || animate === i;
      if (shouldAnimate) {
        const delay = animate === 'all' ? i * 70 : 0;
        cardG.setAlpha(0).setScale(0.88);
        for (const t of textObjs) t.setAlpha(0);
        this.tweens.add({
          targets: cardG, alpha: 1, scaleX: 1, scaleY: 1,
          duration: 220, delay, ease: 'Back.easeOut',
        });
        this.tweens.add({
          targets: textObjs, alpha: 1,
          duration: 180, delay: delay + 80, ease: 'Sine.easeOut',
        });
      }

      // Hit zone
      const z = this.add.zone(r.x, r.y, r.w, r.h).setOrigin(0, 0).setInteractive({ useHandCursor: true });
      z.on('pointerdown', () => this.onStrandPointer(r.x + 1, r.y + 1));
      this.buttonZones.push(z);
    }

    // T-184: Detail strip below the three cards (family lore + synergy hint).
    const detailY = STAGE_Y + 32 + 3 * 112 + 4;
    if (this.strandSelected !== null && !this.strandConfirmPending && detailY < STAGE_Y + 430) {
      const card = cards[this.strandSelected]!;
      const m = card.mutation;
      const look = FAMILY_LOOK[m.family];
      const ownedInFamily = familyCountIn(m.family, ownedFamilies);
      const afterTake = ownedInFamily + 1;
      const needed = 3 - afterTake;
      const synergyHint = needed <= 0
        ? '✦ Taking this card unlocks a DOMINANT TRAIT'
        : `${afterTake} of 3 — ${needed} more ${m.family} to unlock Dominant Trait`;

      this.transient.push(
        this.add.text(24, detailY, look.lore, {
          fontFamily: 'monospace', fontSize: '9px', color: look.accentLabel,
        }),
        this.add.text(24, detailY + 16, synergyHint, {
          fontFamily: 'monospace', fontSize: '9px',
          color: needed <= 0 ? C.yellow : C.dim,
        }),
      );
    }

    // T-185: confirm hint strip
    if (this.strandSelected !== null && this.strandConfirmPending) {
      this.transient.push(
        this.add.text(W / 2, detailY, 'tap TAKE again to confirm', {
          fontFamily: 'monospace', fontSize: '9px', color: C.yellow,
        }).setOrigin(0.5, 0),
        this.add.text(W / 2, detailY + 16, 'mutations are permanent for this run', {
          fontFamily: 'monospace', fontSize: '8px', color: C.dim,
        }).setOrigin(0.5, 0),
      );
    }
  }

  /**
   * T-181: S060 Strand Event intro — shown once per run before the first
   * card offer. A brief LACE narration explains the mutation process.
   * A CONTINUE button appears after a 600ms lock so accidental taps don't
   * skip it; the intro is intentionally short (one screen, no scroll).
   */
  private renderStrandIntro(): void {
    const cardW = W - 32;
    const cardH = 310;
    const cx = W / 2;
    const cy = STAGE_Y + STAGE_H / 2;

    const card = this.add.graphics().setAlpha(0);
    card.fillStyle(0x0a1220).fillRoundedRect(-cardW / 2, -cardH / 2, cardW, cardH, 12);
    card.lineStyle(2, 0xa0ffdc, 0.6).strokeRoundedRect(-cardW / 2, -cardH / 2, cardW, cardH, 12);
    card.setPosition(cx, cy);
    this.transient.push(card);

    const mk = (x: number, y: number, text: string, style: Phaser.Types.GameObjects.Text.TextStyle): Phaser.GameObjects.Text => {
      const t = this.add.text(x, y, text, { fontFamily: 'monospace', ...style }).setAlpha(0);
      this.transient.push(t);
      return t;
    };

    const label = mk(cx, cy - cardH / 2 + 20, 'STRAND EVENT', {
      fontSize: '11px', color: C.green, letterSpacing: 4,
    } as Phaser.Types.GameObjects.Text.TextStyle).setOrigin(0.5, 0);

    const headline = mk(cx, cy - cardH / 2 + 46, 'THE VEIN OFFERS', {
      fontSize: '18px', color: C.text, letterSpacing: 4,
    } as Phaser.Types.GameObjects.Text.TextStyle).setOrigin(0.5, 0);

    const body = mk(cx, cy - cardH / 2 + 84, [
      'Deep within the VEIN, your genome responds',
      'to pressure. Choose one mutation to integrate',
      'permanently into your biological architecture.',
      '',
      'Each family has its own resonance.',
      'Three mutations from one family unlock',
      'a Dominant Trait — a systemic transformation',
      'that reshapes how you fight.',
    ].join('\n'), {
      fontSize: '10px', color: C.dim, lineSpacing: 4, align: 'center',
      wordWrap: { width: cardW - 48 },
    } as Phaser.Types.GameObjects.Text.TextStyle).setOrigin(0.5, 0);

    // CONTINUE button — locked for 600ms so an accidental tap can't skip it
    const btnW = 180;
    const btnH = 40;
    const btnX = cx - btnW / 2;
    const btnY = cy + cardH / 2 - btnH - 16;
    const btnG = this.add.graphics().setAlpha(0);
    btnG.fillStyle(0x1a3028).fillRoundedRect(btnX, btnY, btnW, btnH, 10);
    btnG.lineStyle(2, 0xa0ffdc).strokeRoundedRect(btnX, btnY, btnW, btnH, 10);
    this.transient.push(btnG);
    const btnT = mk(cx, btnY + btnH / 2, 'CONTINUE', {
      fontSize: '14px', color: C.green, letterSpacing: 3,
    } as Phaser.Types.GameObjects.Text.TextStyle).setOrigin(0.5);

    const objs = [card, label, headline, body, btnG, btnT];

    this.tweens.add({
      targets: objs, alpha: 1, duration: 220, ease: 'Back.easeOut',
      onComplete: () => {
        // Unlock the CONTINUE tap after 600ms
        this.time.delayedCall(600, () => {
          const zone = this.add
            .zone(btnX, btnY, btnW, btnH)
            .setOrigin(0, 0)
            .setInteractive({ useHandCursor: true });
          this.transient.push(zone);
          zone.on('pointerdown', () => {
            this.strandIntroShown = true;
            this.renderAll();
          });
        });
      },
    });
  }

  /** T-192: polished VEIN Intermission panel with entrance animation. */
  private renderIntermissionPanel(): void {
    const cardW = W - 32;
    const cardH = 170;
    const cardX = 16;
    const cardY = STAGE_Y + (430 - cardH) / 2;
    const cx = cardX + cardW / 2;
    const cy = cardY + cardH / 2;

    const panelG = this.add.graphics().setAlpha(0).setScale(0.9);
    panelG.fillStyle(0x1a1608);
    panelG.fillRoundedRect(-cardW / 2, -cardH / 2, cardW, cardH, 12);
    panelG.lineStyle(2, 0xbbaa22);
    panelG.strokeRoundedRect(-cardW / 2, -cardH / 2, cardW, cardH, 12);
    // Gold spine
    panelG.fillStyle(0xbbaa22, 0.8);
    panelG.fillRoundedRect(-cardW / 2, -cardH / 2, 5, cardH, { tl: 12, bl: 12, tr: 0, br: 0 } as unknown as number);
    panelG.setPosition(cx, cy);
    this.transient.push(panelG);
    this.tweens.add({ targets: panelG, alpha: 1, scaleX: 1, scaleY: 1, duration: 280, ease: 'Back.easeOut' });

    const snap = this.session.snapshot;
    const vcBalance = snap.veinCrystals ?? 0;

    const texts = [
      this.add.text(W / 2, cardY + 22, 'VEIN INTERMISSION', {
        fontFamily: 'monospace', fontSize: '15px', color: C.yellow, letterSpacing: 3,
      }).setOrigin(0.5, 0).setAlpha(0),
      this.add.text(W / 2, cardY + 50, 'Genetic saturation reached — 4 mutations held.', {
        fontFamily: 'monospace', fontSize: '9px', color: C.dim,
      }).setOrigin(0.5, 0).setAlpha(0),
      this.add.text(W / 2, cardY + 80, '+100 VEIN Crystals', {
        fontFamily: 'monospace', fontSize: '16px', color: C.green,
      }).setOrigin(0.5, 0).setAlpha(0),
      this.add.text(W / 2, cardY + 108, `Balance: ${vcBalance + 100} VC after bonus`, {
        fontFamily: 'monospace', fontSize: '9px', color: C.dim,
      }).setOrigin(0.5, 0).setAlpha(0),
      this.add.text(W / 2, cardY + 134, 'The strands will not accept more. But VEIN endures.', {
        fontFamily: 'monospace', fontSize: '8px', color: '#5a6a80',
        wordWrap: { width: cardW - 32 },
      }).setOrigin(0.5, 0).setAlpha(0),
    ];
    this.transient.push(...texts);
    this.tweens.add({ targets: texts, alpha: 1, duration: 200, delay: 120, ease: 'Sine.easeOut' });
  }

  /** T-191: Dominant Trait unlock celebration overlay shown inside the strand view. */
  private renderDominantTraitReveal(): void {
    const traits = this.dominantTraitReveal.map((f) => dominantTraitFor(f));
    const family = this.dominantTraitReveal[0]!;
    const look = FAMILY_LOOK[family];
    const trait = traits[0]!;

    const cardW = W - 24;
    const cardH = 210;
    const cardX = 12;
    const cardY = STAGE_Y + (430 - cardH) / 2;
    const cx = cardX + cardW / 2;
    const cy = cardY + cardH / 2;

    // Background dim
    const dim = this.add.graphics().setAlpha(0).setDepth(3);
    dim.fillStyle(0x000000, 0.7).fillRect(0, STAGE_Y, W, 430);
    this.transient.push(dim);
    this.tweens.add({ targets: dim, alpha: 1, duration: 200 });

    // Gold burst card
    const panelG = this.add.graphics().setAlpha(0).setScale(0.8).setDepth(3);
    panelG.fillStyle(look.bgHex);
    panelG.fillRoundedRect(-cardW / 2, -cardH / 2, cardW, cardH, 14);
    panelG.lineStyle(3, look.accentHex);
    panelG.strokeRoundedRect(-cardW / 2, -cardH / 2, cardW, cardH, 14);
    // Thick spine
    panelG.fillStyle(look.accentHex, 1.0);
    panelG.fillRoundedRect(-cardW / 2, -cardH / 2, 6, cardH, { tl: 14, bl: 14, tr: 0, br: 0 } as unknown as number);
    panelG.setPosition(cx, cy);
    this.transient.push(panelG);
    this.tweens.add({ targets: panelG, alpha: 1, scaleX: 1, scaleY: 1, duration: 360, ease: 'Back.easeOut', delay: 80 });

    const texts = [
      this.add.text(W / 2, cardY + 16, 'DOMINANT TRAIT UNLOCKED', {
        fontFamily: 'monospace', fontSize: '11px', color: look.accentLabel, letterSpacing: 3,
      }).setOrigin(0.5, 0).setAlpha(0).setDepth(3),
      this.add.text(W / 2, cardY + 42, `✦  ${trait.name}  ✦`, {
        fontFamily: 'monospace', fontSize: '18px', color: C.yellow,
      }).setOrigin(0.5, 0).setAlpha(0).setDepth(3),
      this.add.text(W / 2, cardY + 78, trait.description, {
        fontFamily: 'monospace', fontSize: '10px', color: C.text,
        wordWrap: { width: cardW - 40 },
      }).setOrigin(0.5, 0).setAlpha(0).setDepth(3),
      this.add.text(W / 2, cardY + 130, family.toUpperCase() + '  FAMILY', {
        fontFamily: 'monospace', fontSize: '9px', color: look.accentLabel, letterSpacing: 4,
      }).setOrigin(0.5, 0).setAlpha(0).setDepth(3),
      this.add.text(W / 2, cardY + 158, 'three mutations of one family — the threshold is crossed', {
        fontFamily: 'monospace', fontSize: '8px', color: C.dim,
        wordWrap: { width: cardW - 40 },
      }).setOrigin(0.5, 0).setAlpha(0).setDepth(3),
    ];
    this.transient.push(...texts);
    this.tweens.add({ targets: texts, alpha: 1, duration: 220, delay: 320, ease: 'Sine.easeOut' });
  }


  // ── Buttons ───────────────────────────────────────────────────────────────

  private renderButtons(): void {
    if (this.view === 'strand') {
      // T-191: no buttons during dominant trait celebration (tap anywhere to continue)
      if (this.dominantTraitReveal.length > 0) {
        this.button(20, 'CONTINUE', C.green, () => {
          this.dominantTraitReveal = [];
          this.view = 'map';
          this.renderAll();
        });
        return;
      }
      const cards = this.session.strandOffer;
      // T-192: VEIN Intermission
      if (cards.length === 0) { this.button(20, 'CONTINUE', C.yellow, () => this.continueIntermission()); return; }
      if (this.strandSelected !== null) {
        // T-185: TAKE label changes to signal confirm-pending state
        const takeLabel = this.strandConfirmPending ? 'CONFIRM TAKE' : 'TAKE';
        const takeColor = this.strandConfirmPending ? C.yellow : C.green;
        this.button(20, takeLabel, takeColor, () => this.takeStrandCard());
        // The Floor 2 Proto-Strand offers no reroll (DR-009b, T-511).
        if (!this.strandRerollUsed && !this.session.isProtoStrand()) {
          this.button(210, 'REROLL', C.yellow, () => this.rerollStrandCard());
        }
      }
      return;
    }
    if (this.view === 'combat') {
      if (this.combat?.phase === 'player' && !this.revealingEnemies && !this.combatMenuOpen && !this.enemySeqActive) {
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
    if (this.view === 'event') {
      if (this.eventOutcome !== null) this.button(20, 'CONTINUE', C.green, () => this.leaveEventRoom());
      return;
    }
    if (this.view === 'safe') { this.button(20, 'CONTINUE', C.green, () => this.leaveSafeRoom()); return; }
    if (this.view === 'shop') {
      this.button(20, 'LEAVE', C.green, () => this.leaveDispenser());
      // T-177: ad refresh shares the standard button row (one per visit, only
      // while the ad service can offer) so it matches LEAVE instead of being a
      // second, differently-styled button overlapping the shelf.
      if (adService.canOffer().allowed && !this.shopAdRefreshUsed) {
        this.button(210, '↻ REFRESH', C.yellow, () => void this.shopAdRefresh());
      }
      return;
    }
    if (this.view === 'loot') { this.button(20, 'LEAVE', C.dim, () => this.leaveLoot()); return; }
    if (this.view === 'swap') { this.button(20, 'LEAVE IT', C.dim, () => this.leaveSwap()); return; }
    if (this.view === 'inventory') { this.button(20, 'CLOSE', C.green, () => this.closeInventory()); return; }
    if (this.view === 'levelup') return;
    if (this.view === 'map' && this.session.snapshot.status === 'floor_complete') {
      // S072 (DR-009, T-510): an act end offers Descend / Rest; ordinary floor
      // completes keep the single DESCEND.
      this.button(20, 'DESCEND', C.yellow, () => this.descendFloor());
      if (this.session.checkpoint() !== null) {
        this.button(210, 'REST', C.dim, () => this.restAtCheckpoint());
      }
      return;
    }
  }

  /** Row pitch + card height that fit `count` rows between `top` and the stage
   *  bottom, never exceeding the natural pitch. Keeps list views (shop, loot,
   *  inventory, swap) off the bottom button row no matter how many items show. */
  private listMetrics(top: number, count: number, naturalStep = 60, gap = 8): { step: number; rowH: number } {
    if (count <= 0) return { step: naturalStep, rowH: naturalStep - gap };
    const avail = STAGE_Y + STAGE_H - top;
    const step = Math.min(naturalStep, Math.floor(avail / count));
    return { step, rowH: step - gap };
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

  /** T-159: glyph for a scripted boss wind-up telegraph. */
  private telegraphIcon(telegraph: NonNullable<RunState['enemies'][number]['telegraph']>): string {
    switch (telegraph) {
      case 'melee': return '⚔';
      case 'ranged': return '➹';
      case 'defense': return '◈';
      case 'move': return '»';
      case 'special': return '✦';
      default: return '!';
    }
  }

  /** Returns a "min–max" or single value attack damage range string for the preview. */


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
