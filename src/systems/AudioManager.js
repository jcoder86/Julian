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

// The sounds there is a recording of (assets/audio/sfx/<key>.wav). The
// others are names only so far, and playSfx just logs them. BootScene loads
// these and no more: a file that is not there costs a request at every
// start -- and the live site answers it with the web page, which is then
// decoded as sound, and fails.
export const SFX_RECORDED = Object.freeze([SFX.PLOP, SFX.SPLASH, SFX.REEL, SFX.APPLAUSE, SFX.FISHON]);

// Music keys.
export const MUSIC = Object.freeze({
  AMBIENT: 'ambient',      // relaxed background loop on FishingScene (the lake)
  SEA:     'relaxing',     // the sea's own music (audio/music/relaxing.mp3);
                           // without that file the sea uses AMBIENT.
  START:   'start',        // title-screen theme
});

// (The waves, birds and other sounds of a place are not music: see
// systems/Ambience.js.)

// Default music volume -- keeps the loop in the background.
export const MUSIC_VOLUME = 0.35;
// The voice: louder than a recording on its own (15 % up on request,
// October 2026) -- but never so loud that a phrase's loudest moment would
// clip: then that phrase gets as much as it can take (VOICE_CEILING).
export const VOICE_VOLUME = 1.15;
const VOICE_CEILING = 0.97;
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

// Voice atlases: audio files that each hold many voice phrases in a row
// with silent gaps. A companion JSON describes the start time + duration
// of each phrase, keyed by `${size}_${species}`. AudioManager.playVoice()
// looks a phrase up in all of them, the NEWEST first -- so a fish whose
// name became more exact (the Karper is the Schubkarper now) is called by
// its new name, while the old recording stays as it is:
//   vissen         the first eleven fish of the first lake
//   vissen-zee     the twelve sea fish, and the catfish
//   vissen-3       the newcomers of the moat and of the French lake, the
//                  five renamed fish, and the names of the maps (`map_<id>`)
//   stem-spel      what the game itself says: `escaped`, when a fish gets off
//   vissen-gigant  "Wow! Een gigantische snoek!", for every species
//                  (`giant_<species>`): a catch that is a giant (isGiant in
//                  data/fish.js)
//   vissen-4       the roach once more, by the name on its card: Blankvoorn
//                  (the first recording says "voorn")
//   vissen-5       the ten fish that are new on the Greek coast, and its name
//                  (`map_greece`)
//   vissen-gigant-2  "Wow! Een gigantische ...!" for those ten
//   vissen-6       the twelve fish of the South Pole, and its name
//                  (`map_antarctica`)
//   vissen-gigant-3  "Wow! Een gigantische ...!" for those twelve
// A new one is made by scripts/make_voice_atlas.py and added at the END of
// this list. The atlas name is also its audio cache key.
//
// (There used to be a second way: one small file per fish and size, tried
// for every species at start-up. None of those files ever existed, so every
// start asked the server for a hundred sounds that were not there -- and
// was handed the web page instead, to be decoded as sound and fail. Gone.)
export const VOICE_ATLASES = [
  'vissen', 'vissen-zee', 'vissen-3', 'stem-spel', 'vissen-gigant', 'vissen-4',
  'vissen-5', 'vissen-gigant-2', 'vissen-6', 'vissen-gigant-3',
];
export function voiceAtlasMetaKey(atlas) {
  return `${atlas}-meta`;
}
export function voiceAtlasPath(atlas) {
  return [`audio/sfx/${atlas}.mp3`, `audio/sfx/${atlas}.wav`];
}
export function voiceAtlasMetaPath(atlas) {
  return `audio/sfx/${atlas}.json`;
}

// One Sound per atlas for the whole game, whichever scene speaks: the voice
// is one voice (a new phrase cuts off the one before it, also across
// scenes), and nothing piles up in the sound manager catch after catch.
const voiceSounds = new WeakMap();      // sound manager -> { atlas: Sound }
// The loudest moment of each phrase, once looked up: `${atlas} ${phrase}` -> 0..1.
const phrasePeaks = new Map();

function missingVoiceFiles(scene) {
  return VOICE_ATLASES.filter((atlas) =>
    !scene.cache.audio.exists(atlas) || !scene.cache.json.exists(voiceAtlasMetaKey(atlas)));
}

/**
 * Fetch again whatever voice atlas did not make it at start-up. A file can
 * fail to arrive or to decode on a busy tablet, and without this all the
 * fish in it stay silent until the game is started anew. Called when the
 * map screen and a fishing spot open, and when a phrase cannot be said.
 * `onDone` runs when the second attempt is over, whatever came of it.
 * Returns whether anything was missing (and is being fetched).
 */
