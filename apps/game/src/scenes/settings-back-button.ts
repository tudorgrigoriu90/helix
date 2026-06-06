import Phaser from 'phaser';

/**
 * Shared back button for settings sub-scenes.
 *
 * Replaces the old tiny `← BACK` text link with a properly sized, bordered,
 * hover-aware button (≥44px tap target per the mobile touch guideline). Used by
 * every settings sub-scene so the control looks and behaves identically.
 */

const W = 390;

const C = {
  surface: 0x0e1626,
  surfaceHi: 0x14223a,
  border: 0x1e2a40,
  accentN: 0xa0ffdc,
  accent: '#a0ffdc',
  dim: '#9fb2cc',
};

/** Adds a centred back button at `y` (top edge). Calls `onBack` when tapped. */
export function addBackButton(scene: Phaser.Scene, onBack: () => void, y = 770): void {
  const btnW = 200;
  const btnH = 50;
  const btnX = (W - btnW) / 2;

  const g = scene.add.graphics();
  const label = scene.add.text(W / 2, y + btnH / 2, '←  BACK', {
    fontFamily: 'monospace', fontSize: '14px', color: C.dim, letterSpacing: 3,
  }).setOrigin(0.5);

  const draw = (hover: boolean): void => {
    g.clear();
    g.fillStyle(hover ? C.surfaceHi : C.surface).fillRoundedRect(btnX, y, btnW, btnH, 12);
    g.lineStyle(hover ? 2 : 1, hover ? C.accentN : C.border).strokeRoundedRect(btnX, y, btnW, btnH, 12);
    label.setColor(hover ? C.accent : C.dim);
  };
  draw(false);

  const zone = scene.add.zone(btnX, y, btnW, btnH).setOrigin(0, 0).setInteractive({ useHandCursor: true });
  zone.on('pointerover', () => draw(true));
  zone.on('pointerout', () => draw(false));
  zone.on('pointerdown', onBack);
}
