import Phaser from 'phaser';
import type { MetaState } from '@shared-types/meta-state';
import type { MutationFamily } from '@shared-types/mutation';
import type { DeathCause } from '@shared-types/run-state';
import { newMetaState } from '../core/save';
import { adService } from '../platform/ads-bootstrap';

/**
 * S031 "What You Became" + S032 Meta rewards — T-196 / T-197.
 *
 * The run-summary screen shown after victory or death. Two beats fused into
 * one scroll: (1) the procedurally-named "portrait" of who this descent turned
 * you into — depth, mutations, dominant trait — and (2) the meta rewards
 * earned (Shard Crystals, achievements), with the updated lifetime balance.
 *
 * Receives a {@link RunSummaryData} payload from GameScene.
 * SHARE is a v0.1 stub (the share flow + S033 revive offer land with T-198).
 * RETURN TO HUB → HubScene with the post-run meta.
 */

const W = 390;
const H = 844;
const CX = W / 2;

const C = {
  bg: 0x070b14,
  surface: 0x0e1626,
  surfaceHi: 0x1a2840,
  border: 0x1e2a40,
  borderHi: 0x2a3a55,
  accent: '#a0ffdc',
  accentN: 0xa0ffdc,
  dim: '#7a8fad',
  text: '#e8edf5',
  gold: '#ffdd44',
  goldN: 0xffdd44,
  danger: '#ff4444',
  dangerN: 0xff4444,
};

/** Per-family emblem tint + the noun that anchors a dominant-trait epithet. */
const FAMILY: Record<MutationFamily, { tint: number; noun: string }> = {
  abyssal: { tint: 0x4488ff, noun: 'LEVIATHAN' },
  mycelial: { tint: 0x66cc66, noun: 'BLOOM' },
  lithic: { tint: 0xbbaa77, noun: 'MONOLITH' },
  voidborn: { tint: 0xaa66ff, noun: 'EIDOLON' },
  thermal: { tint: 0xff8844, noun: 'PYRE' },
};

const DEATH_CAUSE_LABEL: Record<DeathCause, string> = {
  enemy_kill: 'Slain in the dark',
  boss_kill: 'Broken by a Warden',
  hazard: 'Claimed by the VEIN',
  status_tick: 'Withered away',
  surrender: 'Surrendered the descent',
  mutation_backfire: 'Undone by your own strands',
};

export interface RunSummaryData {
  readonly meta: MetaState;
  readonly won: boolean;
  readonly floorReached: number;
  readonly finalFloor: number;
  readonly enemiesKilled: number;
  readonly shardsEarned: number;
  readonly veinEarned: number;
  /** Resolved mutation display names (not ids). */
  readonly mutations: readonly string[];
  readonly dominantTraits: readonly MutationFamily[];
  readonly playtimeMs: number;
  /** null on victory. */
  readonly deathCause: DeathCause | null;
  /** Achievement ids newly earned this run (popped in the rewards strip). */
  readonly achievementsEarned: readonly string[];
  /** S033: true when the player died and has not yet used their one revive. */
  readonly reviveAvailable: boolean;
}

const REVIVE_SC_COST = 75;

const DEFAULT_SUMMARY: RunSummaryData = {
  meta: newMetaState(),
  won: false,
  floorReached: 1,
  finalFloor: 20,
  enemiesKilled: 0,
  shardsEarned: 0,
  veinEarned: 0,
  mutations: [],
  dominantTraits: [],
  playtimeMs: 0,
  deathCause: 'enemy_kill',
  achievementsEarned: [],
  reviveAvailable: false,
};

export class PostRunScene extends Phaser.Scene {
  private summary: RunSummaryData = DEFAULT_SUMMARY;
  /** S033 revive panel — shown when player taps CONTINUE on the summary screen. */
  private showingRevivePanel = false;

  constructor() {
    super({ key: 'PostRunScene' });
  }

  init(data: Record<string, unknown>): void {
    // The payload arrives as a single object; merge over defaults defensively.
    this.summary = { ...DEFAULT_SUMMARY, ...(data as Partial<RunSummaryData>) };
    this.showingRevivePanel = false;
  }

  create(): void {
    this.add.graphics().fillStyle(C.bg).fillRect(0, 0, W, H);
    this.buildHeader();
    this.buildPortrait();
    this.buildStats();
    this.buildRewards();
    this.buildButtons();
  }

  // ── Header ───────────────────────────────────────────────────────────────

