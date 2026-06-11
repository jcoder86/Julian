import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from './constants.js';
import { BootScene } from './scenes/BootScene.js';
import { TitleScene } from './scenes/TitleScene.js';
import { FishingScene } from './scenes/FishingScene.js';
import { FishingCollectionScene } from './scenes/FishingCollectionScene.js';
import { BaitSelectionScene } from './scenes/BaitSelectionScene.js';
import { FloatSelectionScene } from './scenes/FloatSelectionScene.js';
import { CatchDisplayScene } from './scenes/CatchDisplayScene.js';

const config = {
  type: Phaser.AUTO,
  parent: 'game',
  // transparent=true makes the WebGL/Canvas backbuffer alpha-aware so that
  // a DOM <video> element placed BEHIND the canvas shows through wherever
  // nothing is drawn on top. The PNG-backdrop fallback is still rendered as
  // a sprite at depth 0 so it visibly fills the canvas when no video exists.
  transparent: true,
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  // Pixel snapping keeps placeholder shapes crisp at integer scales.
  pixelArt: false,
  scene: [BootScene, TitleScene, FishingScene, FishingCollectionScene, BaitSelectionScene, FloatSelectionScene, CatchDisplayScene],
};

const game = new Phaser.Game(config);

// Expose for debugging from the browser console / chrome-devtools MCP.
if (typeof window !== 'undefined') {
  window.game = game;
}
