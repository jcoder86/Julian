// AudioManager wraps Phaser's sound system with a fallback so that the game
// keeps running even when audio files have not been dropped in yet.
// Drop real mp3s into assets/audio/sfx/ matching the keys below and they will
// just start playing -- no further code changes needed.

export const SFX = Object.freeze({
  CAST: 'cast',
  SPLASH: 'splash',
  NIBBLE: 'nibble',
  DIVE: 'dive',
  MISS: 'miss',
  CATCH: 'catch',
});

// Music keys -- room to grow later.
export const MUSIC = Object.freeze({
  // Reserved for future use.
});

// Resolves a key into the path Phaser should load.
// Note: vite.config.js sets publicDir to 'assets', so the contents of
// the assets/ folder are served at the dev-server root. That's why the
// path here is `audio/...`, NOT `assets/audio/...`.
export function sfxPath(key) {
  return `audio/sfx/${key}.mp3`;
}

export function musicPath(key) {
  return `audio/music/${key}.mp3`;
}

export class AudioManager {
  /**
   * @param {Phaser.Scene} scene -- any scene; we use it for sound + cache access.
   */
  constructor(scene) {
    this.scene = scene;
    this.currentMusic = null;
  }

  playSfx(key) {
    if (!this.scene.cache.audio.exists(key)) {
      // File never loaded (probably missing on disk). Fall back to a log so
      // gameplay logic remains observable during development.
      console.log(`[SFX] ${key}`);
      return;
    }
    try {
      this.scene.sound.play(key);
    } catch (e) {
      console.warn(`[SFX] play failed for ${key}`, e);
    }
  }

  playMusic(key, loop = true) {
    if (!this.scene.cache.audio.exists(key)) {
      console.log(`[MUSIC] ${key}`);
      return;
    }
    this.stopMusic();
    try {
      this.currentMusic = this.scene.sound.add(key, { loop });
      this.currentMusic.play();
    } catch (e) {
      console.warn(`[MUSIC] play failed for ${key}`, e);
    }
  }

  stopMusic() {
    if (this.currentMusic) {
      try { this.currentMusic.stop(); } catch (e) { /* ignore */ }
      this.currentMusic = null;
    }
  }
}
