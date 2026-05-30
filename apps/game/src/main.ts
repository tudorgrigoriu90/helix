import Phaser from 'phaser';
import { RunSandboxScene } from '@scenes/RunSandboxScene';
import { CombatSandboxScene } from '@scenes/CombatSandboxScene';
import { FloorGraphSandboxScene } from '@scenes/FloorGraphSandboxScene';

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
  // Crisp nearest-neighbour scaling for pixel-art sprites (no blur on up/downscale).
  pixelArt: true,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  // First scene in the list boots by default. Tab bar in each scene
  // (scenes/tab-bar.ts) navigates between them.
  scene: [RunSandboxScene, CombatSandboxScene, FloorGraphSandboxScene],
};

export const game = new Phaser.Game(gameConfig);
