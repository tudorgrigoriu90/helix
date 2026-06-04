import Phaser from 'phaser';
import type { EnemyDef } from '@shared-types/enemy';
import type { FloorTemplate } from '@shared-types/floor-template';
import type { PopulatedRoom } from '@shared-types/floor-plan';
import type { RunState } from '@shared-types/run-state';
import type { Action } from '@shared-types/action';
import type { MutationDef } from '@shared-types/mutation';
import type { ItemDef } from '@shared-types/item';
import type { MetaState } from '@shared-types/meta-state';
import { buildFloorZero, FLOOR_ZERO_ROOM_IDS } from '../core/floor-gen/floor-zero';
import { parseEnemyDef } from '../core/content/enemy-loader';
import { parseMutationDef } from '../core/content/mutation-loader';
import { RunSession, buildEnemyRegistry, type EnemyRegistry } from '../core/run';
import { TurnEngine } from '../core/turn-engine/turn-engine';
import { chebyshev } from '../core/turn-engine/grid';
import { Mulberry32, makeRng } from '../core/rng/mulberry32';
import { SaveManager } from '../core/save/save-manager';
import { metaCodec, newMetaState, completeTutorial } from '../core/save';
import { createWebStorageAdapter } from '../platform/storage-web';
import { computeBounds, computeLayout, project, type Bounds, type LayoutTransform } from './floor-graph-layout';

import filterer from '@content/enemies/filterer.json';
import pressureWarden from '@content/enemies/pressure_warden.json';
// The tutorial Strand offers two fixed, downside-free cards ("2 safe cards").
import crushDepth from '@content/mutations/abyssal_crush_depth.json';
import carapace from '@content/mutations/lithic_carapace.json';

/**
 * TutorialScene — the scripted Floor 0 descent (S012–S016, TDD §21 Q4).
 *
 * Runs the hardcoded Floor 0 (T-137) through the real run loop (RunSession in
 * tutorial mode, T-138) so the tutorial exercises the same engine a normal run
 * does — no bespoke logic to drift. Each room teaches one mechanic, gated so the
 * player can't skip ahead:
 *
 *   - Room 1 (entry):  movement — tap the lit chamber to advance   (S012, T-138)
 *   - Room 2 (combat): first fight                                  (S013, T-139)
 *   - Room 3 (strand): a 2-card micro Strand Event                  (S014, T-140)
 *   - Room 4 (boss):   tutorial boss, teaches item use; the kill    (S015, T-141)
 *                      grants First Convergence + marks tutorial done (S016, T-142)
 *
 * This commit lands Room 1 + the scene spine; later rooms fill in their gated
 * stubs. Phaser scene — gated by build, not unit tests (repo convention).
 */

const HEADER_Y = 16;
const GUIDE_Y = 48;
const VIEWPORT_Y = 138;
const VIEWPORT_H = 460;
const LOG_Y = VIEWPORT_Y + VIEWPORT_H + 20;
const NODE_RADIUS = 18;

const H = {
  bg: 0x070b14,
  viewportBorder: 0x1e2a40,
  edge: 0x3a4868,
  nodeLocked: 0x2a3450,
  nodeCleared: 0x35506a,
  nodeCurrent: 0xa0ffdc,
  nodeExit: 0xffd479,
  nodeBoss: 0xff4444,
  nodeOutline: 0x0a0e1a,
  ring: 0xffffff,
};
const C = { lace: '#a0ffdc', dim: '#7a8fad', label: '#0a0e1a', primary: '#e8edf5' };

/** Rooms whose mechanic isn't wired yet — onward progress stops here until the
 *  owning task lands. All four rooms are now playable (T-138→T-141). */
const PENDING_ROOMS = new Set<string>();

