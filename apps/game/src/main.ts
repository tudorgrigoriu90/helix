import Phaser from 'phaser';

// Compile-time constant replaced by Vite define. Import this wherever DEMO_MODE
// branching is needed — never read window or import.meta.env directly.
declare const __DEMO_MODE__: boolean;
export const DEMO_MODE: boolean = __DEMO_MODE__;

const gameConfig: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: 390,
  height: 844,
  backgroundColor: '#0A0E1A',
  parent: 'game',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  // Scenes registered here as they land (T-49 adds BootScene).
  scene: [],
};

export const game = new Phaser.Game(gameConfig);