  private buildHeader(): void {
    const won = this.summary.won;
    this.add.graphics().fillStyle(won ? C.goldN : C.dangerN, 0.16).fillRect(0, 0, W, 3);

    this.add.text(CX, 40, won ? 'YOU ASCENDED' : 'WHAT YOU BECAME', {
      fontFamily: 'monospace',
      fontSize: '17px',
      color: won ? C.gold : C.text,
      letterSpacing: 4,
    }).setOrigin(0.5);

    const sub = won
      ? `cleared all ${this.summary.finalFloor} floors of the VEIN`
      : this.summary.deathCause !== null
        ? `${DEATH_CAUSE_LABEL[this.summary.deathCause]} — Floor ${this.summary.floorReached}`
        : `Floor ${this.summary.floorReached}`;
    this.add.text(CX, 64, sub, {
      fontFamily: 'monospace', fontSize: '10px', color: C.dim,
    }).setOrigin(0.5);
  }

  // ── Portrait + epithet ─────────────────────────────────────────────────────

  private buildPortrait(): void {
    const cx = CX;
    const cy = 156;
    const family = this.summary.dominantTraits[0];
    const tint = this.summary.won
      ? C.goldN
      : family !== undefined
        ? FAMILY[family].tint
        : C.accentN;

    const g = this.add.graphics();
    // Layered crystalline emblem — concentric rotated diamonds.
    g.lineStyle(1, tint, 0.25).strokeCircle(cx, cy, 56);
    g.lineStyle(2, tint, 0.85);
    this.diamond(g, cx, cy, 46);
    g.lineStyle(1, tint, 0.5);
    this.diamond(g, cx, cy, 30);
    g.fillStyle(tint, 0.18).fillCircle(cx, cy, 14);
    g.fillStyle(tint, 0.9).fillCircle(cx, cy, 5);

    // Generated epithet.
    this.add.text(cx, cy + 78, this.epithet(), {
      fontFamily: 'monospace',
      fontSize: '20px',
      color: this.summary.won ? C.gold : C.accent,
      letterSpacing: 3,
      align: 'center',
      wordWrap: { width: W - 48 },
    }).setOrigin(0.5, 0);
  }

  private diamond(g: Phaser.GameObjects.Graphics, cx: number, cy: number, r: number): void {
    g.beginPath();
    g.moveTo(cx, cy - r);
    g.lineTo(cx + r, cy);
    g.lineTo(cx, cy + r);
    g.lineTo(cx - r, cy);
    g.closePath();
    g.strokePath();
  }

  /** Deterministic "THE <ADJ> <NOUN>" title from depth + dominant family. */
  private epithet(): string {
    const f = this.summary.floorReached;
    const adj =
      this.summary.won ? 'ASCENDANT'
      : f >= 15 ? 'UNBOUND'
      : f >= 10 ? 'ABYSSAL'
      : f >= 5 ? 'HARDENED'
      : 'FLEDGLING';
    const family = this.summary.dominantTraits[0];
    const noun = family !== undefined ? FAMILY[family].noun : 'DIVER';
    return `THE ${adj} ${noun}`;
  }

  // ── Run stats ──────────────────────────────────────────────────────────────

  private buildStats(): void {
    const x = 24;
    const y = 320;
    const w = W - 48;
    const h = 150;

    const g = this.add.graphics();
    g.fillStyle(C.surfaceHi).fillRoundedRect(x, y, w, h, 12);
    g.lineStyle(1, C.border).strokeRoundedRect(x, y, w, h, 12);

    this.add.text(x + 18, y + 14, 'THIS DESCENT', {
      fontFamily: 'monospace', fontSize: '10px', color: C.dim, letterSpacing: 3,
    });

    const rows: Array<{ label: string; value: string }> = [
      { label: 'DEEPEST FLOOR', value: `F${this.summary.floorReached} / ${this.summary.finalFloor}` },
      { label: 'ENEMIES SLAIN', value: `${this.summary.enemiesKilled}` },
      { label: 'MUTATIONS HELD', value: `${this.summary.mutations.length} / 4` },
      { label: 'VEIN EARNED', value: `${this.summary.veinEarned}` },
      { label: 'TIME', value: this.formatTime(this.summary.playtimeMs) },
    ];

    rows.forEach((r, i) => {
      const ry = y + 42 + i * 21;
      this.add.text(x + 18, ry, r.label, { fontFamily: 'monospace', fontSize: '11px', color: C.dim });
      this.add.text(x + w - 18, ry, r.value, { fontFamily: 'monospace', fontSize: '12px', color: C.text }).setOrigin(1, 0);
    });

    // Mutation names, if any, under the stat rows as a wrapped strip.
    if (this.summary.mutations.length > 0) {
      this.add.text(x + 18, y + h + 8, `Strands: ${this.summary.mutations.join(' · ')}`, {
        fontFamily: 'monospace', fontSize: '9px', color: C.accent,
        wordWrap: { width: w - 24 }, lineSpacing: 2,
      });
    }
  }

  // ── Meta rewards (S032) ─────────────────────────────────────────────────────

