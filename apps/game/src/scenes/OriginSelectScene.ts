import Phaser from 'phaser';
import type { MetaState } from '@shared-types/meta-state';
import { newMetaState } from '../core/save';
import { parseOriginDef } from '../core/content/origin-loader';

// eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-assignment
const originModules = import.meta.glob('../../../../packages/content/origins/*.json', { eager: true });
const originFiles = originModules as Record<string, { readonly default: unknown }>;
import { addBackButton } from './settings-back-button';

/**
 * S018 Origin Select — T-145.
 *
 * Swipe carousel showing available Origins. Only one Origin ships in v0.1:
 * Void Diver (default). Additional Origins unlock via meta-progression (T-301).
 *
 * Receives: { meta: MetaState } from HubScene.
 * Transitions: CONFIRM → RunPreviewScene (T-148) with { meta, originId }.
 * Back arrow → HubScene.
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
};

interface OriginCard {
  id: string;
  name: string;
  tagline: string;
  statLine: string;
  flavour: string;
  unlockRuns: number;
}

/** Base stats are identical for every Origin (GDD §4.2) — the card states it. */
const BASE_STAT_LINE = 'STR 11  RES 6  AGI 8  INT 10 — identical for every Origin';

/** The shipped Origins (T-301), parsed once from content and ordered by
 *  unlock threshold so defaults lead the carousel. */
const ORIGINS: OriginCard[] = Object.values(originFiles)
  .map((mod) => {
    const res = parseOriginDef(mod.default);
    if (!res.ok) throw new Error(`OriginSelectScene: bad origin content — ${res.error.message}`);
    return res.origin;
  })
  .sort((a, b) => a.unlockRuns - b.unlockRuns || a.id.localeCompare(b.id))
  .map((o) => ({
    id: o.id,
    name: o.name.toUpperCase(),
    tagline: o.tagline,
    statLine: BASE_STAT_LINE,
    flavour: o.blurb,
    unlockRuns: o.unlockRuns,
  }));

const CARD_W = W - 48;
const CARD_H = 360;
const CARD_X = 24;
const CARD_Y = 200;

export class OriginSelectScene extends Phaser.Scene {
  private meta: MetaState = newMetaState();
  private selected = 0;

  constructor() {
    super({ key: 'OriginSelectScene' });
  }

  init(data: Record<string, unknown>): void {
    if (data['meta'] !== undefined) this.meta = data['meta'] as MetaState;
    this.selected = typeof data['keepSelected'] === 'number' ? data['keepSelected'] : 0;
  }

  create(): void {
    this.add.graphics().fillStyle(C.bg).fillRect(0, 0, W, H);
    this.buildHeader();
    this.buildCarousel();
    this.buildNav();
    this.buildDots();
    this.buildConfirmButton();
    addBackButton(this, () => this.scene.start('HubScene', { meta: this.meta }), 776);
  }

  // ── Header ───────────────────────────────────────────────────────────────

  private buildHeader(): void {
    this.add.graphics().fillStyle(C.accentN, 0.12).fillRect(0, 0, W, 3);

    this.add.text(CX, 52, 'CHOOSE YOUR ORIGIN', {
      fontFamily: 'monospace',
      fontSize: '18px',
      color: C.text,
      letterSpacing: 4,
    }).setOrigin(0.5);

    this.add.text(CX, 80, 'your genetic template for this descent', {
      fontFamily: 'monospace',
      fontSize: '10px',
      color: C.dim,
    }).setOrigin(0.5);

    this.add.graphics()
      .lineStyle(1, C.border)
      .lineBetween(24, 104, W - 24, 104);
  }

  // ── Carousel ─────────────────────────────────────────────────────────────

  /** True when the selected Origin is still locked for this profile. */
  private isLocked(card: OriginCard): boolean {
    return this.meta.lifetime.runs < card.unlockRuns;
  }

  private buildCarousel(): void {
    const origin = ORIGINS[this.selected];
    if (origin === undefined) return;
    const locked = this.isLocked(origin);

    // Card background
    const g = this.add.graphics();
    g.fillStyle(C.surfaceHi).fillRoundedRect(CARD_X, CARD_Y, CARD_W, CARD_H, 14);
    g.lineStyle(2, C.accentN, 0.6).strokeRoundedRect(CARD_X, CARD_Y, CARD_W, CARD_H, 14);

    // Subtle teal glow wash inside card
    g.fillStyle(C.accentN, 0.04).fillRoundedRect(CARD_X, CARD_Y, CARD_W, CARD_H, 14);

    // Origin emblem — geometric diamond
    this.buildEmblem(CX, CARD_Y + 80);

    // Name
    this.add.text(CX, CARD_Y + 148, origin.name, {
      fontFamily: 'monospace',
      fontSize: '22px',
      color: C.accent,
      letterSpacing: 5,
    }).setOrigin(0.5);

    // Tagline (ability names)
    this.add.text(CX, CARD_Y + 182, origin.tagline, {
      fontFamily: 'monospace',
      fontSize: '11px',
      color: C.dim,
    }).setOrigin(0.5);

    // Divider
    this.add.graphics()
      .lineStyle(1, C.border)
      .lineBetween(CARD_X + 24, CARD_Y + 204, CARD_X + CARD_W - 24, CARD_Y + 204);

    // Stat line
    this.add.text(CX, CARD_Y + 220, origin.statLine, {
      fontFamily: 'monospace',
      fontSize: '11px',
      color: C.text,
    }).setOrigin(0.5);

    // Locked overlay note (unlock threshold) replaces flavour when gated.
    if (locked) {
      this.add.text(CX, CARD_Y + 254, `Locked — unlocks after ${origin.unlockRuns} runs.`, {
        fontFamily: 'monospace', fontSize: '11px', color: C.gold,
        wordWrap: { width: CARD_W - 48 }, align: 'center',
      }).setOrigin(0.5, 0);
      return;
    }

    // Flavour text
    this.add.text(CX, CARD_Y + 254, origin.flavour, {
      fontFamily: 'monospace',
      fontSize: '11px',
      color: C.dim,
      fontStyle: 'italic',
      wordWrap: { width: CARD_W - 48 },
      align: 'center',
      lineSpacing: 4,
    }).setOrigin(0.5, 0);

  }

