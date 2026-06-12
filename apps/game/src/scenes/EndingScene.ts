import Phaser from 'phaser';

/**
 * S033 Ending — the Convergence sequence (T-309, GDD §2.8).
 *
 * Plays after the Floor 20 Warden falls, before the "What You Became" summary.
 * The run's mutations picked one of the five family endings (ending-loader);
 * this scene reveals its LACE beats one tap at a time, then hands the
 * untouched run summary on to PostRunScene.
 *
 * Receives: { summary: RunSummaryData (opaque, passed through), title, lines }.
 * Transitions: CONTINUE (after the last beat) → PostRunScene.
 */

const W = 390;
const H = 844;
const CX = W / 2;

const C = {
  bg: 0x04060c,
  text: '#e8edf5',
  dim: '#7a8fad',
  accent: '#a0ffdc',
  accentN: 0xa0ffdc,
};

const LINES_TOP = 220;
const LINE_GAP = 18;
const TEXT_W = W - 64;

export class EndingScene extends Phaser.Scene {
  private summary: Record<string, unknown> = {};
  private endingTitle = '';
  private lines: string[] = [];
  private revealed = 0;
  private nextY = LINES_TOP;
  private hint!: Phaser.GameObjects.Text;
  private continueShown = false;

  constructor() {
    super({ key: 'EndingScene' });
  }

  init(data: Record<string, unknown>): void {
    this.summary = (data['summary'] as Record<string, unknown>) ?? {};
    this.endingTitle = typeof data['title'] === 'string' ? data['title'] : 'The Convergence';
    this.lines = Array.isArray(data['lines']) ? (data['lines'] as string[]) : [];
    this.revealed = 0;
    this.nextY = LINES_TOP;
    this.continueShown = false;
  }

  create(): void {
    this.add.graphics().fillStyle(C.bg).fillRect(0, 0, W, H);
    this.add.graphics().fillStyle(C.accentN, 0.1).fillRect(0, 0, W, 3);

    this.add.text(CX, 96, 'FLOOR 20 — THE CONVERGENCE', {
      fontFamily: 'monospace', fontSize: '11px', color: C.dim, letterSpacing: 3,
    }).setOrigin(0.5);

    this.add.text(CX, 136, this.endingTitle.toUpperCase(), {
      fontFamily: 'monospace', fontSize: '19px', color: C.accent, letterSpacing: 3,
      align: 'center', wordWrap: { width: TEXT_W },
    }).setOrigin(0.5);

    this.add.graphics().lineStyle(1, 0x1e2a40).lineBetween(48, 172, W - 48, 172);

    this.hint = this.add.text(CX, H - 64, 'tap to listen', {
      fontFamily: 'monospace', fontSize: '10px', color: C.dim,
    }).setOrigin(0.5);
    this.tweens.add({ targets: this.hint, alpha: 0.3, duration: 900, yoyo: true, repeat: -1 });

    // A run with no ending content (should never happen — bundle-gated) skips
    // straight to the summary rather than stranding the player.
    if (this.lines.length === 0) {
      this.goToSummary();
      return;
    }

    this.revealNext();
    this.input.on('pointerdown', () => this.revealNext());
  }

  /** Fades in the next beat; after the last one, swaps the hint for CONTINUE. */
  private revealNext(): void {
    if (this.continueShown) return;
    const line = this.lines[this.revealed];
    if (line === undefined) {
      this.showContinue();
      return;
    }
    this.revealed += 1;
    const t = this.add.text(32, this.nextY, line, {
      fontFamily: 'monospace', fontSize: '12px', color: C.text,
      wordWrap: { width: TEXT_W }, lineSpacing: 5,
    }).setAlpha(0);
    this.tweens.add({ targets: t, alpha: 1, duration: 420, ease: 'Sine.easeOut' });
    this.nextY += t.height + LINE_GAP;
    if (this.revealed >= this.lines.length) this.showContinue();
  }

  private showContinue(): void {
    if (this.continueShown) return;
    this.continueShown = true;
    this.hint.destroy();

    const btnW = 260;
    const btnH = 56;
    const btnX = CX - btnW / 2;
    const btnY = H - 110;
    const g = this.add.graphics();
    g.fillStyle(0x1a3028).fillRoundedRect(btnX, btnY, btnW, btnH, 10);
    g.lineStyle(2, C.accentN).strokeRoundedRect(btnX, btnY, btnW, btnH, 10);
    this.add.text(CX, btnY + btnH / 2, 'WHAT YOU BECAME', {
      fontFamily: 'monospace', fontSize: '15px', color: C.accent,
    }).setOrigin(0.5);
    this.add.zone(btnX, btnY, btnW, btnH).setOrigin(0, 0)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', (pointer: Phaser.Input.Pointer, _x: number, _y: number, event: Phaser.Types.Input.EventData) => {
        event.stopPropagation(); // don't let the scene-wide tap handler swallow it
        this.goToSummary();
      });
  }

  private goToSummary(): void {
    this.scene.start('PostRunScene', this.summary);
  }
}
