import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from './constants.js';
import { BootScene } from './scenes/BootScene.js';
import { FishingScene } from './scenes/FishingScene.js';
import { FishingCollectionScene } from './scenes/FishingCollectionScene.js';

const config = {
  type: Phaser.AUTO,
  parent: 'game',
  backgroundColor: '#0d1b2a',
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  // Pixel snapping keeps placeholder shapes crisp at integer scales.
  pixelArt: false,
  scene: [BootScene, FishingScene, FishingCollectionScene],
};

new Phaser.Game(config);
