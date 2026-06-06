import Phaser from 'phaser';
import type { MetaState } from '@shared-types/meta-state';
import { newMetaState } from '../core/save';
import { addBackButton } from './settings-back-button';

/**
 * S095 Privacy settings — T-215 (NFR P6, GDPR/CCPA mandatory).
 *
 * Informs the player about data collection (none — no PII is stored on
 * device or in the cloud beyond gameplay state), offers data export and
 * account deletion CTAs (which route to the respective Cloud Function
 * screens when those are built in T-220/T-221), and links to the privacy
 * policy URL.
 *
 * This screen must exist and be reachable from Settings for App Store and
 * Google Play compliance.
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
  danger:    '#ff4444',
  dangerN:   0xff4444,
};

export class PrivacyScene extends Phaser.Scene {
  private meta: MetaState = newMetaState();

  constructor() {
    super({ key: 'PrivacyScene' });
  }

  init(data: Record<string, unknown>): void {
    if (data['meta'] !== undefined) this.meta = data['meta'] as MetaState;
  }

  create(): void {
    this.add.graphics().fillStyle(C.bg).fillRect(0, 0, W, H);
    this.buildHeader();
    this.buildDataNotice();
    this.buildActions();
    addBackButton(this, () => this.scene.start('SettingsScene', { meta: this.meta }));
  }

  private buildHeader(): void {
    this.add.graphics().fillStyle(C.accentN, 0.12).fillRect(0, 0, W, 3);
    this.add.text(CX, 52, 'PRIVACY', { fontFamily: 'monospace', fontSize: '18px', color: C.text, letterSpacing: 4 }).setOrigin(0.5);
    this.add.text(CX, 80, 'GDPR / CCPA data controls', { fontFamily: 'monospace', fontSize: '10px', color: C.dim }).setOrigin(0.5);
    this.add.graphics().lineStyle(1, C.border).lineBetween(24, 104, W - 24, 104);
  }

  private buildDataNotice(): void {
    const cardX = 24;
    const cardY = 126;
    const cardW = W - 48;

    const lines: Array<{ text: string; isHeading: boolean }> = [
      { text: 'WHAT WE COLLECT', isHeading: true },
      { text: '', isHeading: false },
      { text: 'Strand Descent stores gameplay state', isHeading: false },
      { text: '(run progress, mutations, meta stats)', isHeading: false },
      { text: 'locally on your device only.', isHeading: false },
      { text: '', isHeading: false },
      { text: 'No personally identifiable information', isHeading: false },
      { text: 'is collected. No third-party analytics', isHeading: false },
      { text: 'SDKs are active in this build.', isHeading: false },
      { text: '', isHeading: false },
      { text: 'Cloud sync, when enabled (T-214),', isHeading: false },
      { text: 'uploads only hashed IDs and gameplay', isHeading: false },
      { text: 'counters — never name, email, or', isHeading: false },
      { text: 'device identifiers.', isHeading: false },
    ];

    // Pre-compute height, draw card first, then text on top
    let totalH = 16;
    lines.forEach((l) => { totalH += l.isHeading ? 18 : l.text === '' ? 8 : 15; });
    totalH += 16;

    const g = this.add.graphics();
    g.fillStyle(C.surface).fillRoundedRect(cardX, cardY, cardW, totalH, 10);
    g.lineStyle(1, C.border).strokeRoundedRect(cardX, cardY, cardW, totalH, 10);

    let lineY = cardY + 16;
    lines.forEach((l) => {
      this.add.text(cardX + 16, lineY, l.text, {
        fontFamily: 'monospace',
        fontSize: l.isHeading ? '11px' : '10px',
        color: l.isHeading ? C.accent : C.dim,
        letterSpacing: l.isHeading ? 2 : 0,
      });
      lineY += l.isHeading ? 18 : l.text === '' ? 8 : 15;
    });

    this.buildActionsY = cardY + totalH + 24;
  }

  private buildActionsY = 500;

  private buildActions(): void {
    const y = this.buildActionsY;

    // Data export CTA
    this.buildActionRow(y, 'EXPORT MY DATA', 'Download a copy of your save data (T-220).', C.accent, C.accentN, () => {
      // T-220 DataExportScene — pending
      this.add.text(CX, y + 24, 'Coming soon in T-220.', {
        fontFamily: 'monospace', fontSize: '10px', color: C.dim,
      }).setOrigin(0.5).setDepth(2);
    });

    // Delete account CTA
    this.buildActionRow(y + 72, 'DELETE MY DATA', 'Permanently erase all saved data (T-221).', C.danger, C.dangerN, () => {
      // T-221 DeleteAccountScene — pending
      this.add.text(CX, y + 96, 'Coming soon in T-221.', {
        fontFamily: 'monospace', fontSize: '10px', color: C.dim,
      }).setOrigin(0.5).setDepth(2);
    });
  }

  private buildActionRow(
    y: number,
    label: string,
    subtitle: string,
    labelColor: string,
    borderColor: number,
    onTap: () => void,
  ): void {
    const g = this.add.graphics();
    g.fillStyle(C.surfaceHi).fillRoundedRect(24, y, W - 48, 56, 10);
    g.lineStyle(1, borderColor, 0.4).strokeRoundedRect(24, y, W - 48, 56, 10);

    this.add.text(42, y + 14, label, { fontFamily: 'monospace', fontSize: '13px', color: labelColor, letterSpacing: 2 }).setDepth(1);
    this.add.text(42, y + 36, subtitle, { fontFamily: 'monospace', fontSize: '10px', color: C.dim }).setDepth(1);

    const zone = this.add.zone(24, y, W - 48, 56).setOrigin(0, 0).setInteractive({ useHandCursor: true });
    zone.on('pointerdown', onTap);
    zone.on('pointerover', () => {
      g.clear();
      g.fillStyle(0x1e3048).fillRoundedRect(24, y, W - 48, 56, 10);
      g.lineStyle(2, borderColor).strokeRoundedRect(24, y, W - 48, 56, 10);
    });
    zone.on('pointerout', () => {
      g.clear();
      g.fillStyle(C.surfaceHi).fillRoundedRect(24, y, W - 48, 56, 10);
      g.lineStyle(1, borderColor, 0.4).strokeRoundedRect(24, y, W - 48, 56, 10);
    });
  }

}