  private buildRewards(): void {
    const x = 24;
    const y = 520;
    const w = W - 48;
    const h = 88;

    const g = this.add.graphics();
    g.fillStyle(C.surface).fillRoundedRect(x, y, w, h, 12);
    g.lineStyle(1, C.goldN, 0.45).strokeRoundedRect(x, y, w, h, 12);

    this.add.text(x + 18, y + 14, 'REWARDS', {
      fontFamily: 'monospace', fontSize: '10px', color: C.dim, letterSpacing: 3,
    });

    this.add.text(x + 18, y + 36, `+${this.summary.shardsEarned.toFixed(2)} Shard Crystals`, {
      fontFamily: 'monospace', fontSize: '14px', color: C.gold,
    });
    this.add.text(x + w - 18, y + 38, `balance ${this.summary.meta.shardCrystals.toFixed(2)} SC`, {
      fontFamily: 'monospace', fontSize: '10px', color: C.dim,
    }).setOrigin(1, 0);

    const earned = this.summary.achievementsEarned.length;
    const achLine = earned > 0
      ? `★ ${earned} achievement${earned === 1 ? '' : 's'} unlocked`
      : 'no new achievements this run';
    this.add.text(x + 18, y + 62, achLine, {
      fontFamily: 'monospace', fontSize: '10px', color: earned > 0 ? C.accent : C.dim,
    });
  }

  // ── Buttons ──────────────────────────────────────────────────────────────

  private buildButtons(): void {
    // SHARE stub (Scope 8 — ships with share flow).
    const btY = H - 124;
    const halfW = 150;
    const shareX = CX - halfW - 8;
    const sg = this.add.graphics();
    sg.fillStyle(C.surface).fillRoundedRect(shareX, btY, halfW, 50, 10);
    sg.lineStyle(1, C.border).strokeRoundedRect(shareX, btY, halfW, 50, 10);
    this.add.text(shareX + halfW / 2, btY + 18, 'SHARE', {
      fontFamily: 'monospace', fontSize: '14px', color: C.dim,
    }).setOrigin(0.5, 0);
    this.add.text(shareX + halfW / 2, btY + 36, 'soon', {
      fontFamily: 'monospace', fontSize: '8px', color: C.dim,
    }).setOrigin(0.5, 0);

    // Primary CTA — "CONTINUE" opens the S033 revive offer; "RETURN" goes straight to hub.
    const hubX = CX + 8;
    const hg = this.add.graphics();
    const canRevive = this.summary.reviveAvailable;
    const label = canRevive ? 'CONTINUE' : 'RETURN';

    hg.fillStyle(0x1a3028).fillRoundedRect(hubX, btY, halfW, 50, 10);
    hg.lineStyle(2, C.accentN).strokeRoundedRect(hubX, btY, halfW, 50, 10);
    this.add.text(hubX + halfW / 2, btY + 25, label, {
      fontFamily: 'monospace', fontSize: '15px', color: C.accent,
    }).setOrigin(0.5);

    const zone = this.add.zone(hubX, btY, halfW, 50).setOrigin(0, 0).setInteractive({ useHandCursor: true });
    zone.on('pointerdown', () => {
      if (canRevive) {
        this.openRevivePanel();
      } else {
        this.scene.start('HubScene', { meta: this.summary.meta });
      }
    });
    zone.on('pointerover', () => {
      hg.clear();
      hg.fillStyle(0x1e3a30).fillRoundedRect(hubX, btY, halfW, 50, 10);
      hg.lineStyle(2, C.accentN, 1).strokeRoundedRect(hubX, btY, halfW, 50, 10);
    });
    zone.on('pointerout', () => {
      hg.clear();
      hg.fillStyle(0x1a3028).fillRoundedRect(hubX, btY, halfW, 50, 10);
      hg.lineStyle(2, C.accentN).strokeRoundedRect(hubX, btY, halfW, 50, 10);
    });

    this.add.text(CX, H - 40, canRevive ? 'a second chance awaits' : 'tap RETURN to bank your Shards', {
      fontFamily: 'monospace', fontSize: '9px', color: C.dim,
    }).setOrigin(0.5);
  }

  // ── S033 Revive panel ─────────────────────────────────────────────────────

