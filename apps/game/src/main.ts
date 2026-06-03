import Phaser from 'phaser';
import { ColdSplashScene } from '@scenes/ColdSplashScene';
import { StudioSplashScene } from '@scenes/StudioSplashScene';
import { GameBootScene } from '@scenes/GameBootScene';
import { TutorialIntroScene } from '@scenes/TutorialIntroScene';
import { RunSandboxScene } from '@scenes/RunSandboxScene';
import { CombatSandboxScene } from '@scenes/CombatSandboxScene';
import { FloorGraphSandboxScene } from '@scenes/FloorGraphSandboxScene';
import { FloorScene } from '@scenes/FloorScene';
import { TutorialScene } from '@scenes/TutorialScene';
import { HubScene } from '@scenes/HubScene';
import { OriginSelectScene } from '@scenes/OriginSelectScene';

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
  // First scene in the list boots automatically.
  // ColdSplashScene leads the production boot flow; sandbox scenes remain
  // accessible via the dev tab bar inside RunSandboxScene.
  scene: [
    ColdSplashScene,
    StudioSplashScene,
    GameBootScene,
    TutorialIntroScene,
    RunSandboxScene,
    CombatSandboxScene,
    FloorGraphSandboxScene,
    FloorScene,
    TutorialScene,
    HubScene,
    OriginSelectScene,
  ],
};

export const game = new Phaser.Game(gameConfig);
