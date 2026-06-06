import Phaser from 'phaser';
import type { MetaState } from '@shared-types/meta-state';
import { newMetaState } from '../core/save';
import { addBackButton } from './settings-back-button';

/**
 * S092 Accessibility settings — T-212 (GDD §17, NFR a11y).
 *
 * Cognitive load mode, dyslexia-friendly font toggle, and font size.
 * Settings are session-local; renderer wiring is follow-up work.
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

type FontSize = 'small' | 'normal' | 'large';

/** Preview point-size for each font-size choice. */
const FONT_PX: Record<FontSize, number> = { small: 11, normal: 15, large: 21 };

/** Higher-legibility stack used when the dyslexia-friendly toggle is on. */
const DYSLEXIA_FONT = 'Verdana, Tahoma, sans-serif';

export class AccessibilitySettingsScene extends Phaser.Scene {
  private meta: MetaState = newMetaState();
  private cogLoadReduced = false;
  private dyslexiaFont = false;
  private fontSize: FontSize = 'normal';

  constructor() {
    super({ key: 'AccessibilitySettingsScene' });
  }

  init(data: Record<string, unknown>): void {
    if (data['meta'] !== undefined) this.meta = data['meta'] as MetaState;
  }

  create(): void {
    this.add.graphics().fillStyle(C.bg).fillRect(0, 0, W, H);
    this.buildHeader();
    this.buildCogLoad(132);
    this.buildDyslexia(224);
    this.buildFontSize(316);
    this.buildPreview(420);
    addBackButton(this, () => this.scene.start('SettingsScene', { meta: this.meta }));
  }

  private buildHeader(): void {
    this.add.graphics().fillStyle(C.accentN, 0.12).fillRect(0, 0, W, 3);
    this.add.text(CX, 52, 'ACCESSIBILITY', { fontFamily: 'monospace', fontSize: '18px', color: C.text, letterSpacing: 4 }).setOrigin(0.5);
    this.add.text(CX, 80, 'make the descent comfortable for you', { fontFamily: 'monospace', fontSize: '10px', color: C.dim }).setOrigin(0.5);
    this.add.graphics().lineStyle(1, C.border).lineBetween(24, 104, W - 24, 104);
  }

  private buildCogLoad(y: number): void {
    this.buildToggle(y, 'REDUCED COGNITIVE LOAD', 'Hides non-essential UI during combat.', () => this.cogLoadReduced, (v) => { this.cogLoadReduced = v; });
  }

  private buildDyslexia(y: number): void {
    this.buildToggle(y, 'DYSLEXIA-FRIENDLY FONT', 'Switches to a higher-legibility typeface.', () => this.dyslexiaFont, (v) => { this.dyslexiaFont = v; });
  }

  private buildFontSize(y: number): void {
    this.add.text(24, y, 'FONT SIZE', { fontFamily: 'monospace', fontSize: '11px', color: C.dim, letterSpacing: 2 });

    const opts: FontSize[] = ['small', 'normal', 'large'];
    const btnW = (W - 48 - 16) / 3;
    opts.forEach((opt, i) => {
      const x = 24 + i * (btnW + 8);
      const g = this.add.graphics();
      const redraw = (): void => {
        g.clear();
        const active = this.fontSize === opt;
        g.fillStyle(active ? 0x1a3028 : C.surface).fillRoundedRect(x, y + 26, btnW, 40, 8);
        g.lineStyle(active ? 2 : 1, active ? C.accentN : C.border).strokeRoundedRect(x, y + 26, btnW, 40, 8);
      };
      redraw();
      this.add.text(x + btnW / 2, y + 46, opt.toUpperCase(), {
        fontFamily: 'monospace', fontSize: '10px',
        color: this.fontSize === opt ? C.accent : C.dim, letterSpacing: 1,
      }).setOrigin(0.5);
      const zone = this.add.zone(x, y + 26, btnW, 40).setOrigin(0, 0).setInteractive({ useHandCursor: true });
      zone.on('pointerdown', () => { this.fontSize = opt; this.scene.restart({ meta: this.meta }); });
      void redraw;
    });
  }

  /** Live preview reflecting the current font-size (and dyslexia-font) choice,
   *  so the controls visibly change something. */
  private buildPreview(y: number): void {
    const boxH = 96;
    const g = this.add.graphics();
    g.fillStyle(C.surface).fillRoundedRect(24, y, W - 48, boxH, 10);
    g.lineStyle(1, C.border).strokeRoundedRect(24, y, W - 48, boxH, 10);

    this.add.text(42, y + 12, 'PREVIEW', {
      fontFamily: 'monospace', fontSize: '9px', color: C.dim, letterSpacing: 2,
    });

    const fontFamily = this.dyslexiaFont ? DYSLEXIA_FONT : 'monospace';
    this.add.text(W / 2, y + 56, 'The VEIN whispers back.', {
      fontFamily, fontSize: `${FONT_PX[this.fontSize]}px`, color: C.text,
      align: 'center', wordWrap: { width: W - 80 },
    }).setOrigin(0.5);
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
    g.fillStyle(C.surfaceHi).fillRoundedRect(24, y, W - 48, rowH, 10);
    g.lineStyle(1, C.border).strokeRoundedRect(24, y, W - 48, rowH, 10);

    this.add.text(42, y + 18, label, { fontFamily: 'monospace', fontSize: '12px', color: C.text, letterSpacing: 2 });
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

}
