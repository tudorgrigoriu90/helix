import Phaser from 'phaser';
import type { MetaState } from '@shared-types/meta-state';
import { parseLaceLines } from '../core/lace/lace-loader';
import { LaceNarrator } from '../core/lace';
import { makeRng } from '../core/rng/mulberry32';

import laceCore from '@content/lace-lines/core.json';

/**
 * S011 Tutorial intro — T-135.
 *
 * The first screen a brand-new player sees after the boot splashes.
 * LACE speaks its very first line (selected from the run_start context
 * pool, or generic if empty), building the AI companion relationship from
 * the opening moment. A single large CTA leads into the Floor 0 tutorial.
 *
 * Receives: { meta: MetaState } from GameBootScene.
 * Transitions to TutorialScene (existing, T-138+).
 */

const W = 390;
const H = 844;
const CX = W / 2;
const C = {
  bg: 0x070b14,
  surface: 0x0e1626,
  border: 0x1e2a40,
  accent: '#a0ffdc',
  dim: '#7a8fad',
  text: '#e8edf5',
  gold: '#ffdd44',
};

// The intro seed is deterministic per player (uses a constant) so LACE
// always speaks the same first line — a consistent brand moment, not a
// random one. Later runs pick from the broader pool (run_start context).
const INTRO_SEED = 0xf1357;

export class TutorialIntroScene extends Phaser.Scene {
  private meta: MetaState | null = null;

  constructor() {
    super({ key: 'TutorialIntroScene' });
  }

  init(data: Record<string, unknown>): void {
    if (data['meta'] !== undefined) this.meta = data['meta'] as MetaState;
  }

  create(): void {
    this.add.graphics().fillStyle(C.bg).fillRect(0, 0, W, H);

    this.buildLayout();
  }

  private buildLayout(): void {
    // Header region — VEIN enters the scene
    this.add.text(CX, 140, 'THE VEIN CALLS', {
      fontFamily: 'monospace',
      fontSize: '22px',
      color: C.accent,
      letterSpacing: 6,
    }).setOrigin(0.5).setAlpha(0);

    // LACE quote box
    const laceText = this.getLaceIntroLine();
    const quoteY = 260;
    const quoteBox = this.add.graphics();
    quoteBox
      .fillStyle(C.surface)
      .fillRoundedRect(24, quoteY - 16, W - 48, 140, 10);
    quoteBox
      .lineStyle(1, C.border)
      .strokeRoundedRect(24, quoteY - 16, W - 48, 140, 10);

    this.add.text(32, quoteY, 'LACE:', {
      fontFamily: 'monospace', fontSize: '10px', color: C.dim,
    });

    this.add.text(32, quoteY + 18, laceText, {
      fontFamily: 'monospace',
      fontSize: '13px',
      color: C.accent,
      fontStyle: 'italic',
      wordWrap: { width: W - 64 },
      lineSpacing: 4,
    });

    // Instructional copy
    this.add.text(CX, 448, 'You are about to enter the VEIN.', {
      fontFamily: 'monospace', fontSize: '12px', color: C.text,
    }).setOrigin(0.5);

    this.add.text(CX, 472, 'The tutorial will teach you to move,\nfight, and mutate.', {
      fontFamily: 'monospace',
      fontSize: '11px',
      color: C.dim,
      align: 'center',
      lineSpacing: 4,
    }).setOrigin(0.5, 0);

    this.add.text(CX, 530, 'It takes about 3 minutes.', {
      fontFamily: 'monospace', fontSize: '10px', color: C.dim,
    }).setOrigin(0.5);

    // CTA button
    const btnY = 630;
    const btnW = 260;
    const btnX = (W - btnW) / 2;
    const btnG = this.add.graphics();
    btnG.fillStyle(0x1a3028).fillRoundedRect(btnX, btnY, btnW, 56, 10);
    btnG.lineStyle(2, 0xa0ffdc).strokeRoundedRect(btnX, btnY, btnW, 56, 10);

    this.add.text(CX, btnY + 28, 'ENTER THE VEIN', {
      fontFamily: 'monospace', fontSize: '16px', color: C.accent,
    }).setOrigin(0.5);

    const zone = this.add
      .zone(btnX, btnY, btnW, 56)
      .setOrigin(0, 0)
      .setInteractive({ useHandCursor: true });
    zone.on('pointerdown', () => {
      this.scene.start('TutorialScene', { meta: this.meta });
    });

    // Skip hint (returning players who reset — though they'd have tutorialComplete set)
    this.add.text(CX, H - 36, 'first time? the tutorial is recommended', {
      fontFamily: 'monospace', fontSize: '9px', color: C.dim,
    }).setOrigin(0.5);

    // Fade in header with a slight delay after create
    const header = this.children.list[1]; // the header text
    if (header instanceof Phaser.GameObjects.Text) {
      this.tweens.add({ targets: header, alpha: 1, duration: 800, ease: 'Sine.easeIn' });
    }
  }

  /** Selects LACE's opening line. Uses the run_start context pool; falls back
   *  to a hardcoded line if the pool is empty (before content authoring). */
  private getLaceIntroLine(): string {
    const laceResult = parseLaceLines(laceCore);
    if (!laceResult.ok) return this.fallbackLine();

    const narrator = new LaceNarrator(laceResult.lines, makeRng(INTRO_SEED, 'events'));
    const line = narrator.narrate('run_start') ?? narrator.narrate('generic');
    return line?.text ?? this.fallbackLine();
  }

  private fallbackLine(): string {
    return 'You have come to the right place. Or the only place left. I find those tend to be the same.';
  }
}
