import Phaser from 'phaser';
import { ColdSplashScene } from '@scenes/ColdSplashScene';
import { StudioSplashScene } from '@scenes/StudioSplashScene';
import { GameBootScene } from '@scenes/GameBootScene';
import { TutorialIntroScene } from '@scenes/TutorialIntroScene';
import { TutorialScene } from '@scenes/TutorialScene';
import { HubScene } from '@scenes/HubScene';
import { OriginSelectScene } from '@scenes/OriginSelectScene';
import { RunPreviewScene } from '@scenes/RunPreviewScene';
import { FloorTransitionScene } from '@scenes/FloorTransitionScene';
import { GameScene } from '@scenes/GameScene';
import { EndingScene } from '@scenes/EndingScene';
import { PostRunScene } from '@scenes/PostRunScene';
import { ShareScene } from '@scenes/ShareScene';
import { SettingsScene } from '@scenes/SettingsScene';
import { AudioSettingsScene } from '@scenes/AudioSettingsScene';
import { DisplaySettingsScene } from '@scenes/DisplaySettingsScene';
import { AccessibilitySettingsScene } from '@scenes/AccessibilitySettingsScene';
import { ControlsSettingsScene } from '@scenes/ControlsSettingsScene';
import { PrivacyScene } from '@scenes/PrivacyScene';
import { AboutScene } from '@scenes/AboutScene';
import { SupportScene } from '@scenes/SupportScene';

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
  // First scene in the list boots automatically. ColdSplashScene leads the
  // production boot flow: splashes → GameBootScene → tutorial or Hub.
  scene: [
    ColdSplashScene,
    StudioSplashScene,
    GameBootScene,
    TutorialIntroScene,
    TutorialScene,
    HubScene,
    OriginSelectScene,
    RunPreviewScene,
    FloorTransitionScene,
    GameScene,
    EndingScene,
    PostRunScene,
    ShareScene,
    SettingsScene,
    AudioSettingsScene,
    DisplaySettingsScene,
    AccessibilitySettingsScene,
    ControlsSettingsScene,
    PrivacyScene,
    AboutScene,
    SupportScene,
  ],
};

export const game = new Phaser.Game(gameConfig);
