import Phaser from 'phaser';
import type { MetaState } from '@shared-types/meta-state';
import { newMetaState } from '../core/save';
import { addBackButton } from './settings-back-button';
import {
  getCategoryVolume,
  setCategoryVolume,
} from './audio/audio-registry';
import type { AudioKind } from './audio/audio-manifest';

/**
 * S090 Audio settings — T-210.
 *
 * Three volume sliders: Music, SFX, UI.
 * Sliders update setCategoryVolume() immediately so the change is audible
 * at once (especially the music slider which live-updates the current track).
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

interface SliderDef {
  label: string;
  kind: AudioKind;
}

const SLIDERS: SliderDef[] = [
  { label: 'MUSIC',         kind: 'music' },
  { label: 'SOUND EFFECTS', kind: 'sfx'   },
  { label: 'UI SOUNDS',     kind: 'ui'    },
];

export class AudioSettingsScene extends Phaser.Scene {
  private meta: MetaState = newMetaState();

  constructor() {
    super({ key: 'AudioSettingsScene' });
  }

  init(data: Record<string, unknown>): void {
    if (data['meta'] !== undefined) this.meta = data['meta'] as MetaState;
  }

  create(): void {
    this.add.graphics().fillStyle(C.bg).fillRect(0, 0, W, H);
    this.buildHeader();
    SLIDERS.forEach((def, i) => this.buildSlider(def, 200 + i * 130));
    addBackButton(this, () => this.scene.start('SettingsScene', { meta: this.meta }));
  }

  // ── Header ───────────────────────────────────────────────────────────────

  private buildHeader(): void {
    this.add.graphics().fillStyle(C.accentN, 0.12).fillRect(0, 0, W, 3);
    this.add.text(CX, 52, 'AUDIO', { fontFamily: 'monospace', fontSize: '18px', color: C.text, letterSpacing: 4 }).setOrigin(0.5);
    this.add.text(CX, 80, 'adjust volume per category', { fontFamily: 'monospace', fontSize: '10px', color: C.dim }).setOrigin(0.5);
    this.add.graphics().lineStyle(1, C.border).lineBetween(24, 104, W - 24, 104);
  }

  // ── Slider ────────────────────────────────────────────────────────────────

  private buildSlider(def: SliderDef, topY: number): void {
    const trackX = 32;
    const trackW = W - 64;
    const trackH = 6;
    const thumbR = 11;
    const trackY = topY + 44;

    this.add.text(trackX, topY + 14, def.label, {
      fontFamily: 'monospace', fontSize: '12px', color: C.dim, letterSpacing: 2,
    });

    const valText = this.add.text(W - 32, topY + 14, `${Math.round(getCategoryVolume(def.kind) * 100)}%`, {
      fontFamily: 'monospace', fontSize: '12px', color: C.accent,
    }).setOrigin(1, 0);

    // Static track background
    this.add.graphics()
      .fillStyle(C.surface).fillRoundedRect(trackX, trackY - trackH / 2, trackW, trackH, 3);

    const fill = this.add.graphics();

    const redraw = (vol: number): void => {
      fill.clear();
      const fillW = Math.round(trackW * vol);
      if (fillW > 0) {
        fill.fillStyle(C.accentN).fillRoundedRect(trackX, trackY - trackH / 2, fillW, trackH, 3);
      }
      fill.fillStyle(C.accentN).fillCircle(trackX + fillW, trackY, thumbR);
      valText.setText(`${Math.round(vol * 100)}%`);
    };

    redraw(getCategoryVolume(def.kind));

    // Hit zone: full slider width + thumb overhang on each side
    const zone = this.add
      .zone(trackX - thumbR, trackY - thumbR * 2, trackW + thumbR * 2, thumbR * 4)
      .setOrigin(0, 0)
      .setInteractive({ useHandCursor: true });

    let active = false;

    const applyX = (px: number): void => {
      const vol = Math.max(0, Math.min(1, (px - trackX) / trackW));
      setCategoryVolume(def.kind, vol);
      redraw(vol);
    };

    zone.on('pointerdown', (ptr: Phaser.Input.Pointer) => {
      active = true;
      applyX(ptr.x);
    });
    this.input.on(Phaser.Input.Events.POINTER_MOVE, (ptr: Phaser.Input.Pointer) => {
      if (active) applyX(ptr.x);
    });
    this.input.on(Phaser.Input.Events.POINTER_UP, () => { active = false; });
  }

}
