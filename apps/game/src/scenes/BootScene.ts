import Phaser from 'phaser';

// Placeholder for T-124 (S001 cold launch splash) and T-125 (S002 studio splash).
// T-49 goal: confirm the Phaser scene pipeline boots and renders on localhost:5173.
export class BootScene extends Phaser.Scene {
  private dot!: Phaser.GameObjects.Text;
  private frame = 0;

  constructor() {
    super({ key: 'BootScene' });
  }

  create(): void {
    const cx = this.scale.width / 2;
    const cy = this.scale.height / 2;

    this.add
      .text(cx, cy - 32, 'STRAND DESCENT', {
        fontFamily: 'monospace',
        fontSize: '32px',
        color: '#E8EDF5',
        letterSpacing: 6,
      })
      .setOrigin(0.5);

    this.add
      .text(cx, cy + 16, 'EMPATHY SOFTWARE', {
        fontFamily: 'monospace',
        fontSize: '12px',
        color: '#7A8FAD',
        letterSpacing: 4,
      })
      .setOrigin(0.5);

    this.dot = this.add
      .text(cx, cy + 80, '·', {
        fontFamily: 'monospace',
        fontSize: '24px',
        color: '#A0FFDC',
      })
      .setOrigin(0.5);
  }

  override update(_time: number, _delta: number): void {
    // Pulse the loading dot so we can confirm the game loop is running.
    this.frame++;
    if (this.frame % 40 === 0) {
      this.dot.setVisible(!this.dot.visible);
    }
  }
}
