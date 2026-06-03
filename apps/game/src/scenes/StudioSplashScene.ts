import Phaser from 'phaser';

/**
 * S002 Empathy Software studio splash — T-125.
 *
 * Shown immediately after ColdSplashScene. A minimal geometric emblem +
 * the studio name. Fades in 0.8 s, holds 1 s, fades out 0.6 s.
 * Any tap skips.
 *
 * Transitions to GameBootScene (T-136), which handles async boot logic
 * (save loading, resume decision, routing to Hub or Tutorial).
 */
export class StudioSplashScene extends Phaser.Scene {
  private gone = false;

  constructor() {
    super({ key: 'StudioSplashScene' });
  }

  create(): void {
    const W = this.scale.width;
    const H = this.scale.height;
    const cx = W / 2;
    const cy = H / 2;

    this.add.graphics().fillStyle(0x070b14).fillRect(0, 0, W, H);

    // Emblem: outer ring + inner diamond (rhombus) — simple, geometric.
    const emblem = this.buildEmblem(cx, cy - 44);

    const studioName = this.add
      .text(cx, cy + 10, 'EMPATHY SOFTWARE', {
        fontFamily: 'monospace',
        fontSize: '14px',
        color: '#7a8fad',
        letterSpacing: 5,
      })
      .setOrigin(0.5)
      .setAlpha(0);

    const motto = this.add
      .text(cx, cy + 32, 'games that feel like something', {
        fontFamily: 'monospace',
        fontSize: '10px',
        color: '#2a3a50',
      })
      .setOrigin(0.5)
      .setAlpha(0);

    const targets = [emblem, studioName, motto];

    this.input.once('pointerdown', () => this.advance());

    this.tweens.add({
      targets,
      alpha: 1,
      duration: 800,
      ease: 'Sine.easeIn',
      onComplete: () => {
        this.time.delayedCall(1000, () => {
          if (this.gone) return;
          this.tweens.add({
            targets,
            alpha: 0,
            duration: 600,
            ease: 'Sine.easeOut',
            onComplete: () => this.advance(),
          });
        });
      },
    });
  }

  private advance(): void {
    if (this.gone) return;
    this.gone = true;
    this.scene.start('GameBootScene');
  }

  /** Concentric ring + diamond emblem, returned at alpha=0. */
  private buildEmblem(cx: number, cy: number): Phaser.GameObjects.Graphics {
    const g = this.add.graphics().setAlpha(0);
    const outerR = 30;
    const innerR = 15;

    // Outer ring — subtle teal glow
    g.lineStyle(1.5, 0xa0ffdc, 0.45).strokeCircle(cx, cy, outerR);
    g.fillStyle(0xa0ffdc, 0.06).fillCircle(cx, cy, outerR);

    // Inner diamond: four vertices at cardinal points of innerR
    g.lineStyle(1.5, 0xa0ffdc, 0.8);
    g.beginPath();
    g.moveTo(cx, cy - innerR);
    g.lineTo(cx + innerR, cy);
    g.lineTo(cx, cy + innerR);
    g.lineTo(cx - innerR, cy);
    g.closePath();
    g.strokePath();

    // Centre dot
    g.fillStyle(0xa0ffdc, 0.6).fillCircle(cx, cy, 3);

    return g;
  }
}
