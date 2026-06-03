import Phaser from 'phaser';
import type { MetaState } from '@shared-types/meta-state';
import type { MutationFamily } from '@shared-types/mutation';
import type { DeathCause } from '@shared-types/run-state';
import { newMetaState } from '../core/save';

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
}

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
};

export class PostRunScene extends Phaser.Scene {
  private summary: RunSummaryData = DEFAULT_SUMMARY;

  constructor() {
    super({ key: 'PostRunScene' });
  }

  init(data: Record<string, unknown>): void {
    // The payload arrives as a single object; merge over defaults defensively.
    this.summary = { ...DEFAULT_SUMMARY, ...(data as Partial<RunSummaryData>) };
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
    // SHARE — stubbed in v0.1 (share + revive flow ships with T-198).
    const shareY = H - 124;
    const shareW = 150;
    const shareX = CX - shareW - 8;
    const sg = this.add.graphics();
    sg.fillStyle(C.surface).fillRoundedRect(shareX, shareY, shareW, 50, 10);
    sg.lineStyle(1, C.border).strokeRoundedRect(shareX, shareY, shareW, 50, 10);
    this.add.text(shareX + shareW / 2, shareY + 18, 'SHARE', {
      fontFamily: 'monospace', fontSize: '14px', color: C.dim,
    }).setOrigin(0.5, 0);
    this.add.text(shareX + shareW / 2, shareY + 36, 'soon', {
      fontFamily: 'monospace', fontSize: '8px', color: C.dim,
    }).setOrigin(0.5, 0);

    // RETURN TO HUB — primary CTA.
    const hubW = 150;
    const hubX = CX + 8;
    const hg = this.add.graphics();
    hg.fillStyle(0x1a3028).fillRoundedRect(hubX, shareY, hubW, 50, 10);
    hg.lineStyle(2, C.accentN).strokeRoundedRect(hubX, shareY, hubW, 50, 10);
    this.add.text(hubX + hubW / 2, shareY + 25, 'RETURN', {
      fontFamily: 'monospace', fontSize: '15px', color: C.accent,
    }).setOrigin(0.5);

    const zone = this.add.zone(hubX, shareY, hubW, 50).setOrigin(0, 0).setInteractive({ useHandCursor: true });
    zone.on('pointerdown', () => this.scene.start('HubScene', { meta: this.summary.meta }));
    zone.on('pointerover', () => {
      hg.clear();
      hg.fillStyle(0x1e3a30).fillRoundedRect(hubX, shareY, hubW, 50, 10);
      hg.lineStyle(2, C.accentN, 1).strokeRoundedRect(hubX, shareY, hubW, 50, 10);
    });
    zone.on('pointerout', () => {
      hg.clear();
      hg.fillStyle(0x1a3028).fillRoundedRect(hubX, shareY, hubW, 50, 10);
      hg.lineStyle(2, C.accentN).strokeRoundedRect(hubX, shareY, hubW, 50, 10);
    });

    this.add.text(CX, H - 40, 'tap RETURN to bank your Shards', {
      fontFamily: 'monospace', fontSize: '9px', color: C.dim,
    }).setOrigin(0.5);
  }

  private formatTime(ms: number): string {
    const total = Math.floor(ms / 1000);
    const m = Math.floor(total / 60);
    const s = total % 60;
    return `${m}m ${s.toString().padStart(2, '0')}s`;
  }
}