export function reloadMissingVoice(scene, onDone) {
  const missing = missingVoiceFiles(scene);
  if (!missing.length || scene.load.isLoading()) return false;
  for (const atlas of missing) {
    if (!scene.cache.audio.exists(atlas)) scene.load.audio(atlas, voiceAtlasPath(atlas));
    if (!scene.cache.json.exists(voiceAtlasMetaKey(atlas))) {
      scene.load.json(voiceAtlasMetaKey(atlas), voiceAtlasMetaPath(atlas));
    }
  }
  console.warn(`[VOICE] fetching again: ${missing.join(', ')}`);
  if (onDone) scene.load.once('complete', onDone);
  scene.load.start();
  return true;
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
   * Voice announcement when a fish is caught: "een grote snoek!" -- or, for
   * a giant, "Wow! Een gigantische snoek!" (and then not the other).
   * `volume`: a share of the usual voice volume (a map's `voiceVolume`).
   */
  playVoice(species, size, { giant = false, volume = 1 } = {}) {
    const plain = `${size}_${species}`;
    return this._sayFirst(giant ? [`giant_${species}`, plain] : [plain], volume);
  }

  /**
   * Say one phrase of a voice atlas by its key: a fish (`large_pike`) or
   * anything else an atlas holds (`map_sea`). Returns whether it is being
   * said (or will be, see _sayFirst).
   */
  playPhrase(markerName, { volume = 1 } = {}) {
    return this._sayFirst([markerName], volume);
  }

  /**
   * Say the first of these phrases that there is a recording of. If there
   * is none of any of them while a voice atlas is missing -- it did not
   * load at start-up -- the atlas is fetched again and the phrase is said
   * as soon as it is there: late, but not never.
   */
  _sayFirst(names, volume, mayFetch = true) {
    for (const name of names) {
      if (this._say(name, volume)) return true;
    }
    const scene = this.scene;
    if (mayFetch && reloadMissingVoice(scene, () => {
      if (scene.sys.isActive()) this._sayFirst(names, volume, false);
    })) return true;
    console.log(`[VOICE] ${names.join(' / ')} (no audio)`);
    return false;
  }

  /**
   * One phrase, now. Uses Phaser audio MARKERS -- the only way the
   * framework will actually stop playback at a given duration.
   */
  _say(markerName, volume) {
    for (const atlas of [...VOICE_ATLASES].reverse()) {
      if (!this.scene.cache.audio.exists(atlas)) continue;
      const meta = this.scene.cache.json.get(voiceAtlasMetaKey(atlas));
      if (!meta?.phrases?.[markerName]) continue;
      try {
        const sound = this._voiceSound(atlas, meta);
        // Stop any in-progress voice so consecutive phrases don't stack.
        for (const other of Object.values(voiceSounds.get(this.scene.sound) || {})) {
          if (other.isPlaying) other.stop();
        }
        // (The volume is given every time: Phaser keeps what a marker was
        // last played with.)
        const peak = this._peakOf(atlas, meta.phrases[markerName], markerName);
        sound.play(markerName, { volume: Math.min(VOICE_VOLUME * volume, VOICE_CEILING / peak) });
        return true;
      } catch (e) {
        console.warn(`[VOICE atlas] play failed for ${markerName}`, e);
      }
    }
    return false;
  }

  /**
   * How loud a phrase gets at its loudest (0..1), read from the decoded
   * sound once. 1 when that cannot be read (then nothing is made louder).
   */
  _peakOf(atlas, entry, name) {
    const key = `${atlas} ${name}`;
    if (phrasePeaks.has(key)) return phrasePeaks.get(key);
    let peak = 1;
    const buffer = this.scene.cache.audio.get(atlas);
    if (buffer && typeof buffer.getChannelData === 'function') {
      const from = Math.max(0, Math.floor(entry.start * buffer.sampleRate));
      const to = Math.min(buffer.length, Math.ceil((entry.start + entry.duration) * buffer.sampleRate));
      let max = 0;
      for (let c = 0; c < buffer.numberOfChannels; c++) {
        const data = buffer.getChannelData(c);
        for (let i = from; i < to; i++) {
          const v = Math.abs(data[i]);
          if (v > max) max = v;
        }
      }
      if (max > 0.01) peak = max;
    }
    phrasePeaks.set(key, peak);
    return peak;
  }

  /**
   * The Sound instance of one voice atlas, created on first use with one
   * marker per phrase and shared by every AudioManager of this game.
   */
  _voiceSound(atlas, meta) {
    const manager = this.scene.sound;
    if (!voiceSounds.has(manager)) voiceSounds.set(manager, {});
    const sounds = voiceSounds.get(manager);
    if (!sounds[atlas]) {
      const sound = manager.add(atlas);
      for (const [name, entry] of Object.entries(meta.phrases)) {
        sound.addMarker({
          name,
          start: entry.start,
          duration: entry.duration,
          config: { volume: VOICE_VOLUME },
        });
      }
      sounds[atlas] = sound;
    }
    return sounds[atlas];
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
