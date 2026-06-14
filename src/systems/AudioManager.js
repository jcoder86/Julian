// AudioManager wraps Phaser's sound system with a fallback so that the game
// keeps running even when audio files have not been dropped in yet.
// Drop real mp3s into assets/audio/{sfx,music,voice}/ matching the keys below
// and they will just start playing -- no further code changes needed.

export const SFX = Object.freeze({
  CAST:     'cast',
  PLOP:     'plop',         // bobber hits water after cast (was SPLASH)
  SPLASH:   'splash',       // fish breaks the water during catch leap
  NIBBLE:   'nibble',
  DIVE:     'dive',
  MISS:     'miss',
  CATCH:    'catch',        // legacy; CATCH = SPLASH + APPLAUSE now
  REEL:     'reel',         // looping click while the player cranks the reel
  APPLAUSE: 'applause',     // played on catch display open
  FISHON:   'fishon',       // one-shot ping when the bobber goes under (strike window opens)
});

// Music keys.
export const MUSIC = Object.freeze({
  AMBIENT: 'ambient',      // relaxed background loop on FishingScene
  START:   'start',        // title-screen theme
});

// Default music volume -- keeps the loop in the background.
export const MUSIC_VOLUME = 0.35;
export const VOICE_VOLUME = 1.0;
export const SFX_VOLUME   = 0.8;
export const REEL_VOLUME  = 0.6;

// Resolves a key into the candidate file paths Phaser should try. publicDir
// is 'assets', so the contents of assets/ are served at the dev-server root.
//
// IMPORTANT: Phaser's audio loader picks the FIRST URL whose file extension
// the browser can play -- it does NOT check whether the file actually
// exists on disk. So order matters. We list the format that's most likely
// to be present FIRST per audio type:
//   - sfx / voice: WAV first (shortest workflow: drag .wav into folder)
//   - music: MP3 first (long files compress 10x in mp3)
// You can still use the other extension; if the preferred one is missing
// and the alternate exists, the loader's HEAD request 404 will simply
// fail-soft and the SFX falls back to a console.log.
export function sfxPath(key) {
  return [`audio/sfx/${key}.wav`, `audio/sfx/${key}.mp3`];
}
export function musicPath(key) {
  return [`audio/music/${key}.mp3`, `audio/music/${key}.wav`];
}

// Voice clips: same WAV-first preference as SFX. These are used as
// FALLBACK when the voice atlas isn't present -- the preferred path
// is the atlas (one mp3 with all 33 phrases, addressed by JSON seek).
export function voiceKey(species, size)  { return `voice_${size}_${species}`; }
export function voicePath(species, size) {
  return [
    `audio/voice/${size}-${species}.wav`,
    `audio/voice/${size}-${species}.mp3`,
  ];
}

// Voice atlas: a single audio file (vissen.mp3) containing all 33 voice
// phrases concatenated with silent gaps. A companion JSON describes the
// start time + duration of each phrase, keyed by `${size}_${species}`.
// AudioManager.playVoice() prefers this atlas when available.
export const VOICE_ATLAS_KEY      = 'vissen';
export const VOICE_ATLAS_META_KEY = 'vissen-meta';
export function voiceAtlasPath() {
  return [`audio/sfx/${VOICE_ATLAS_KEY}.mp3`, `audio/sfx/${VOICE_ATLAS_KEY}.wav`];
}
export function voiceAtlasMetaPath() {
  return `audio/sfx/${VOICE_ATLAS_KEY}.json`;
}

export class AudioManager {
  /**
   * @param {Phaser.Scene} scene -- any scene; we use it for sound + cache access.
   */
  constructor(scene) {
    this.scene = scene;
    this.currentMusic = null;
    this.reelSound = null;
  }

  playSfx(key, opts = {}) {
    if (!this.scene.cache.audio.exists(key)) {
      // File never loaded (probably missing on disk). Fall back to a log so
      // gameplay logic remains observable during development.
      console.log(`[SFX] ${key}`);
      return;
    }
    try {
      this.scene.sound.play(key, { volume: SFX_VOLUME, ...opts });
    } catch (e) {
      console.warn(`[SFX] play failed for ${key}`, e);
    }
  }

