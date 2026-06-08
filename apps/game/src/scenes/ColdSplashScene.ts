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
   * Draws a staircase double-helix into a Graphics object centred at (cx, top)
   * and returns it at alpha=0 ready to be tweened in.
   *
   * Each strand descends as a right-angle staircase (horizontal tread → vertical
   * riser) rather than a smooth sine curve. The two strands are interlocked
   * mirrors — strand 1 starts top-right, strand 2 starts top-left — so their
   * risers always fall on opposite sides of each landing. The shared full-width
   * treads double as DNA rungs. The overall silhouette reads as a descending
   * double helix rendered in Manhattan geometry, evoking the VEIN's floor
   * structure: each landing = one floor of descent.
   */
  private buildHelix(cx: number, top: number, height: number): Phaser.GameObjects.Graphics {
    const g = this.add.graphics().setAlpha(0);
    const levels = 6; // 6 stair-landings over the logo height
    const amp = 27;

    const yAt = (i: number): number => top + (i / levels) * height;
    // Strand 1: right at even landings, left at odd
    const x1At = (i: number): number => cx + (i % 2 === 0 ? amp : -amp);
    // Strand 2: left at even landings, right at odd (interlocked mirror)
    const x2At = (i: number): number => cx - (i % 2 === 0 ? amp : -amp);

    // Strand 1 — teal staircase: full-width tread (= DNA rung) + riser per level
    for (let i = 0; i < levels; i++) {
      const ya = yAt(i);
      const yb = yAt(i + 1);
      g.lineStyle(2.5, 0xa0ffdc, 0.85);
      g.lineBetween(cx - amp, ya, cx + amp, ya); // tread / rung
      g.lineBetween(x1At(i + 1), ya, x1At(i + 1), yb); // riser
    }
    // Closing bottom tread for strand 1
    g.lineStyle(2.5, 0xa0ffdc, 0.85).lineBetween(cx - amp, yAt(levels), cx + amp, yAt(levels));

    // Strand 2 — blue risers only (treads already drawn as strand-1 rungs above)
    for (let i = 0; i < levels; i++) {
      g.lineStyle(2.5, 0x3a6080, 0.65)
        .lineBetween(x2At(i + 1), yAt(i), x2At(i + 1), yAt(i + 1));
    }

    // Terminal cap dots at the four rung-end corners
    g.fillStyle(0xa0ffdc, 0.75).fillCircle(cx + amp, yAt(0), 3.5); // top-right
    g.fillStyle(0x3a6080, 0.55).fillCircle(cx - amp, yAt(0), 3.5); // top-left
    g.fillStyle(0xa0ffdc, 0.75).fillCircle(cx + amp, yAt(levels), 3.5); // bottom-right
    g.fillStyle(0x3a6080, 0.55).fillCircle(cx - amp, yAt(levels), 3.5); // bottom-left

    return g;
  }
}
