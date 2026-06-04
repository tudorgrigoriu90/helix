import Phaser from 'phaser';
import type { MetaState } from '@shared-types/meta-state';
import { newMetaState } from '../core/save';

/**
 * S020 Floor Transition — T-149.
 *
 * Async-generation mask shown between floor completion and the next floor
 * starting. Reveals "FLOOR N" with a sweep wipe, runs a brief async pause
 * to represent world-gen, then continues to the game scene.
 *
 * Receives: { meta, originId, seed, floorNumber } from RunPreviewScene (or
 *   GameScene on descend).
 * Transitions to: GameScene (the production run loop).
 */

const W = 390;
const H = 844;
const CX = W / 2;
const CY = H / 2;

const C = {
  bg: 0x000000,
  accent: '#a0ffdc',
  accentN: 0xa0ffdc,
  dim: '#7a8fad',
  text: '#e8edf5',
};

export class FloorTransitionScene extends Phaser.Scene {
  private meta: MetaState = newMetaState();
  private originId = 'void_diver';
  private seed = 0;
  private floorNumber = 1;

  constructor() {
    super({ key: 'FloorTransitionScene' });
  }

  init(data: Record<string, unknown>): void {
    if (data['meta'] !== undefined) this.meta = data['meta'] as MetaState;
    if (typeof data['originId'] === 'string') this.originId = data['originId'];
    if (typeof data['seed'] === 'number') this.seed = data['seed'];
    if (typeof data['floorNumber'] === 'number') this.floorNumber = data['floorNumber'];
  }

  create(): void {
    // Full black background — the wipe starts from complete darkness.
    this.add.graphics().fillStyle(C.bg).fillRect(0, 0, W, H);

    this.buildTransition();
  }

  private buildTransition(): void {
    // ── Floor number label ─────────────────────────────────────────────────
    const floorLabel = this.add.text(CX, CY - 18, `FLOOR ${this.floorNumber}`, {
      fontFamily: 'monospace',
      fontSize: '36px',
      color: C.accent,
      letterSpacing: 12,
    }).setOrigin(0.5).setAlpha(0);

    const subLabel = this.add.text(CX, CY + 32, 'generating…', {
      fontFamily: 'monospace',
      fontSize: '11px',
      color: C.dim,
    }).setOrigin(0.5).setAlpha(0);

    // ── Horizontal sweep mask ─────────────────────────────────────────────
    // A teal line sweeps left-to-right as if "scanning" the floor into existence.
    const sweepG = this.add.graphics();

    // Phase 1: floor label fades in (300ms)
    this.tweens.add({
      targets: floorLabel,
      alpha: 1,
      duration: 300,
      ease: 'Sine.easeIn',
      onComplete: () => {
        // Phase 2: sub-label fades in + sweep line animates (400ms)
        this.tweens.add({
          targets: subLabel,
          alpha: 1,
          duration: 200,
          ease: 'Sine.easeIn',
        });

        // Sweep the teal scan line across the full width
        const sweepProgress = { t: 0 };
        this.tweens.add({
          targets: sweepProgress,
          t: 1,
          duration: 400,
          ease: 'Sine.easeInOut',
          onUpdate: () => {
            const x = sweepProgress.t * W;
            sweepG.clear();
            sweepG.lineStyle(2, C.accentN, 0.8).lineBetween(x, 0, x, H);
            // Trailing glow fill to the left of the sweep line
            sweepG.fillStyle(C.accentN, 0.04).fillRect(0, 0, x, H);
          },
          onComplete: () => {
            sweepG.clear();

            // Phase 3: hold briefly, update sub-label, then fade out
            this.time.delayedCall(300, () => {
              subLabel.setText('descent begins');

              this.time.delayedCall(200, () => {
                // Fade everything to black and hand off
                this.tweens.add({
                  targets: [floorLabel, subLabel],
                  alpha: 0,
                  duration: 200,
                  ease: 'Sine.easeIn',
                  onComplete: () => this.handOff(),
                });
              });
            });
          },
        });
      },
    });
  }

  private handOff(): void {
    this.scene.start('GameScene', {
      meta: this.meta,
      originId: this.originId,
      seed: this.seed,
    });
  }
}
