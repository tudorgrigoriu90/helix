import Phaser from 'phaser';

/**
 * S001 Cold-launch splash — T-124.
 *
 * First scene the player ever sees: STRAND DESCENT wordmark + an animated
 * double-helix logo. Fades in over 1.2 s, holds for 1.5 s, fades out over
 * 0.8 s. Any tap skips the animation immediately.
 *
 * Transitions to StudioSplashScene (T-125).
 */
export class ColdSplashScene extends Phaser.Scene {
  private gone = false;

  constructor() {
    super({ key: 'ColdSplashScene' });
  }

  create(): void {
    const W = this.scale.width;
    const H = this.scale.height;
    const cx = W / 2;
    const helixTop = H * 0.28;

    // Pure black BG — the canvas default is transparent, so fill it.
    this.add.graphics().fillStyle(0x000000).fillRect(0, 0, W, H);

    // Double-helix logo — drawn once into a Graphics object then tweened.
    const helix = this.buildHelix(cx, helixTop, 130);

    // Title + tagline
    const title = this.add
      .text(cx, helixTop + 150, 'STRAND DESCENT', {
        fontFamily: 'monospace',
        fontSize: '27px',
        color: '#e8edf5',
        letterSpacing: 8,
      })
      .setOrigin(0.5, 0)
      .setAlpha(0);

    const tagline = this.add
      .text(cx, helixTop + 195, 'descend  ·  mutate  ·  converge', {
        fontFamily: 'monospace',
        fontSize: '11px',
        color: '#3a5070',
      })
      .setOrigin(0.5, 0)
      .setAlpha(0);

    const targets = [helix, title, tagline];

    // Any tap skips the full animation.
    this.input.once('pointerdown', () => this.advance());

    // Sequence: fade-in → hold → fade-out → next.
    this.tweens.add({
      targets,
      alpha: 1,
      duration: 1200,
      ease: 'Sine.easeIn',
      onComplete: () => {
        this.time.delayedCall(1500, () => {
          if (this.gone) return;
          this.tweens.add({
            targets,
            alpha: 0,
            duration: 800,
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
    this.scene.start('StudioSplashScene');
  }

  /**
   * Draws a double-helix into a Graphics object centred at (cx, top) and
   * returns it at alpha=0 ready to be tweened in with other elements.
   *
   * Two sinusoidal strands (offset by half-cycle) connected by rungs at each
   * crossover point produce the DNA-ladder silhouette.
   */
  private buildHelix(cx: number, top: number, height: number): Phaser.GameObjects.Graphics {
    const g = this.add.graphics().setAlpha(0);
    const steps = 40;
    const amp = 27;

    for (let i = 1; i <= steps; i++) {
      const frac = i / steps;
      const fracPrev = (i - 1) / steps;
      const angle = frac * Math.PI * 4; // two full cycles over the logo height
      const anglePrev = fracPrev * Math.PI * 4;

      const y = top + frac * height;
      const yPrev = top + fracPrev * height;

      const x1 = cx + Math.sin(angle) * amp;
      const x2 = cx - Math.sin(angle) * amp;
      const x1p = cx + Math.sin(anglePrev) * amp;
      const x2p = cx - Math.sin(anglePrev) * amp;

      // Strand 1 — teal accent
      g.lineStyle(2.5, 0xa0ffdc, 0.85).lineBetween(x1p, yPrev, x1, y);
      // Strand 2 — muted complement
      g.lineStyle(2.5, 0x3a6080, 0.65).lineBetween(x2p, yPrev, x2, y);

      // Rung at crossover (sin ≈ 0 → strands are closest to the centre axis)
      if (Math.abs(Math.sin(angle)) < 0.22) {
        g.lineStyle(1, 0x2a4060, 0.45).lineBetween(x1, y, x2, y);
      }
    }

    // Terminal dots for polish
    g.fillStyle(0xa0ffdc, 0.75).fillCircle(cx + Math.sin(0) * amp, top, 3.5);
    g.fillStyle(0x3a6080, 0.55).fillCircle(cx - Math.sin(0) * amp, top, 3.5);
    g.fillStyle(0xa0ffdc, 0.75).fillCircle(
      cx + Math.sin(Math.PI * 4) * amp,
      top + height,
      3.5,
    );

    return g;
  }
}
