import Phaser from 'phaser';
import type { MetaState } from '@shared-types/meta-state';
import { newMetaState } from '../core/save';
import { addBackButton } from './settings-back-button';

/**
 * S096 About + licences — T-216.
 *
 * App version, studio name, and third-party licence attributions.
 * Required for App Store / Google Play compliance (licence notices for
 * open-source and CC0 assets).
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
  border:    0x1e2a40,
  accentN:   0xa0ffdc,
  accent:    '#a0ffdc',
  dim:       '#7a8fad',
  text:      '#e8edf5',
};

const APP_VERSION = 'v0.1.0-alpha';

export class AboutScene extends Phaser.Scene {
  private meta: MetaState = newMetaState();

  constructor() {
    super({ key: 'AboutScene' });
  }

  init(data: Record<string, unknown>): void {
    if (data['meta'] !== undefined) this.meta = data['meta'] as MetaState;
  }

  create(): void {
    this.add.graphics().fillStyle(C.bg).fillRect(0, 0, W, H);
    this.buildHeader();
    this.buildAppInfo();
    this.buildLicences();
    addBackButton(this, () => this.scene.start('SettingsScene', { meta: this.meta }));
  }

  private buildHeader(): void {
    this.add.graphics().fillStyle(C.accentN, 0.12).fillRect(0, 0, W, 3);
    this.add.text(CX, 52, 'ABOUT', { fontFamily: 'monospace', fontSize: '18px', color: C.text, letterSpacing: 4 }).setOrigin(0.5);
    this.add.text(CX, 80, 'version, licences, and attribution', { fontFamily: 'monospace', fontSize: '10px', color: C.dim }).setOrigin(0.5);
    this.add.graphics().lineStyle(1, C.border).lineBetween(24, 104, W - 24, 104);
  }

  private buildAppInfo(): void {
    this.add.text(CX, 136, 'STRAND DESCENT', {
      fontFamily: 'monospace', fontSize: '20px', color: C.accent, letterSpacing: 6,
    }).setOrigin(0.5);

    this.add.text(CX, 166, APP_VERSION, {
      fontFamily: 'monospace', fontSize: '11px', color: C.dim,
    }).setOrigin(0.5);

    this.add.text(CX, 190, '© 2026 Empathy Software', {
      fontFamily: 'monospace', fontSize: '10px', color: C.dim,
    }).setOrigin(0.5);

    this.add.graphics().lineStyle(1, C.border, 0.4).lineBetween(24, 214, W - 24, 214);
  }

  private buildLicences(): void {
    const licences: Array<{ title: string; lines: string[] }> = [
      {
        title: 'ROGUELIKE / RPG PACK',
        lines: [
          'Kenney (kenney.nl)',
          'Creative Commons Zero — CC0 1.0 Universal',
          'Free to use in personal and commercial projects.',
        ],
      },
      {
        title: 'PHASER 3',
        lines: [
          'Photon Storm Ltd.',
          'MIT Licence',
        ],
      },
      {
        title: 'TYPESCRIPT',
        lines: [
          'Microsoft Corporation',
          'Apache Licence 2.0',
        ],
      },
      {
        title: 'VITE',
        lines: [
          'Evan You and contributors',
          'MIT Licence',
        ],
      },
    ];

    this.add.text(24, 228, 'THIRD-PARTY LICENCES', {
      fontFamily: 'monospace', fontSize: '10px', color: C.dim, letterSpacing: 2,
    });

    let y = 250;
    licences.forEach((lic) => {
      const cardH = 24 + lic.lines.length * 16 + 12;
      const g = this.add.graphics();
      g.fillStyle(C.surface).fillRoundedRect(24, y, W - 48, cardH, 8);
      g.lineStyle(1, C.border).strokeRoundedRect(24, y, W - 48, cardH, 8);

      this.add.text(38, y + 10, lic.title, {
        fontFamily: 'monospace', fontSize: '10px', color: C.accent, letterSpacing: 2,
      });

      lic.lines.forEach((line, li) => {
        this.add.text(38, y + 26 + li * 16, line, {
          fontFamily: 'monospace', fontSize: '10px', color: C.dim,
        });
      });

      y += cardH + 10;
    });
  }

}