  private openRevivePanel(): void {
    this.showingRevivePanel = true;
    // Dim the summary beneath.
    const overlay = this.add.graphics().setDepth(10);
    overlay.fillStyle(0x000000, 0.7).fillRect(0, 0, W, H);

    const px = 24;
    const py = H / 2 - 170;
    const pw = W - 48;
    const ph = 340;

    const pg = this.add.graphics().setDepth(11);
    pg.fillStyle(C.surface).fillRoundedRect(px, py, pw, ph, 16);
    pg.lineStyle(2, C.dangerN, 0.6).strokeRoundedRect(px, py, pw, ph, 16);

    // Header
    this.add.text(CX, py + 30, 'RETURN FROM THE DARK', {
      fontFamily: 'monospace', fontSize: '15px', color: C.text, letterSpacing: 3,
    }).setOrigin(0.5).setDepth(12);

    this.add.text(CX, py + 56, 'Resume at 50 % HP · enemies reset', {
      fontFamily: 'monospace', fontSize: '10px', color: C.dim,
    }).setOrigin(0.5).setDepth(12);

    // Emblem
    const eg = this.add.graphics().setDepth(12);
    eg.lineStyle(1, C.dangerN, 0.4).strokeCircle(CX, py + 115, 40);
    eg.lineStyle(2, C.dangerN, 0.8);
    this.diamond(eg, CX, py + 115, 32);
    eg.fillStyle(C.dangerN, 0.15).fillCircle(CX, py + 115, 16);
    eg.fillStyle(C.dangerN, 0.9).fillCircle(CX, py + 115, 5);

    const btnY = py + 170;
    const btnH = 50;
    const btnW = pw - 32;
    const btnX = px + 16;

    // WATCH AD button
    this.buildReviveBtn(btnX, btnY, btnW, btnH, 'WATCH AD', 'free · rewarded ad', C.accentN, 0x1a3028, 12, () => {
      void this.tryAdRevive();
    });

    // 75 SC button
    const shards = this.summary.meta.shardCrystals;
    const canAfford = shards >= REVIVE_SC_COST;
    this.buildReviveBtn(
      btnX, btnY + btnH + 10, btnW, btnH,
      `${REVIVE_SC_COST} SC`,
      canAfford ? `balance: ${shards.toFixed(0)} SC` : 'not enough Shard Crystals',
      canAfford ? C.goldN : 0x555566,
      canAfford ? 0x241e00 : 0x0e1626,
      12,
      canAfford ? () => { this.doScRevive(); } : null,
    );

    // DECLINE
    this.add.text(CX, btnY + btnH * 2 + 32, 'DECLINE — lose this run', {
      fontFamily: 'monospace', fontSize: '11px', color: C.dim,
    }).setOrigin(0.5).setDepth(12).setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.scene.start('HubScene', { meta: this.summary.meta }))
      .on('pointerover', function (this: Phaser.GameObjects.Text) { this.setColor(C.text); })
      .on('pointerout', function (this: Phaser.GameObjects.Text) { this.setColor(C.dim); });
  }

  private buildReviveBtn(
    x: number, y: number, w: number, h: number,
    label: string, sub: string,
    borderColor: number, fillColor: number,
    depth: number,
    onTap: (() => void) | null,
  ): void {
    const g = this.add.graphics().setDepth(depth);
    const alpha = onTap !== null ? 1 : 0.4;
    g.fillStyle(fillColor, alpha).fillRoundedRect(x, y, w, h, 10);
    g.lineStyle(2, borderColor, alpha).strokeRoundedRect(x, y, w, h, 10);

    const colorHex = '#' + borderColor.toString(16).padStart(6, '0');
    this.add.text(x + w / 2, y + 14, label, {
      fontFamily: 'monospace', fontSize: '15px', color: onTap !== null ? colorHex : C.dim,
    }).setOrigin(0.5, 0).setDepth(depth + 1);
    this.add.text(x + w / 2, y + 33, sub, {
      fontFamily: 'monospace', fontSize: '9px', color: C.dim,
    }).setOrigin(0.5, 0).setDepth(depth + 1);

    if (onTap !== null) {
      const zone = this.add.zone(x, y, w, h).setOrigin(0, 0).setInteractive({ useHandCursor: true }).setDepth(depth + 2);
      zone.on('pointerdown', onTap);
    }
  }

  private async tryAdRevive(): Promise<void> {
    const outcome = await adService.requestReward('revive');
    if (outcome.granted) {
      this.doRevive();
    } else if (outcome.result === 'blocked') {
      // Cap reached — shouldn't happen since reviveAvailable guards this, but handle gracefully.
      this.scene.start('HubScene', { meta: this.summary.meta });
    }
    // dismissed / timed_out / error — stay on panel so player can try SC or decline.
  }

  private doScRevive(): void {
    const updatedMeta: typeof this.summary.meta = {
      ...this.summary.meta,
      shardCrystals: this.summary.meta.shardCrystals - REVIVE_SC_COST,
    };
    this.summary = { ...this.summary, meta: updatedMeta };
    this.doRevive();
  }

  private doRevive(): void {
    this.scene.start('GameScene', { meta: this.summary.meta, revive: true });
  }

  private formatTime(ms: number): string {
    const total = Math.floor(ms / 1000);
    const m = Math.floor(total / 60);
    const s = total % 60;
    return `${m}m ${s.toString().padStart(2, '0')}s`;
  }
}
