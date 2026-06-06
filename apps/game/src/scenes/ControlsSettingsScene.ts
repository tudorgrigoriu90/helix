import Phaser from 'phaser';
import type { MetaState } from '@shared-types/meta-state';
import { newMetaState } from '../core/save';
import { addBackButton } from './settings-back-button';

/**
 * S093 Controls settings — T-213.
 *
 * Confirm-tap preference and animation speed.
 * Settings are session-local; game wiring is follow-up work.
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

type ConfirmTap = 'grace' | 'always' | 'never';
type AnimSpeed = 'normal' | 'fast' | 'instant';

export class ControlsSettingsScene extends Phaser.Scene {
  private meta: MetaState = newMetaState();
  private confirmTap: ConfirmTap = 'grace';
  private animSpeed: AnimSpeed = 'normal';

  constructor() {
    super({ key: 'ControlsSettingsScene' });
  }

  init(data: Record<string, unknown>): void {
    if (data['meta'] !== undefined) this.meta = data['meta'] as MetaState;
  }

  create(): void {
    this.add.graphics().fillStyle(C.bg).fillRect(0, 0, W, H);
    this.buildHeader();
    this.buildConfirmTap(130);
    this.buildAnimSpeed(360);
    addBackButton(this, () => this.scene.start('SettingsScene', { meta: this.meta }));
  }

  private buildHeader(): void {
    this.add.graphics().fillStyle(C.accentN, 0.12).fillRect(0, 0, W, 3);
    this.add.text(CX, 52, 'CONTROLS', { fontFamily: 'monospace', fontSize: '18px', color: C.text, letterSpacing: 4 }).setOrigin(0.5);
    this.add.text(CX, 80, 'input and pacing preferences', { fontFamily: 'monospace', fontSize: '10px', color: C.dim }).setOrigin(0.5);
    this.add.graphics().lineStyle(1, C.border).lineBetween(24, 104, W - 24, 104);
  }

  private buildConfirmTap(topY: number): void {
    this.add.text(24, topY, 'CONFIRM-TAP', { fontFamily: 'monospace', fontSize: '11px', color: C.dim, letterSpacing: 2 });
    this.add.text(24, topY + 20, 'When a second tap is needed to confirm moves and actions.', {
      fontFamily: 'monospace', fontSize: '10px', color: C.dim, wordWrap: { width: W - 48 },
    });

    const opts: Array<{ id: ConfirmTap; label: string; sub: string }> = [
      { id: 'grace',  label: 'GRACE PERIOD', sub: 'First 3 runs only' },
      { id: 'always', label: 'ALWAYS',       sub: 'Max safety'        },
      { id: 'never',  label: 'NEVER',        sub: 'Veteran mode'      },
    ];

    opts.forEach((opt, i) => {
      const y = topY + 58 + i * 48;
      const g = this.add.graphics();
      const redraw = (): void => {
        g.clear();
        const active = this.confirmTap === opt.id;
        g.fillStyle(active ? 0x1a3028 : C.surface).fillRoundedRect(24, y, W - 48, 38, 8);
        g.lineStyle(active ? 2 : 1, active ? C.accentN : C.border).strokeRoundedRect(24, y, W - 48, 38, 8);
      };
      redraw();
      this.add.text(42, y + 10, opt.label, { fontFamily: 'monospace', fontSize: '12px', color: this.confirmTap === opt.id ? C.accent : C.text });
      this.add.text(W - 42, y + 10, opt.sub, { fontFamily: 'monospace', fontSize: '10px', color: C.dim }).setOrigin(1, 0);
      const zone = this.add.zone(24, y, W - 48, 38).setOrigin(0, 0).setInteractive({ useHandCursor: true });
      zone.on('pointerdown', () => { this.confirmTap = opt.id; this.scene.restart({ meta: this.meta }); });
      void redraw;
    });
  }

  private buildAnimSpeed(topY: number): void {
    this.add.text(24, topY, 'ANIMATION SPEED', { fontFamily: 'monospace', fontSize: '11px', color: C.dim, letterSpacing: 2 });
    this.add.text(24, topY + 20, 'Enemy-phase and sequence playback speed.', {
      fontFamily: 'monospace', fontSize: '10px', color: C.dim,
    });

    const opts: Array<{ id: AnimSpeed; label: string }> = [
      { id: 'normal',  label: 'NORMAL'  },
      { id: 'fast',    label: 'FAST'    },
      { id: 'instant', label: 'INSTANT' },
    ];

    const btnW = (W - 48 - 16) / 3;
    opts.forEach((opt, i) => {
      const x = 24 + i * (btnW + 8);
      const g = this.add.graphics();
      const redraw = (): void => {
        g.clear();
        const active = this.animSpeed === opt.id;
        g.fillStyle(active ? 0x1a3028 : C.surface).fillRoundedRect(x, topY + 48, btnW, 40, 8);
        g.lineStyle(active ? 2 : 1, active ? C.accentN : C.border).strokeRoundedRect(x, topY + 48, btnW, 40, 8);
      };
      redraw();
      this.add.text(x + btnW / 2, topY + 68, opt.label, {
        fontFamily: 'monospace', fontSize: '10px', color: this.animSpeed === opt.id ? C.accent : C.dim, letterSpacing: 1,
      }).setOrigin(0.5);
      const zone = this.add.zone(x, topY + 48, btnW, 40).setOrigin(0, 0).setInteractive({ useHandCursor: true });
      zone.on('pointerdown', () => { this.animSpeed = opt.id; this.scene.restart({ meta: this.meta }); });
      void redraw;
    });
  }

}
