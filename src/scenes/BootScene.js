import Phaser from 'phaser';
import {
  SFX, MUSIC, sfxPath, musicPath, voiceKey, voicePath,
  VOICE_ATLAS_KEY, VOICE_ATLAS_META_KEY, voiceAtlasPath, voiceAtlasMetaPath,
} from '../systems/AudioManager.js';
import { FISH_SPECIES, FISH_SIZES, fishTextureKey } from '../data/fish.js';
import { BAITS, baitFullTextureKey, baitSimpleTextureKey } from '../data/baits.js';
import { FLOATS, floatFullTextureKey, floatTipTextureKey } from '../data/floats.js';

// Texture / video keys used across scenes. Centralised so renames are
// caught at import time rather than as silent missing-asset errors.
export const TEX = Object.freeze({
  BACKDROP: 'backdrop',                          // static lake/mountains, NO characters
  CLOUDS: 'clouds',                              // single-layer legacy strip (kept for fallback)
  CLOUDS_BACK: 'clouds-back',                    // parallax: distant layer (slow, small, faded)
  CLOUDS_FRONT: 'clouds-front',                  // parallax: near layer (fast, big, opaque)
  FOREGROUND: 'foreground',                      // near-camera elements (e.g. overhanging tree branch) on transparent bg
  JULIAN_IDLE_1: 'julian-idle1',                 // Julian animation frame 1
  JULIAN_IDLE_2: 'julian-idle2',                 // Julian animation frame 2
  JULIAN_IDLE_3: 'julian-idle3',                 // Julian animation frame 3
  JULIAN_FISHING_LIVE: 'julian-fishing-live',    // Julian head-turned-right pose (line is out)
  DIRK_IDLE: 'dirk-idle',                        // Dirk static idle pose
  DIRK_IDLE_2: 'dirk-idle2',                     // Dirk alt idle pose (middle of rotation)
  DIRK_IDLE_SLEEP: 'dirk-idle-sleep',             // Dirk sleeping pose (cycles every 30s)
  ROD_LONG: 'rod-long',                          // Separable rod for cast/strike animation
  JULIAN_FISHING: 'julian_fishing',              // legacy: Julian alone, single frame
  DIRK_SITTING: 'dirk_sitting',                  // legacy: Dirk alone
  JULIAN_DIRK_FISHING: 'julian_dirk_fishing',    // legacy: combined fallback
  // HUD icons (top-right stack)
  ICON_FISH:  'icon-fish',
  ICON_FLOAT: 'icon-float',
  ICON_BAIT:  'icon-bait',
  // Catch-screen background
  CATCH_BG:   'catch-bg',
  // Title-screen background
  START_BG:   'start-bg',
  // Reel mechanic (Phase 7) -- the fishing reel ("molen") and its loose
  // crank handle. Rendered as a glowing interactive overlay when a strong
  // fish is hooked.
  REEL:        'reel',
  REEL_HANDLE: 'reel-handle',
  // Catch-screen "continue" button -- circular green Apple-style icon.
  PLAY:        'play',
  // "Fish on!" indicator that pops above Julian's head during the DIVE
  // window so the player knows it's now-or-never to strike.
  FISHON:      'fishon',
  // NOTE: julian_dirk_general is processed by the asset pipeline but
  // intentionally NOT preloaded here -- it's parked for the future
  // overworld scene per spec.
});