/** Scripted LACE guidance shown on entering each room (the tutorial's voice). */
const GUIDANCE: Record<string, string> = {
  [FLOOR_ZERO_ROOM_IDS.entry]:
    'LACE: You are inside the VEIN now. Nothing here will hurt you yet.\nTap the lit chamber ahead to move.',
  [FLOOR_ZERO_ROOM_IDS.combat]:
    'LACE: Something is alive in here. You will have to deal with it.\n[first combat — T-139]',
  [FLOOR_ZERO_ROOM_IDS.strand]:
    'LACE: The VEIN is offering to change you. This is a Strand Event — pick one.',
  [FLOOR_ZERO_ROOM_IDS.boss]:
    'LACE: This one has a name. Names mean trouble.\nLow on health? Tap an item to use it, then finish this.',
};

export class TutorialScene extends Phaser.Scene {
  private enemyRegistry!: EnemyRegistry;
  private session!: RunSession;
  private metaSaves!: SaveManager<MetaState>;
  private meta: MetaState = newMetaState();
  private tutorialDone = false;

  private view: 'map' | 'combat' | 'strand' = 'map';
  private combat: RunState | null = null;
  private combatRng!: Mulberry32;
  private strandOffer: readonly MutationDef[] = [];
  private strandResolved = false;

  private guideText!: Phaser.GameObjects.Text;
  private hudText!: Phaser.GameObjects.Text;
  private logText!: Phaser.GameObjects.Text;
  private graphGfx!: Phaser.GameObjects.Graphics;
  private readonly logLines: string[] = [];
  private dynamic: Phaser.GameObjects.GameObject[] = [];

  constructor() {
    super({ key: 'TutorialScene' });
  }

