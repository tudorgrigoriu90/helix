import Phaser from 'phaser';
import type { MetaState } from '@shared-types/meta-state';
import { newMetaState } from '../core/save';
import { addBackButton } from './settings-back-button';

/**
 * S083 Settings root — T-202.
 *
 * The settings hub: a vertical list of category rows (Audio, Display,
 * Accessibility, Controls, Privacy, About). Each row is a navigation entry
 * into a dedicated sub-screen (T-210 → T-216); those sub-screens are not yet
 * built, so the rows render as locked placeholders. Privacy is GDPR/CCPA
 * mandatory (NFR P6) and About carries the licence attribution, so both are
 * surfaced now even while inert.
 *
 * Receives: { meta: MetaState } from HubScene.
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
};

interface SettingRow {
  label: string;
  subtitle: string;
  /** Target scene key once the sub-screen exists; null while still a stub. */
  target: string | null;
}

const ROWS: SettingRow[] = [
  { label: 'AUDIO',         subtitle: 'Music, SFX, UI volume.',                  target: 'AudioSettingsScene'         },
  { label: 'DISPLAY',       subtitle: 'Colour-blind mode, reduced motion.',       target: 'DisplaySettingsScene'       },
  { label: 'ACCESSIBILITY', subtitle: 'Cognitive load, dyslexia font, text size.', target: 'AccessibilitySettingsScene' },
  { label: 'CONTROLS',      subtitle: 'Confirm-tap, animation speed.',            target: 'ControlsSettingsScene'      },
  { label: 'PRIVACY',       subtitle: 'GDPR / CCPA data controls.',               target: 'PrivacyScene'               },
  { label: 'ABOUT',         subtitle: 'Version and licences.',                    target: 'AboutScene'                 },
  { label: 'SUPPORT',      subtitle: 'Contact us or report a bug.',              target: 'SupportScene'               },
];

export class SettingsScene extends Phaser.Scene {
  private meta: MetaState = newMetaState();

  constructor() {
    super({ key: 'SettingsScene' });
  }

  init(data: Record<string, unknown>): void {
    if (data['meta'] !== undefined) this.meta = data['meta'] as MetaState;
  }

  create(): void {
    this.add.graphics().fillStyle(C.bg).fillRect(0, 0, W, H);
    this.buildHeader();
    this.buildRows();
    addBackButton(this, () => this.scene.start('HubScene', { meta: this.meta }), 772);
  }

  // ── Header ───────────────────────────────────────────────────────────────

  private buildHeader(): void {
    this.add.graphics().fillStyle(C.accentN, 0.12).fillRect(0, 0, W, 3);

    this.add.text(CX, 52, 'SETTINGS', {
      fontFamily: 'monospace',
      fontSize: '18px',
      color: C.text,
      letterSpacing: 4,
    }).setOrigin(0.5);

    this.add.text(CX, 80, 'tune the descent to your liking', {
      fontFamily: 'monospace',
      fontSize: '10px',
      color: C.dim,
    }).setOrigin(0.5);

    this.add.graphics()
      .lineStyle(1, C.border)
      .lineBetween(24, 104, W - 24, 104);
  }

  // ── Category rows ──────────────────────────────────────────────────────────

  private buildRows(): void {
    // 7 rows must clear the boxed back button at y=772; a 76px row + 12px gap
    // (88px pitch) ends the last row at ~736, leaving a clean margin.
    const top = 132;
    const rowH = 76;
    const gap = 12;

    ROWS.forEach((row, i) => {
      const y = top + i * (rowH + gap);
      this.settingRow(y, rowH, row);
    });
  }

  private settingRow(y: number, h: number, row: SettingRow): void {
    const x = 24;
    const w = W - 48;
    const locked = row.target === null;

    const g = this.add.graphics();
    g.fillStyle(locked ? C.surface : C.surfaceHi).fillRoundedRect(x, y, w, h, 10);
    g.lineStyle(1, locked ? C.border : C.borderHi).strokeRoundedRect(x, y, w, h, 10);

    this.add.text(x + 18, y + 20, row.label, {
      fontFamily: 'monospace',
      fontSize: '15px',
      color: locked ? C.dim : C.text,
      letterSpacing: 2,
    });

    this.add.text(x + 18, y + 46, row.subtitle, {
      fontFamily: 'monospace', fontSize: '10px', color: C.dim,
    });

    if (locked) {
      this.add.text(x + w - 18, y + h / 2, '🔒', { fontSize: '13px' }).setOrigin(1, 0.5);
      return;
    }

    this.add.text(x + w - 18, y + h / 2, '›', {
      fontFamily: 'monospace', fontSize: '20px', color: C.accent,
    }).setOrigin(1, 0.5);

    const zone = this.add.zone(x, y, w, h).setOrigin(0, 0).setInteractive({ useHandCursor: true });
    zone.on('pointerdown', () => {
      if (row.target !== null) this.scene.start(row.target, { meta: this.meta });
    });
    zone.on('pointerover', () => {
      g.clear();
      g.fillStyle(0x1e3048).fillRoundedRect(x, y, w, h, 10);
      g.lineStyle(2, C.accentN, 0.8).strokeRoundedRect(x, y, w, h, 10);
    });
    zone.on('pointerout', () => {
      g.clear();
      g.fillStyle(C.surfaceHi).fillRoundedRect(x, y, w, h, 10);
      g.lineStyle(1, C.borderHi).strokeRoundedRect(x, y, w, h, 10);
    });
  }

}