// Video keys. When the video file is present it takes precedence over
// the matching still image in the same scene.
export const VID = Object.freeze({
  BACKDROP: 'backdropVideo',                     // looping animated backdrop
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
    // pipeline skips it). The sprite PNGs come from assets/clean/, produced
    // by the python pipeline. We load all candidates -- any missing file
    // simply doesn't end up in the texture cache and the scene falls back.
    this.load.image(TEX.BACKDROP, 'raw/backdrop.png');
    // Clouds run through the chromakey pipeline (AI image tools usually
    // output green-screen). Foreground is hand-authored transparent so
    // the pipeline skips it.
    this.load.image(TEX.CLOUDS, 'clean/clouds.png');
    this.load.image(TEX.CLOUDS_BACK, 'clean/clouds-back.png');
    this.load.image(TEX.CLOUDS_FRONT, 'clean/clouds-front.png');
    this.load.image(TEX.FOREGROUND, 'raw/foreground.png');
    // Preferred new animation frames (Julian sprite anim + Dirk static)
    this.load.image(TEX.JULIAN_IDLE_1, 'clean/julian-idle1.png');
    this.load.image(TEX.JULIAN_IDLE_2, 'clean/julian-idle2.png');
    this.load.image(TEX.JULIAN_IDLE_3, 'clean/julian-idle3.png');
    this.load.image(TEX.JULIAN_FISHING_LIVE, 'clean/julian-fishing.png');
    this.load.image(TEX.DIRK_IDLE, 'clean/dirk-idle.png');
    this.load.image(TEX.DIRK_IDLE_2, 'clean/dirk-idle2.png');
    this.load.image(TEX.DIRK_IDLE_SLEEP, 'clean/dirk-idle-sleep.png');
    this.load.image(TEX.ROD_LONG, 'clean/rod-long.png');
    // Legacy textures (kept loaded for backward compat but not actively used)
    this.load.image(TEX.JULIAN_FISHING, 'clean/julian_fishing.png');
    this.load.image(TEX.DIRK_SITTING, 'clean/dirk_sitting.png');
    this.load.image(TEX.JULIAN_DIRK_FISHING, 'clean/julian_dirk_fishing.png');

    // HUD icons + catch-screen background.
    this.load.image(TEX.ICON_FISH,  'clean/icon-fish.png');
    this.load.image(TEX.ICON_FLOAT, 'clean/icon-float.png');
    this.load.image(TEX.ICON_BAIT,  'clean/icon-bait.png');
    this.load.image(TEX.CATCH_BG,   'raw/catch.png');
    this.load.image(TEX.START_BG,   'clean/start.png');

    // Reel + handle for the Phase 7 reeling-in mechanic.
    this.load.image(TEX.REEL,        'clean/reel.png');
    this.load.image(TEX.REEL_HANDLE, 'clean/reel-handle.png');
    // Catch-screen continue button.
    this.load.image(TEX.PLAY,        'clean/play.png');
    // "Fish on!" indicator. Lives in raw/ -- hand-authored transparent PNG,
    // skips the chromakey/clean pipeline.
    this.load.image(TEX.FISHON,      'raw/fishon.png');

    // Bulk-load all fish, bait and float sprites. Each key matches the
    // file name produced by scripts/split_atlas.py.
    for (const species of FISH_SPECIES) {
      for (const size of FISH_SIZES) {
        const key = fishTextureKey(species.id, size);
        this.load.image(key, `clean/${key}.png`);
      }
    }
    for (const bait of BAITS) {
      this.load.image(baitFullTextureKey(bait.id),   `clean/${baitFullTextureKey(bait.id)}.png`);
      this.load.image(baitSimpleTextureKey(bait.id), `clean/${baitSimpleTextureKey(bait.id)}.png`);
    }
    for (const fl of FLOATS) {
      this.load.image(floatFullTextureKey(fl.id), `clean/${floatFullTextureKey(fl.id)}.png`);
      this.load.image(floatTipTextureKey(fl.id),  `clean/${floatTipTextureKey(fl.id)}.png`);
    }

    // NOTE: backdrop.mp4 is intentionally NOT loaded through Phaser's video
    // loader. The scene attaches an HTML5 <video> element directly to the
    // DOM behind the canvas -- sidestepping Phaser Video's sizing quirks.
    // See FishingScene._tryAttachDomVideoBackdrop().

    // Audio -- SFX, music, voice. Missing files are gracefully fall back
    // to a console.log in AudioManager so the game keeps working.
    for (const key of Object.values(SFX)) {
      this.load.audio(key, sfxPath(key));
    }
    for (const key of Object.values(MUSIC)) {
      this.load.audio(key, musicPath(key));
    }
    // Voice atlas (preferred): a single vissen.mp3 with all 33 phrases.
    // The companion JSON gives us seek + duration per (species, size).
    this.load.audio(VOICE_ATLAS_KEY, voiceAtlasPath());
    this.load.json(VOICE_ATLAS_META_KEY, voiceAtlasMetaPath());
    // Per-clip voice fallback: 11 species × 3 sizes = 33 short clips.
    // Loaded only if individual files exist; the atlas takes precedence.
    for (const species of FISH_SPECIES) {
      for (const size of FISH_SIZES) {
        this.load.audio(voiceKey(species.id, size), voicePath(species.id, size));
      }
    }
  }

  create() {
    this.scene.start('TitleScene');
  }
}
