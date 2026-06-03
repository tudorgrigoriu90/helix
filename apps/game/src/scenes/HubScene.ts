import Phaser from 'phaser';
import type { MetaState } from '@shared-types/meta-state';
import { newMetaState } from '../core/save';

/**
 * S017 Hub — T-144.
 *
 * The player's home between runs. Shows the lifetime stats from MetaState,
 * provides the entry point for starting a new run, and surfaces secondary
 * navigation (Codex, Settings).
 *
 * Receives: { meta: MetaState } from GameBootScene (or any upstream scene).
 * Transitions: START DESCENT → OriginSelectScene (T-145).
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
  danger: '#ff4444',
};

export class HubScene extends Phaser.Scene {
  private meta: MetaState = newMetaState();

  constructor() {
    super({ key: 'HubScene' });
  }

  init(data: Record<string, unknown>): void {
    if (data['meta'] !== undefined) this.meta = data['meta'] as MetaState;
  }

  create(): void {
    this.add.graphics().fillStyle(C.bg).fillRect(0, 0, W, H);
    this.buildHeader();
    this.buildStats();
    this.buildMenu();
    this.buildFooter();
  }

  // ── Header ───────────────────────────────────────────────────────────────

  private buildHeader(): void {
    // Thin teal top accent stripe
    this.add.graphics().fillStyle(C.accentN, 0.12).fillRect(0, 0, W, 3);

    this.add.text(CX, 60, 'STRAND DESCENT', {
      fontFamily: 'monospace',
      fontSize: '24px',
      color: C.text,
      letterSpacing: 6,
    }).setOrigin(0.5);

    this.add.text(CX, 92, 'EMPATHY SOFTWARE', {
      fontFamily: 'monospace',
      fontSize: '10px',
      color: C.dim,
      letterSpacing: 4,
    }).setOrigin(0.5);

    // Separator line
    this.add.graphics()
      .lineStyle(1, C.border)
      .lineBetween(24, 116, W - 24, 116);
  }

  // ── Lifetime stats strip ──────────────────────────────────────────────────

  private buildStats(): void {
    const stats = this.meta.lifetime;
    const y = 134;

    const items: Array<{ label: string; value: string | number }> = [
      { label: 'RUNS', value: stats.runs },
      { label: 'WINS', value: stats.wins },
      { label: 'DEPTH', value: stats.deepestFloor === 0 ? '—' : `F${stats.deepestFloor}` },
      { label: 'SC', value: Math.floor(this.meta.shardCrystals) },
    ];

    const colW = W / items.length;
    items.forEach((item, i) => {
      const cx = i * colW + colW / 2;
      this.add.text(cx, y, String(item.value), {
        fontFamily: 'monospace', fontSize: '18px', color: C.accent,
      }).setOrigin(0.5, 0);
      this.add.text(cx, y + 26, item.label, {
        fontFamily: 'monospace', fontSize: '9px', color: C.dim,
      }).setOrigin(0.5, 0);
    });

    this.add.graphics()
      .lineStyle(1, C.border)
      .lineBetween(24, y + 56, W - 24, y + 56);
  }

  // ── Main menu ────────────────────────────────────────────────────────────

  private buildMenu(): void {
    const menuTop = 226;

    this.menuButton(menuTop, 'START DESCENT', C.accent, 'The VEIN awaits.', false, () => {
      this.scene.start('OriginSelectScene', { meta: this.meta });
    });

    this.menuButton(menuTop + 88, 'CODEX', C.dim, 'Knowledge earned in the dark.', true, null);
    this.menuButton(menuTop + 168, 'SETTINGS', C.accent, 'Audio, display, accessibility.', false, () => {
      this.scene.start('SettingsScene', { meta: this.meta });
    });
    this.menuButton(menuTop + 248, 'ABOUT', C.dim, 'Licences and legal.', true, null);
  }

  /** A full-width tappable menu row. `locked` rows show a padlock and are inert. */
  private menuButton(
    y: number,
    label: string,
    labelColor: string,
    subtitle: string,
    locked: boolean,
    onTap: (() => void) | null,
  ): void {
    const x = 24;
    const btnW = W - 48;
    const btnH = 70;

    const g = this.add.graphics();
    const fillColor = locked ? C.surface : C.surfaceHi;
    const strokeColor = locked ? C.border : C.borderHi;
    g.fillStyle(fillColor).fillRoundedRect(x, y, btnW, btnH, 10);
    g.lineStyle(1, strokeColor).strokeRoundedRect(x, y, btnW, btnH, 10);

    // Right-side accent for the primary action
    if (!locked) {
      g.fillStyle(C.accentN, 0.08).fillRoundedRect(x, y, btnW, btnH, 10);
      g.lineStyle(2, C.accentN, 0.5).strokeRoundedRect(x, y, btnW, btnH, 10);
    }

    this.add.text(x + 18, y + 18, label, {
      fontFamily: 'monospace',
      fontSize: locked ? '14px' : '16px',
      color: labelColor,
    });

    this.add.text(x + 18, y + 42, subtitle, {
      fontFamily: 'monospace', fontSize: '10px', color: C.dim,
    });

    if (locked) {
      this.add.text(x + btnW - 18, y + btnH / 2, '🔒', {
        fontSize: '14px',
      }).setOrigin(1, 0.5);
    } else {
      // Chevron arrow
      this.add.text(x + btnW - 18, y + btnH / 2, '›', {
        fontFamily: 'monospace', fontSize: '20px', color: C.accent,
      }).setOrigin(1, 0.5);
    }

    if (onTap !== null) {
      const zone = this.add
        .zone(x, y, btnW, btnH)
        .setOrigin(0, 0)
        .setInteractive({ useHandCursor: true });
      zone.on('pointerdown', onTap);

      // Hover highlight
      zone.on('pointerover', () => {
        g.clear();
        g.fillStyle(0x1e3048).fillRoundedRect(x, y, btnW, btnH, 10);
        g.lineStyle(2, C.accentN, 0.8).strokeRoundedRect(x, y, btnW, btnH, 10);
      });
      zone.on('pointerout', () => {
        g.clear();
        g.fillStyle(C.surfaceHi).fillRoundedRect(x, y, btnW, btnH, 10);
        g.lineStyle(2, C.accentN, 0.5).strokeRoundedRect(x, y, btnW, btnH, 10);
      });
    }
  }

  // ── Footer ───────────────────────────────────────────────────────────────

  private buildFooter(): void {
    this.add.graphics()
      .lineStyle(1, C.border)
      .lineBetween(24, H - 52, W - 24, H - 52);

    this.add.text(CX, H - 36, 'v0.1.0-alpha  ·  strand.empathy.software', {
      fontFamily: 'monospace', fontSize: '9px', color: C.dim,
    }).setOrigin(0.5);
  }
}
