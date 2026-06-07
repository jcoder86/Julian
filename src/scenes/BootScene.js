import Phaser from 'phaser';
import { SFX, sfxPath } from '../systems/AudioManager.js';

// Texture keys used across scenes. Centralised so renames are caught at
// import time rather than as silent missing-texture errors.
export const TEX = Object.freeze({
  BACKDROP: 'backdrop',
  JULIAN_DIRK_FISHING: 'julian_dirk_fishing',
  // NOTE: julian_dirk_general is processed by the asset pipeline but
  // intentionally NOT preloaded here -- it's parked for the future
  // overworld scene per spec.
});

// BootScene tries to preload every known audio key. Failed loads do NOT
// abort the boot -- the AudioManager falls back to console logs when a
// key is missing from the cache. This keeps the dev loop fast: drop an
// mp3 into assets/audio/sfx/ and reload.
export class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene');
  }

  preload() {
    // Silence Phaser's default "missing file" error popups -- we expect
    // them for audio and for first-run images.
    this.load.on('loaderror', (file) => {
      console.log(`[Boot] missing asset: ${file.key} (${file.src})`);
    });

    // Images. backdrop.png is consumed straight from assets/raw/ (the
    // pipeline skips it). julian_dirk_fishing.png is produced by the
    // python script into assets/clean/.
    this.load.image(TEX.BACKDROP, 'raw/backdrop.png');
    this.load.image(TEX.JULIAN_DIRK_FISHING, 'clean/julian_dirk_fishing.png');

    // Audio.
    for (const key of Object.values(SFX)) {
      this.load.audio(key, sfxPath(key));
    }
  }

  create() {
    // Skip any title screen for now -- per spec we boot straight into the
    // fishing scene for fast iteration. A real title screen lives outside
    // this minigame's scope.
    this.scene.start('FishingScene');
  }
}
