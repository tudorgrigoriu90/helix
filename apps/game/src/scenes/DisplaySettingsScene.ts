import Phaser from 'phaser';
import type { MetaState } from '@shared-types/meta-state';
import { newMetaState } from '../core/save';

/**
 * S091 Display settings — T-211 (NFR a11y).
 *
 * Colour-blind simulation mode and reduced motion toggle.
 * Settings are session-local; wiring to the renderer is follow-up work.
 *
 * Receives: { meta: MetaState } from SettingsScene.
 * Back → SettingsScene.
 */

const W = 390;
const H = 844;
const CX = W / 2;

const C = {
  bg:        0x070b14,
  surface:   0x0e1626,
  surfaceHi: 0x1a2840,
  border:    0x1e2a40,
  accentN:   0xa0ffdc,
  accent:    '#a0ffdc',
  dim:       '#7a8fad',
  text:      '#e8edf5',
};

type ColorBlindMode = 'none' | 'deuteranopia' | 'protanopia' | 'tritanopia';

const COLOR_BLIND_MODES: Array<{ id: ColorBlindMode; label: string }> = [
  { id: 'none',         label: 'OFF'          },
  { id: 'deuteranopia', label: 'Deuteranopia' },
  { id: 'protanopia',   label: 'Protanopia'   },
  { id: 'tritanopia',   label: 'Tritanopia'   },
];

export class DisplaySettingsScene extends Phaser.Scene {
  private meta: MetaState = newMetaState();
  private colorBlindMode: ColorBlindMode = 'none';
  private reducedMotion = false;

  constructor() {
    super({ key: 'DisplaySettingsScene' });
  }

  init(data: Record<string, unknown>): void {
    if (data['meta'] !== undefined) this.meta = data['meta'] as MetaState;
  }

  create(): void {
    this.add.graphics().fillStyle(C.bg).fillRect(0, 0, W, H);
    this.buildHeader();
    this.buildColorBlind();
    this.buildReducedMotion();
    this.buildBackButton();
  }

  private buildHeader(): void {
    this.add.graphics().fillStyle(C.accentN, 0.12).fillRect(0, 0, W, 3);
    this.add.text(CX, 52, 'DISPLAY', { fontFamily: 'monospace', fontSize: '18px', color: C.text, letterSpacing: 4 }).setOrigin(0.5);
    this.add.text(CX, 80, 'colour & motion preferences', { fontFamily: 'monospace', fontSize: '10px', color: C.dim }).setOrigin(0.5);
    this.add.graphics().lineStyle(1, C.border).lineBetween(24, 104, W - 24, 104);
  }

  private buildColorBlind(): void {
    const topY = 132;
    this.add.text(24, topY, 'COLOUR-BLIND MODE', {
      fontFamily: 'monospace', fontSize: '11px', color: C.dim, letterSpacing: 2,
    });
    this.add.text(24, topY + 20, 'Adjusts palette to simulate each mode.', {
      fontFamily: 'monospace', fontSize: '10px', color: C.dim,
    });

    const btnY = topY + 50;
    const btnW = (W - 48 - 12 * 3) / 4;
    COLOR_BLIND_MODES.forEach((mode, i) => {
      const x = 24 + i * (btnW + 12);
      const g = this.add.graphics();
      const redraw = (): void => {
        g.clear();
        const active = this.colorBlindMode === mode.id;
        g.fillStyle(active ? 0x1a3028 : C.surface).fillRoundedRect(x, btnY, btnW, 40, 8);
        g.lineStyle(active ? 2 : 1, active ? C.accentN : C.border).strokeRoundedRect(x, btnY, btnW, 40, 8);
      };
      redraw();
      const t = this.add.text(x + btnW / 2, btnY + 20, mode.label, {
        fontFamily: 'monospace', fontSize: '10px', color: this.colorBlindMode === mode.id ? C.accent : C.dim,
      }).setOrigin(0.5);
      const zone = this.add.zone(x, btnY, btnW, 40).setOrigin(0, 0).setInteractive({ useHandCursor: true });
      zone.on('pointerdown', () => {
        this.colorBlindMode = mode.id;
        // Rebuild to refresh all buttons' appearance
        this.scene.restart({ meta: this.meta });
      });
      void t; void redraw;
    });
  }

  private buildReducedMotion(): void {
    const y = 284;
    this.buildToggle(y, 'REDUCED MOTION', 'Skips non-essential animations.', () => this.reducedMotion, (v) => { this.reducedMotion = v; });
  }

  private buildToggle(
    y: number,
    label: string,
    subtitle: string,
    get: () => boolean,
    set: (v: boolean) => void,
  ): void {
    const rowH = 72;
    const g = this.add.graphics();
    const redraw = (): void => {
      g.clear();
      g.fillStyle(C.surfaceHi).fillRoundedRect(24, y, W - 48, rowH, 10);
      g.lineStyle(1, C.border).strokeRoundedRect(24, y, W - 48, rowH, 10);
    };
    redraw();

    this.add.text(42, y + 18, label, { fontFamily: 'monospace', fontSize: '13px', color: C.text, letterSpacing: 2 });
    this.add.text(42, y + 42, subtitle, { fontFamily: 'monospace', fontSize: '10px', color: C.dim });

    const pill = this.add.graphics();
    const pillLabel = this.add.text(0, 0, '');
    const pillX = W - 24 - 72 - 16;
    const pillY = y + rowH / 2 - 14;

    const drawPill = (): void => {
      pill.clear();
      const on = get();
      pill.fillStyle(on ? 0x1a3028 : C.surface).fillRoundedRect(pillX, pillY, 72, 28, 14);
      pill.lineStyle(2, on ? C.accentN : C.border).strokeRoundedRect(pillX, pillY, 72, 28, 14);
      pillLabel.setText(on ? 'ON' : 'OFF').setPosition(pillX + 36, pillY + 14).setOrigin(0.5)
        .setStyle({ fontFamily: 'monospace', fontSize: '11px', color: on ? C.accent : C.dim, letterSpacing: 2 });
    };
    drawPill();

    const zone = this.add.zone(24, y, W - 48, rowH).setOrigin(0, 0).setInteractive({ useHandCursor: true });
    zone.on('pointerdown', () => { set(!get()); drawPill(); });
  }

  private buildBackButton(): void {
    const y = H - 52;
    const t = this.add.text(CX, y, '← BACK', { fontFamily: 'monospace', fontSize: '11px', color: C.dim }).setOrigin(0.5);
    const zone = this.add.zone(CX - 50, y - 12, 100, 32).setOrigin(0, 0).setInteractive({ useHandCursor: true });
    zone.on('pointerdown', () => this.scene.start('SettingsScene', { meta: this.meta }));
    zone.on('pointerover', () => t.setColor(C.accent));
    zone.on('pointerout',  () => t.setColor(C.dim));
  }
}