  /**
   * Voice announcement when a fish is caught. Prefers the vissen.mp3
   * atlas via Phaser audio MARKERS -- the only way the framework will
   * actually stop playback at a given duration. Falls back to per-clip
   * files, then to a console.log when neither is present.
   */
  playVoice(species, size) {
    // Path 1: atlas (preferred), using markers for hard start+duration.
    if (this.scene.cache.audio.exists(VOICE_ATLAS_KEY) &&
        this.scene.cache.json.exists(VOICE_ATLAS_META_KEY)) {
      const meta = this.scene.cache.json.get(VOICE_ATLAS_META_KEY);
      const markerName = `${size}_${species}`;
      const entry = meta.phrases?.[markerName];
      if (entry) {
        try {
          this._ensureVoiceAtlas(meta);
          // Stop any in-progress voice so consecutive catches don't stack.
          if (this._voiceAtlasSound.isPlaying) this._voiceAtlasSound.stop();
          this._voiceAtlasSound.play(markerName);
          return;
        } catch (e) {
          console.warn(`[VOICE atlas] play failed for ${markerName}`, e);
        }
      } else {
        console.log(`[VOICE atlas] no entry for ${markerName}`);
      }
    }
    // Path 2: per-clip file fallback.
    const key = voiceKey(species, size);
    if (this.scene.cache.audio.exists(key)) {
      try {
        this.scene.sound.play(key, { volume: VOICE_VOLUME });
        return;
      } catch (e) {
        console.warn(`[VOICE] play failed for ${key}`, e);
      }
    }
    console.log(`[VOICE] ${size}_${species} (no audio)`);
  }

  /**
   * Lazy-create the voice atlas Sound instance and populate it with one
   * marker per phrase. addMarker is idempotent (no-op if name already
   * exists), so this is safe to call on every playVoice.
   */
  _ensureVoiceAtlas(meta) {
    if (!this._voiceAtlasSound) {
      this._voiceAtlasSound = this.scene.sound.add(VOICE_ATLAS_KEY);
    }
    if (!this._voiceMarkersAdded) {
      for (const [name, entry] of Object.entries(meta.phrases)) {
        this._voiceAtlasSound.addMarker({
          name,
          start: entry.start,
          duration: entry.duration,
          config: { volume: VOICE_VOLUME },
        });
      }
      this._voiceMarkersAdded = true;
    }
  }

  /**
   * Start the looping reel-click sound (player is cranking). Idempotent --
   * calling while already running is a no-op. Stop with stopReelLoop().
   */
  startReelLoop() {
    if (this.reelSound) return;
    const key = SFX.REEL;
    if (!this.scene.cache.audio.exists(key)) {
      console.log(`[SFX] ${key} (loop start)`);
      return;
    }
    try {
      this.reelSound = this.scene.sound.add(key, { loop: true, volume: REEL_VOLUME });
      this.reelSound.play();
    } catch (e) {
      console.warn(`[SFX] reel loop start failed`, e);
    }
  }

  stopReelLoop() {
    if (!this.reelSound) return;
    try { this.reelSound.stop(); } catch (e) { /* ignore */ }
    this.reelSound = null;
  }

  playMusic(key, opts = {}) {
    if (!this.scene.cache.audio.exists(key)) {
      console.log(`[MUSIC] ${key}`);
      return;
    }
    this.stopMusic();
    try {
      this.currentMusic = this.scene.sound.add(key, {
        loop: true,
        volume: MUSIC_VOLUME,
        ...opts,
      });
      // iOS Safari blocks WebAudio playback until the user has tapped
      // the page once. The play() call below silently no-ops while
      // sound.locked is true. Defer the actual start to the UNLOCKED
      // event so the first tap (anywhere on the page) kicks the music
      // off. On desktop sound.locked is false from the start and the
      // play() runs immediately.
      if (this.scene.sound.locked) {
        const pending = this.currentMusic;
        // 'unlocked' === Phaser.Sound.Events.UNLOCKED. Use the string
        // so AudioManager doesn't need to import Phaser directly.
        this.scene.sound.once('unlocked', () => {
          // Only resume if this is still the active music instance --
          // e.g. user tapped START so fast that stopMusic() already
          // ran. We don't want to revive a stopped track.
          if (this.currentMusic === pending) pending.play();
        });
      } else {
        this.currentMusic.play();
      }
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