  /** Carousel navigation — tappable arrows flanking the card (T-301). */
  private buildNav(): void {
    if (ORIGINS.length <= 1) return;
    const mk = (x: number, glyph: string, delta: number, originX: number): void => {
      this.add.text(x, CARD_Y + CARD_H / 2, glyph, {
        fontFamily: 'monospace', fontSize: '24px', color: C.dim,
      }).setOrigin(originX, 0.5);
      this.add.zone(x - 24, CARD_Y, 48, CARD_H).setOrigin(originX, 0)
        .setInteractive({ useHandCursor: true })
        .on('pointerdown', () => {
          this.selected = (this.selected + delta + ORIGINS.length) % ORIGINS.length;
          this.scene.restart({ meta: this.meta, keepSelected: this.selected });
        });
    };
    mk(CARD_X + 12, '‹', -1, 0);
    mk(CARD_X + CARD_W - 12, '›', 1, 1);
  }

  /** Diamond emblem for the card. */
  private buildEmblem(cx: number, cy: number): void {
    const g = this.add.graphics();
    const r = 34;
    // Outer circle
    g.lineStyle(1, C.accentN, 0.3).strokeCircle(cx, cy, r);
    // Inner diamond
    g.lineStyle(2, C.accentN, 0.85);
    g.beginPath();
    g.moveTo(cx, cy - r + 6);
    g.lineTo(cx + r - 6, cy);
    g.lineTo(cx, cy + r - 6);
    g.lineTo(cx - r + 6, cy);
    g.closePath();
    g.strokePath();
    // Centre dot
    g.fillStyle(C.accentN, 0.7).fillCircle(cx, cy, 4);
  }

  // ── Pagination dots ───────────────────────────────────────────────────────

  private buildDots(): void {
    const dotY = CARD_Y + CARD_H + 20;
    const dotSpacing = 16;
    const totalW = (ORIGINS.length - 1) * dotSpacing;
    const startX = CX - totalW / 2;

    ORIGINS.forEach((_, i) => {
      const x = startX + i * dotSpacing;
      const g = this.add.graphics();
      if (i === this.selected) {
        g.fillStyle(C.accentN, 1).fillCircle(x, dotY, 5);
      } else {
        g.fillStyle(C.accentN, 0.25).fillCircle(x, dotY, 4);
      }
    });
  }

  // ── Confirm button ────────────────────────────────────────────────────────

  private buildConfirmButton(): void {
    const btnY = H - 132; // sits above the boxed back button at y=776
    const btnW = 260;
    const btnX = CX - btnW / 2;
    const btnH = 56;

    const g = this.add.graphics();
    g.fillStyle(0x1a3028).fillRoundedRect(btnX, btnY, btnW, btnH, 10);
    g.lineStyle(2, C.accentN).strokeRoundedRect(btnX, btnY, btnW, btnH, 10);

    this.add.text(CX, btnY + btnH / 2, 'CONFIRM ORIGIN', {
      fontFamily: 'monospace', fontSize: '16px', color: C.accent,
    }).setOrigin(0.5);

    const zone = this.add
      .zone(btnX, btnY, btnW, btnH)
      .setOrigin(0, 0)
      .setInteractive({ useHandCursor: true });

    zone.on('pointerdown', () => {
      const origin = ORIGINS[this.selected];
      if (origin === undefined || this.isLocked(origin)) return; // locked cards don't confirm
      this.scene.start('RunPreviewScene', { meta: this.meta, originId: origin.id });
    });

    zone.on('pointerover', () => {
      g.clear();
      g.fillStyle(0x1e3a30).fillRoundedRect(btnX, btnY, btnW, btnH, 10);
      g.lineStyle(2, C.accentN, 1).strokeRoundedRect(btnX, btnY, btnW, btnH, 10);
    });
    zone.on('pointerout', () => {
      g.clear();
      g.fillStyle(0x1a3028).fillRoundedRect(btnX, btnY, btnW, btnH, 10);
      g.lineStyle(2, C.accentN).strokeRoundedRect(btnX, btnY, btnW, btnH, 10);
    });
  }

}
