import Phaser from 'phaser';
import type { MetaState } from '@shared-types/meta-state';
import { newMetaState } from '../core/save';

/**
 * S097 Support / contact — T-217.
 *
 * Contact details and feedback/bug-report channel. Required for App Store /
 * Google Play compliance (support URL). Displays contact email and links;
 * actual link-opening uses window.open() (web) or falls back gracefully.
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

export class SupportScene extends Phaser.Scene {
  private meta: MetaState = newMetaState();

  constructor() {
    super({ key: 'SupportScene' });
  }

  init(data: Record<string, unknown>): void {
    if (data['meta'] !== undefined) this.meta = data['meta'] as MetaState;
  }

  create(): void {
    this.add.graphics().fillStyle(C.bg).fillRect(0, 0, W, H);
    this.buildHeader();
    this.buildCards();
    this.buildBackButton();
  }

  private buildHeader(): void {
    this.add.graphics().fillStyle(C.accentN, 0.12).fillRect(0, 0, W, 3);
    this.add.text(CX, 52, 'SUPPORT', { fontFamily: 'monospace', fontSize: '18px', color: C.text, letterSpacing: 4 }).setOrigin(0.5);
    this.add.text(CX, 80, 'contact us or report a bug', { fontFamily: 'monospace', fontSize: '10px', color: C.dim }).setOrigin(0.5);
    this.add.graphics().lineStyle(1, C.border).lineBetween(24, 104, W - 24, 104);
  }

  private buildCards(): void {
    const contacts: Array<{ label: string; value: string; subtitle: string; url: string | null }> = [
      {
        label: 'GENERAL SUPPORT',
        value: 'support@empathy.software',
        subtitle: 'Questions, feedback, and account issues.',
        url: 'mailto:support@empathy.software',
      },
      {
        label: 'BUG REPORTS',
        value: 'bugs@empathy.software',
        subtitle: 'Include your platform and build version.',
        url: 'mailto:bugs@empathy.software',
      },
      {
        label: 'PRIVACY INQUIRIES',
        value: 'privacy@empathy.software',
        subtitle: 'GDPR/CCPA requests and data questions.',
        url: 'mailto:privacy@empathy.software',
      },
    ];

    let y = 132;
    contacts.forEach((c) => {
      const cardH = 76;
      const g = this.add.graphics();
      g.fillStyle(C.surfaceHi).fillRoundedRect(24, y, W - 48, cardH, 10);
      g.lineStyle(1, C.border).strokeRoundedRect(24, y, W - 48, cardH, 10);

      this.add.text(40, y + 14, c.label, { fontFamily: 'monospace', fontSize: '10px', color: C.dim, letterSpacing: 2 });
      this.add.text(40, y + 32, c.value, { fontFamily: 'monospace', fontSize: '13px', color: C.accent });
      this.add.text(40, y + 54, c.subtitle, { fontFamily: 'monospace', fontSize: '10px', color: C.dim });

      if (c.url !== null) {
        const zone = this.add.zone(24, y, W - 48, cardH).setOrigin(0, 0).setInteractive({ useHandCursor: true });
        zone.on('pointerdown', () => {
          if (typeof window !== 'undefined') window.open(c.url as string, '_blank');
        });
        zone.on('pointerover', () => {
          g.clear();
          g.fillStyle(0x1e3048).fillRoundedRect(24, y, W - 48, cardH, 10);
          g.lineStyle(2, C.accentN, 0.8).strokeRoundedRect(24, y, W - 48, cardH, 10);
        });
        zone.on('pointerout', () => {
          g.clear();
          g.fillStyle(C.surfaceHi).fillRoundedRect(24, y, W - 48, cardH, 10);
          g.lineStyle(1, C.border).strokeRoundedRect(24, y, W - 48, cardH, 10);
        });
      }

      y += cardH + 12;
    });

    // App Store / Play Store links note
    this.add.text(CX, y + 16, 'You can also rate and review us on the', {
      fontFamily: 'monospace', fontSize: '10px', color: C.dim, align: 'center', wordWrap: { width: W - 48 },
    }).setOrigin(0.5, 0);
    this.add.text(CX, y + 34, 'App Store and Google Play.', {
      fontFamily: 'monospace', fontSize: '10px', color: C.dim,
    }).setOrigin(0.5, 0);
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
