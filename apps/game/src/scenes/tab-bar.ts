import Phaser from 'phaser';

/**
 * Sandbox scene navigation bar — shared between CombatSandboxScene and
 * FloorGraphSandboxScene. Renders two tabs at the very top of the canvas
 * (y: 0..28). Tap a tab to switch scenes via `scene.start(targetKey)`.
 *
 * Active tab is highlighted in LACE teal; inactive in muted blue-grey.
 * Mirrors the geometric / monospace aesthetic of the existing sandbox.
 */

interface TabDef {
  readonly label: string;
  readonly sceneKey: string;
}

const TABS: readonly TabDef[] = [
  { label: 'COMBAT', sceneKey: 'CombatSandboxScene' },
  { label: 'FLOOR GRAPH', sceneKey: 'FloorGraphSandboxScene' },
];

const TAB_HEIGHT = 28;
const COLOURS = {
  bgInactive: 0x0d1220,
  bgActive: 0x1a2840,
  border: 0x1e2a40,
  textInactive: '#7a8fad',
  textActive: '#a0ffdc',
};

/**
 * Draws the sandbox tab bar into the given Phaser scene. Idempotent — call
 * once from each scene's `create()` immediately after setting up the
 * background, before any other UI is drawn.
 *
 * `activeKey` should be the calling scene's own `scene.key` so the active
 * highlight tracks the current scene.
 */
export function drawTabBar(scene: Phaser.Scene, activeKey: string): void {
  const canvasWidth = scene.scale.width;
  const tabWidth = canvasWidth / TABS.length;

  const bg = scene.add.graphics();
  // Underline beneath the bar
  bg.lineStyle(1, COLOURS.border).lineBetween(0, TAB_HEIGHT, canvasWidth, TAB_HEIGHT);

  TABS.forEach((tab, i) => {
    const x = i * tabWidth;
    const isActive = tab.sceneKey === activeKey;

    // Tab background
    bg.fillStyle(isActive ? COLOURS.bgActive : COLOURS.bgInactive);
    bg.fillRect(x, 0, tabWidth, TAB_HEIGHT);

    // Active-tab accent stripe along the bottom of the active tab
    if (isActive) {
      bg.fillStyle(0xa0ffdc).fillRect(x, TAB_HEIGHT - 2, tabWidth, 2);
    }

    // Tab divider on the right of non-final tabs
    if (i < TABS.length - 1) {
      bg.lineStyle(1, COLOURS.border).lineBetween(x + tabWidth, 0, x + tabWidth, TAB_HEIGHT);
    }

    // Tab label
    scene.add
      .text(x + tabWidth / 2, TAB_HEIGHT / 2, tab.label, {
        fontFamily: 'monospace',
        fontSize: '10px',
        color: isActive ? COLOURS.textActive : COLOURS.textInactive,
        // letterSpacing not in Phaser type defs but accepted at runtime; omit to keep types clean
      })
      .setOrigin(0.5);

    // Tap target
    const hit = scene.add
      .zone(x, 0, tabWidth, TAB_HEIGHT)
      .setOrigin(0, 0)
      .setInteractive({ useHandCursor: true });
    hit.on('pointerdown', () => {
      if (!isActive) scene.scene.start(tab.sceneKey);
    });
  });
}

/** Height of the tab bar — sandbox scenes use this to offset their content. */
export const TAB_BAR_HEIGHT = TAB_HEIGHT;