  create(): void {
    this.loadContent();
    // Persistent profile (own namespace) — the tutorial banks First Convergence
    // + the tutorial-complete flag into it on the boss kill (T-142).
    this.metaSaves = new SaveManager(createWebStorageAdapter(), metaCodec, 'helix.meta');
    void this.metaSaves.load().then((res) => {
      if (res !== null && res.ok) this.meta = res.value;
    });
    this.session = new RunSession({
      seed: 0,
      template: TUTORIAL_TEMPLATE,
      registry: this.enemyRegistry,
      floorZero: buildFloorZero({ combatEnemyId: 'filterer', bossId: 'pressure_warden' }),
    });

    this.add.graphics().fillStyle(H.bg).fillRect(0, 0, this.scale.width, this.scale.height);

    this.add.text(16, HEADER_Y, 'FLOOR 0 — TUTORIAL', { fontFamily: 'monospace', fontSize: '13px', color: C.lace });

    this.guideText = this.add.text(16, GUIDE_Y, '', {
      fontFamily: 'monospace', fontSize: '11px', color: C.primary, lineSpacing: 4, wordWrap: { width: this.scale.width - 32 },
    });

    this.hudText = this.add.text(16, VIEWPORT_Y - 22, '', { fontFamily: 'monospace', fontSize: '10px', color: C.dim });
    this.add.graphics().lineStyle(1, H.viewportBorder).strokeRect(8, VIEWPORT_Y - 4, this.scale.width - 16, VIEWPORT_H + 8);
    this.graphGfx = this.add.graphics();

    this.add.text(16, LOG_Y, '— LOG —', { fontFamily: 'monospace', fontSize: '9px', color: C.dim });
    this.logText = this.add.text(16, LOG_Y + 14, '', { fontFamily: 'monospace', fontSize: '9px', color: C.dim, lineSpacing: 2 });

    // Combat-grid taps go through one handler (map taps use per-room zones).
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (this.view === 'combat') this.onCombatTap(p.x, p.y);
    });

    this.pushLog('Tutorial descent begins.');
    this.render();
  }

  private loadContent(): void {
    const defs: EnemyDef[] = [filterer, pressureWarden].map((raw) => {
      const res = parseEnemyDef(raw);
      if (!res.ok) throw new Error(`TutorialScene: bad enemy content — ${res.error.message}`);
      return res.enemy;
    });
    this.enemyRegistry = buildEnemyRegistry(defs);

    this.strandOffer = [crushDepth, carapace].map((raw) => {
      const res = parseMutationDef(raw);
      if (!res.ok) throw new Error(`TutorialScene: bad mutation content — ${res.error.message}`);
      return res.mutation;
    });
  }

  // ── Exploration ──────────────────────────────────────────────────────────

  /** Exits the player may take. Gated two ways: an unfought combat room blocks
   *  until cleared, and rooms whose mechanic isn't built yet block onward progress
   *  (each later task removes its room from {@link PENDING_ROOMS}). */
  private exits(): string[] {
    if (this.session.needsCombat()) return []; // must resolve this room first
    if (PENDING_ROOMS.has(this.session.snapshot.currentRoomId)) return [];
    return this.session.adjacentRooms();
  }

  private moveTo(id: string): void {
    this.session.moveTo(id);
    this.pushLog(`→ ${id}`);
    if (this.session.needsCombat()) this.startCombat();
    else if (id === FLOOR_ZERO_ROOM_IDS.strand && !this.strandResolved) this.openStrand();
    else this.render();
  }

  // ── Strand Event (T-140) ────────────────────────────────────────────────────

  private openStrand(): void {
    this.view = 'strand';
    this.pushLog('A Strand Event — choose what to become.');
    this.render();
  }

  /** Takes a tutorial Strand card: applies the mutation to the run, then opens
   *  the way onward. A scripted, downside-free intro to the real Strand Event. */
  private chooseStrandCard(mutation: MutationDef): void {
    this.session.applyMutationChoice(mutation);
    this.strandResolved = true;
    this.view = 'map';
    this.pushLog(`Became: ${mutation.name}.`);
    this.render();
  }

  // ── Combat (T-139) ─────────────────────────────────────────────────────────

  private startCombat(): void {
    const encounter = this.session.beginEncounter();
    if (encounter === null) {
      this.render();
      return;
    }
    this.combat = encounter;
    this.combatRng = makeRng(encounter.seed, 'combat');
    this.session.syncCombat(encounter, this.combatRng.state); // T-114 hook
    this.view = 'combat';
    this.pushLog('Combat! Tap to move; tap the foe when adjacent.');
    this.render();
  }

  /** Maps a screen tap to a grid action: attack an adjacent foe, else step one tile. */
  private onCombatTap(x: number, y: number): void {
    const state = this.combat;
    if (state === null) return;
    const tile = this.combatTile(state);
    const col = Math.floor((x - this.combatGridX(state)) / tile);
    const row = Math.floor((y - VIEWPORT_Y) / tile);
    if (col < 0 || row < 0 || col >= state.grid.width || row >= state.grid.height) return;

    const foe = state.enemies.find((e) => e.hp > 0 && e.pos.x === col && e.pos.y === row);
    if (foe !== undefined) {
      if (chebyshev(state.player.pos, { x: col, y: row }) <= 1) this.combatAction({ type: 'attack', targetId: foe.id });
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
      this.session.syncCombat(result.state, this.combatRng.state);
      if (result.state.phase !== 'player' && result.state.phase !== 'enemy') {
        this.endCombat(result.state);
        return;
      }
    }
    this.render();
  }

  private endCombat(finalState: RunState): void {
    this.session.endEncounter(finalState);
    this.combat = null;
    this.view = 'map';
    const status = this.session.snapshot.status;
    if (status === 'defeat') {
      this.pushLog('You fell. The VEIN is patient — try again.');
      this.restart();
      return;
    }
    if (status === 'floor_complete' || status === 'victory') {
      // The Floor 0 boss is down — the tutorial is complete (T-141).
      this.onTutorialComplete();
      return;
    }
    this.pushLog('Cleared. The way ahead opens.');
    this.render();
  }

  /** Floor 0 boss down (T-142): grant First Convergence + mark the tutorial
   *  complete in the persistent profile, then close out the descent. Idempotent. */
  private onTutorialComplete(): void {
    if (!this.tutorialDone) {
      this.tutorialDone = true;
      this.meta = completeTutorial(this.meta);
      void this.metaSaves.save(this.meta);
      this.pushLog('★ Achievement unlocked: First Convergence.');
    }
    this.pushLog('The tutorial boss falls. You survived Floor 0.');
    this.guideText.setText('LACE: First Convergence. You are no longer quite what you were.\nThe shallows are behind you — the VEIN goes deeper.');
    this.render();
  }

  /** Uses a consumable: heals fire on self; offensive items auto-aim the foe
   *  (no targeting step — the tutorial keeps item use to a single tap). */
  private useItem(item: ItemDef): void {
    const state = this.combat;
    if (state === null) return;
    if (item.effect?.kind === 'heal') {
      this.combatAction({ type: 'useItem', itemId: item.id });
      return;
    }
    const foe = state.enemies.find((e) => e.hp > 0);
    if (foe !== undefined) this.combatAction({ type: 'useItem', itemId: item.id, targetPos: foe.pos });
  }

  /** Tutorial deaths aren't punishing — rewind to a fresh Floor 0. */
  private restart(): void {
    this.session = new RunSession({
      seed: 0,
      template: TUTORIAL_TEMPLATE,
      registry: this.enemyRegistry,
      floorZero: buildFloorZero({ combatEnemyId: 'filterer', bossId: 'pressure_warden' }),
    });
    this.render();
  }

  private combatTile(state: RunState): number {
    return Math.floor(Math.min(this.scale.width - 16, VIEWPORT_H) / Math.max(state.grid.width, state.grid.height));
  }

  private combatGridX(state: RunState): number {
    return Math.floor((this.scale.width - this.combatTile(state) * state.grid.width) / 2);
  }

  // ── Rendering ──────────────────────────────────────────────────────────────

  private render(): void {
    for (const obj of this.dynamic) obj.destroy();
    this.dynamic = [];
    this.graphGfx.clear();
    if (this.view === 'combat') {
      this.renderCombat();
      return;
    }
    if (this.view === 'strand') {
      this.renderStrand();
      return;
    }
    this.renderMap();
  }

  private renderMap(): void {
    const floor = this.session.floor;
    const current = this.session.snapshot.currentRoomId;
    const bossId = floor.bossRoomId;

    this.guideText.setText(GUIDANCE[current] ?? 'LACE: Keep moving.');

    const bounds: Bounds = computeBounds(floor.rooms);
    const transform: LayoutTransform = computeLayout(
      bounds,
      { x: 8, y: VIEWPORT_Y, width: this.scale.width - 16, height: VIEWPORT_H },
      { padding: 40, minScale: 26, maxScale: 90 },
    );

    this.graphGfx.lineStyle(2, H.edge, 0.9);
    const byId = new Map(floor.rooms.map((r) => [r.id, r]));
    for (const edge of floor.edges) {
      const a = byId.get(edge.from);
      const b = byId.get(edge.to);
      if (!a || !b) continue;
      const pa = project(a.pos, bounds, transform);
      const pb = project(b.pos, bounds, transform);
      this.graphGfx.lineBetween(pa.x, pa.y, pb.x, pb.y);
    }

    const exitSet = new Set(this.exits());
    const cleared = new Set(this.session.snapshot.clearedRoomIds);
    for (const room of floor.rooms) {
      const p = project(room.pos, bounds, transform);
      const isCurrent = room.id === current;
      const isExit = exitSet.has(room.id);
      const fill = isCurrent ? H.nodeCurrent
        : isExit ? H.nodeExit
        : room.id === bossId ? H.nodeBoss
        : cleared.has(room.id) ? H.nodeCleared
        : H.nodeLocked;

      this.graphGfx.lineStyle(2, H.nodeOutline, 1);
      this.graphGfx.fillStyle(fill, 1);
      this.graphGfx.fillCircle(p.x, p.y, NODE_RADIUS);
      this.graphGfx.strokeCircle(p.x, p.y, NODE_RADIUS);
      if (isCurrent) this.graphGfx.lineStyle(2, H.ring, 1).strokeCircle(p.x, p.y, NODE_RADIUS + 4);

      this.dynamic.push(
        this.add.text(p.x, p.y, roomGlyph(room), { fontFamily: 'monospace', fontSize: '9px', color: C.label }).setOrigin(0.5),
      );

      if (isExit) {
        const zone = this.add.zone(p.x - NODE_RADIUS, p.y - NODE_RADIUS, NODE_RADIUS * 2, NODE_RADIUS * 2)
          .setOrigin(0, 0).setInteractive({ useHandCursor: true });
        zone.on('pointerdown', () => this.moveTo(room.id));
        this.dynamic.push(zone);
      }
    }

    this.hudText.setText(`here: ${current}   cleared: ${cleared.size}/${floor.rooms.length}`);

    // Once the tutorial is cleared, the only way onward is the Hub — there's no
    // dev tab bar to leave by anymore, so surface an explicit exit.
    if (this.tutorialDone) this.renderExitButton();
  }

  /** "CONTINUE" button shown after the tutorial boss falls — leads to the Hub,
   *  where the player chooses to enter the VEIN for real or replay the tutorial. */
  private renderExitButton(): void {
    const bw = 240;
    const bh = 52;
    const bx = (this.scale.width - bw) / 2;
    const by = 770;
    this.graphGfx.fillStyle(0x1a3028, 1).fillRoundedRect(bx, by, bw, bh, 8);
    this.graphGfx.lineStyle(2, H.nodeCurrent, 1).strokeRoundedRect(bx, by, bw, bh, 8);
    this.dynamic.push(
      this.add.text(bx + bw / 2, by + bh / 2, 'CONTINUE  ›', {
        fontFamily: 'monospace', fontSize: '15px', color: C.lace,
      }).setOrigin(0.5),
    );
    const zone = this.add.zone(bx, by, bw, bh).setOrigin(0, 0).setInteractive({ useHandCursor: true });
    zone.on('pointerdown', () => this.scene.start('HubScene', { meta: this.meta }));
    this.dynamic.push(zone);
  }

  private renderCombat(): void {
    const state = this.combat;
    if (state === null) return;
    this.guideText.setText('LACE: Close the distance, then strike when you stand beside it.\nEND TURN when your AP is spent.');

    const tile = this.combatTile(state);
    const gx = this.combatGridX(state);
    const gy = VIEWPORT_Y;

    for (let y = 0; y < state.grid.height; y++) {
      for (let x = 0; x < state.grid.width; x++) {
        const open = state.grid.tiles[y * state.grid.width + x] === 'open';
        this.graphGfx.fillStyle(open ? 0x111a2e : 0x0a0e1a, 1).fillRect(gx + x * tile, gy + y * tile, tile - 1, tile - 1);
      }
    }

    for (const e of state.enemies) {
      if (e.hp <= 0) continue;
      const ex = gx + e.pos.x * tile;
      const ey = gy + e.pos.y * tile;
      this.graphGfx.fillStyle(H.nodeBoss, 1).fillRect(ex + 4, ey + 4, tile - 9, tile - 9);
      this.dynamic.push(this.add.text(ex + tile / 2, ey + tile / 2, `${e.hp}`, { fontFamily: 'monospace', fontSize: '9px', color: C.label }).setOrigin(0.5));
    }

    const pp = state.player;
    const px = gx + pp.pos.x * tile;
    const py = gy + pp.pos.y * tile;
    this.graphGfx.fillStyle(0x66ff99, 1).fillRect(px + 4, py + 4, tile - 9, tile - 9);
    this.dynamic.push(this.add.text(px + tile / 2, py + tile / 2, 'YOU', { fontFamily: 'monospace', fontSize: '8px', color: C.label }).setOrigin(0.5));

    this.hudText.setText(`HP ${pp.hp}/${pp.maxHp}   AP ${pp.ap}/${pp.maxAp}   turn ${state.turn}`);

    // END TURN button.
    const bw = 140;
    const bh = 36;
    const bx = (this.scale.width - bw) / 2;
    const by = LOG_Y - 48;
    this.graphGfx.fillStyle(0x12121e, 1).fillRect(bx, by, bw, bh);
    this.graphGfx.lineStyle(1, 0x2a3050, 1).strokeRect(bx, by, bw, bh);
    this.dynamic.push(this.add.text(bx + bw / 2, by + bh / 2, 'END TURN', { fontFamily: 'monospace', fontSize: '12px', color: C.lace }).setOrigin(0.5));
    const z = this.add.zone(bx, by, bw, bh).setOrigin(0, 0).setInteractive({ useHandCursor: true });
    z.on('pointerdown', () => this.combatAction({ type: 'endTurn' }));
    this.dynamic.push(z);

    // Item bar (T-141 — teaches item use): one tap to use a consumable.
    const consumables = state.player.items.filter((it) => it.category === 'consumable').slice(0, 3);
    const iw = 116;
    const ih = 28;
    const totalW = consumables.length * iw + (consumables.length - 1) * 8;
    let ix = (this.scale.width - totalW) / 2;
    const iy = by - ih - 10;
    for (const item of consumables) {
      const ready = state.player.ap >= 1;
      this.graphGfx.fillStyle(0x12121e, 1).fillRect(ix, iy, iw, ih);
      this.graphGfx.lineStyle(1, ready ? 0x2a3050 : 0x1a1a28, 1).strokeRect(ix, iy, iw, ih);
      this.dynamic.push(this.add.text(ix + iw / 2, iy + ih / 2, item.name, {
        fontFamily: 'monospace', fontSize: '9px', color: ready ? '#66ff99' : C.dim,
      }).setOrigin(0.5));
      if (ready) {
        const iz = this.add.zone(ix, iy, iw, ih).setOrigin(0, 0).setInteractive({ useHandCursor: true });
        iz.on('pointerdown', () => this.useItem(item));
        this.dynamic.push(iz);
      }
      ix += iw + 8;
    }
  }

  private renderStrand(): void {
    this.guideText.setText('LACE: Two paths. Both will keep you alive. Tap the one you want.');
    this.hudText.setText('STRAND EVENT — pick 1 of 2');

    const cardW = this.scale.width - 48;
    const cardH = 120;
    const gap = 20;
    const x = 24;
    let y = VIEWPORT_Y + 20;

    for (const mut of this.strandOffer) {
      this.graphGfx.fillStyle(0x12121e, 1).fillRect(x, y, cardW, cardH);
      this.graphGfx.lineStyle(1, 0x2a3050, 1).strokeRect(x, y, cardW, cardH);
      this.dynamic.push(
        this.add.text(x + 12, y + 10, `${mut.name}`, { fontFamily: 'monospace', fontSize: '14px', color: C.lace }),
        this.add.text(x + 12, y + 32, `${mut.family} · ${mut.tier} · +${mut.sigBonus} SIG`, { fontFamily: 'monospace', fontSize: '9px', color: C.dim }),
        this.add.text(x + 12, y + 52, mut.lace, {
          fontFamily: 'monospace', fontSize: '10px', color: C.primary, lineSpacing: 3, wordWrap: { width: cardW - 24 },
        }),
      );
      const cy = y;
      const zone = this.add.zone(x, cy, cardW, cardH).setOrigin(0, 0).setInteractive({ useHandCursor: true });
      zone.on('pointerdown', () => this.chooseStrandCard(mut));
      this.dynamic.push(zone);
      y += cardH + gap;
    }
  }

  private pushLog(line: string): void {
    this.logLines.push(line);
    if (this.logLines.length > 8) this.logLines.shift();
    this.logText.setText(this.logLines.join('\n'));
  }
}

/** A short glyph naming each room's role on the map. */
function roomGlyph(room: PopulatedRoom): string {
  switch (room.type) {
    case 'safe': return 'YOU';
    case 'combat': return 'FOE';
    case 'lace_event': return 'LACE';
    case 'boss': return 'BOSS';
    default: return room.type.slice(0, 4).toUpperCase();
  }
}

/** RunSession requires a template for its procedural path; the tutorial stays on
 *  the hardcoded floor 0, so this only matters if a run descends past it. */
const TUTORIAL_TEMPLATE: FloorTemplate = {
  schemaVersion: 1,
  floor: 1,
  zone: 'shallows',
  roomCount: { min: 8, max: 12 },
  roomWeights: { combat: 0.5, loot: 0.15, safe: 0.15, merchant: 0.1, trap: 0.05, lace_event: 0.05 },
  roomMinima: { safe: 1 },
  connectivity: 'branching',
  enemyPool: ['filterer'],
  bossId: 'pressure_warden',
  aestheticTags: ['caves'],
};
