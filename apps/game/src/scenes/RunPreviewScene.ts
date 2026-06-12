import Phaser from 'phaser';
import type { MetaState } from '@shared-types/meta-state';
import { newMetaState } from '../core/save';
import { MAX_FLOOR } from '@shared-types/campaign';

/**
 * S019 Run Preview — T-148.
 *
 * Shows the about-to-begin run's parameters: generated seed, floor depth,
 * and difficulty modifiers (none in v0.1). A single CTA launches the descent.
 *
 * Receives: { meta: MetaState, originId: string } from OriginSelectScene.
 * Transitions: BEGIN DESCENT → FloorTransitionScene (T-149) with
 *   { meta, originId, seed }.
 * Back → OriginSelectScene.
 */

const W = 390;
const H = 844;
const CX = W / 2;

const C = {
  bg: 0x070b14,
  surface: 0x0e1626,
  surfaceHi: 0x1a2840,
  border: 0x1e2a40,
  accent: '#a0ffdc',
  accentN: 0xa0ffdc,
  dim: '#7a8fad',
  text: '#e8edf5',
  gold: '#ffdd44',
};

const FINAL_FLOOR = MAX_FLOOR; // canonical campaign shape (T-523)

export class RunPreviewScene extends Phaser.Scene {
  private meta: MetaState = newMetaState();
  private originId = 'void_diver';
  private seed = 0;

  constructor() {
    super({ key: 'RunPreviewScene' });
  }

  init(data: Record<string, unknown>): void {
    if (data['meta'] !== undefined) this.meta = data['meta'] as MetaState;
    if (typeof data['originId'] === 'string') this.originId = data['originId'];
    // Generate a fresh seed from the current timestamp; players see it for
    // run-sharing and provenance, but cannot choose it (no seed input in v0.1).
    this.seed = (Date.now() ^ (Math.random() * 0xffffffff)) >>> 0;
  }

  create(): void {
    this.add.graphics().fillStyle(C.bg).fillRect(0, 0, W, H);
    this.buildHeader();
    this.buildRunCard();
    this.buildBeginButton();
    this.buildBackButton();
  }

  // ── Header ────────────────────────────────────────────────────────────────

  private buildHeader(): void {
    this.add.graphics().fillStyle(C.accentN, 0.12).fillRect(0, 0, W, 3);

    this.add.text(CX, 52, 'RUN PREVIEW', {
      fontFamily: 'monospace',
      fontSize: '18px',
      color: C.text,
      letterSpacing: 4,
    }).setOrigin(0.5);

    this.add.text(CX, 80, 'review your parameters before descending', {
      fontFamily: 'monospace',
      fontSize: '10px',
      color: C.dim,
    }).setOrigin(0.5);

    this.add.graphics()
      .lineStyle(1, C.border)
      .lineBetween(24, 104, W - 24, 104);
  }

  // ── Run card ──────────────────────────────────────────────────────────────

  private buildRunCard(): void {
    const cardX = 24;
    const cardY = 132;
    const cardW = W - 48;
    const cardH = 360;

    const g = this.add.graphics();
    g.fillStyle(C.surfaceHi).fillRoundedRect(cardX, cardY, cardW, cardH, 14);
    g.lineStyle(1, C.border).strokeRoundedRect(cardX, cardY, cardW, cardH, 14);

    const row = (label: string, value: string, y: number, valueColor = C.accent): void => {
      this.add.text(cardX + 20, y, label, {
        fontFamily: 'monospace', fontSize: '11px', color: C.dim,
      });
      this.add.text(cardX + cardW - 20, y, value, {
        fontFamily: 'monospace', fontSize: '13px', color: valueColor,
      }).setOrigin(1, 0);
    };

    const sep = (y: number): void => {
      this.add.graphics()
        .lineStyle(1, C.border, 0.5)
        .lineBetween(cardX + 20, y, cardX + cardW - 20, y);
    };

    // Section heading
    this.add.text(cardX + 20, cardY + 22, 'RUN PARAMETERS', {
      fontFamily: 'monospace', fontSize: '10px', color: C.dim, letterSpacing: 3,
    });

    sep(cardY + 50);

    row('ORIGIN', this.originLabel(), cardY + 64);
    sep(cardY + 90);

    row('SEED', this.formatSeed(), cardY + 104);
    sep(cardY + 130);

    row('FLOORS', `${FINAL_FLOOR}`, cardY + 144);
    sep(cardY + 170);

    row('DIFFICULTY', 'STANDARD', cardY + 184, C.text);
    sep(cardY + 210);

    row('MODIFIERS', 'NONE', cardY + 224, C.dim);

    // Flavour divider
    this.add.graphics()
      .lineStyle(1, C.border)
      .lineBetween(cardX + 20, cardY + 262, cardX + cardW - 20, cardY + 262);

    this.add.text(CX, cardY + 280, '"The VEIN is 20 floors of consequence.', {
      fontFamily: 'monospace',
      fontSize: '11px',
      color: C.dim,
      fontStyle: 'italic',
      wordWrap: { width: cardW - 48 },
      align: 'center',
      lineSpacing: 4,
    }).setOrigin(0.5, 0);

    this.add.text(CX, cardY + 316, 'There are no saves mid-descent."', {
      fontFamily: 'monospace',
      fontSize: '11px',
      color: C.dim,
      fontStyle: 'italic',
    }).setOrigin(0.5, 0);
  }

  private originLabel(): string {
    if (this.originId === 'void_diver') return 'VOID DIVER';
    return this.originId.toUpperCase().replace(/_/g, ' ');
  }

  private formatSeed(): string {
    return `#${(this.seed >>> 0).toString(16).toUpperCase().padStart(8, '0')}`;
  }

  // ── Begin button ──────────────────────────────────────────────────────────

  private buildBeginButton(): void {
    const btnY = H - 128;
    const btnW = 260;
    const btnX = CX - btnW / 2;
    const btnH = 56;

    const g = this.add.graphics();
    g.fillStyle(0x1a3028).fillRoundedRect(btnX, btnY, btnW, btnH, 10);
    g.lineStyle(2, C.accentN).strokeRoundedRect(btnX, btnY, btnW, btnH, 10);

    this.add.text(CX, btnY + btnH / 2, 'BEGIN DESCENT', {
      fontFamily: 'monospace', fontSize: '16px', color: C.accent,
    }).setOrigin(0.5);

    const zone = this.add
      .zone(btnX, btnY, btnW, btnH)
      .setOrigin(0, 0)
      .setInteractive({ useHandCursor: true });

    zone.on('pointerdown', () => {
      this.scene.start('FloorTransitionScene', {
        meta: this.meta,
        originId: this.originId,
        seed: this.seed,
        floorNumber: 1,
      });
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

  // ── Back button ───────────────────────────────────────────────────────────

  private buildBackButton(): void {
    const y = H - 52;
    const backText = this.add.text(CX, y, '← BACK', {
      fontFamily: 'monospace', fontSize: '11px', color: C.dim,
    }).setOrigin(0.5);

    const zone = this.add
      .zone(CX - 40, y - 10, 80, 28)
      .setOrigin(0, 0)
      .setInteractive({ useHandCursor: true });

    zone.on('pointerdown', () => {
      this.scene.start('OriginSelectScene', { meta: this.meta });
    });
    zone.on('pointerover', () => backText.setColor(C.accent));
    zone.on('pointerout', () => backText.setColor(C.dim));
  }
}
