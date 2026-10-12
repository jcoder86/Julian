import Phaser from 'phaser';
import {
  SFX, MUSIC, sfxPath, musicPath, voiceKey, voicePath,
  VOICE_ATLASES, voiceAtlasMetaKey, voiceAtlasPath, voiceAtlasMetaPath,
} from '../systems/AudioManager.js';
import { ambienceKey, ambienceNames, ambiencePath } from '../systems/Ambience.js';
import { FISH_SPECIES, FISH_SIZES, fishTextureKey } from '../data/fish.js';
import { SaveSystem } from '../systems/SaveSystem.js';
import { BAITS, baitFullTextureKey, baitSimpleTextureKey } from '../data/baits.js';
import { FLOATS, floatFullTextureKey, floatTipTextureKey } from '../data/floats.js';
import { MAPS, catchBgKey, catchBgImage } from '../data/maps.js';
import { TEAMS, lookTeamId } from '../data/teams.js';
import { CHARACTERS_KEY, crewTextureKey, buildClipTexture } from '../systems/Crew.js';
import { UI } from '../systems/Ui.js';

// Texture / video keys used across scenes. Centralised so renames are
// caught at import time rather than as silent missing-asset errors.
export const TEX = Object.freeze({
  BACKDROP: 'backdrop',                          // the moat painting; every map has its own key in data/maps.js
  FOREGROUND: 'foreground',                      // near-camera elements (e.g. overhanging tree branch) on transparent bg
  // HUD icons (top-right stack)
  ICON_FISH:  'icon-fish',
  ICON_FLOAT: 'icon-float',
  ICON_BAIT:  'icon-bait',
  ICON_MAP:   'icon-map',                        // back to the map-select screen
  MAPSELECT_BG: 'mapselect-bg',                  // cabin wall behind the map-select cards
  COLLECTION_WALL: 'ui-wall',                    // the bare wall the collection's cards are pinned to
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

    // Images. The paintings and sprites come from assets/clean/, produced
    // by the python pipeline; a few hand-finished files are consumed
    // straight from assets/raw/. We load all candidates -- any missing file
    // simply doesn't end up in the texture cache and the scene falls back.
    //
    // One painting per map, plus the catch-screen painting of every team
    // on that map (the children are in it).
    // (A visitor is shown in a painting he borrows: see lookTeamId.)
    const painted = [...new Set(TEAMS.map(lookTeamId))];
    for (const map of MAPS) {
      this.load.image(map.backdropKey, map.backdropImage);
      for (const teamId of painted) {
        this.load.image(catchBgKey(teamId, map.id), catchBgImage(teamId, map.id));
      }
    }
    // Each map's cloud layers are shown by the browser itself (DOM strips
    // behind the canvas); loading them here only makes sure they are
    // already in the browser's cache when the map opens.
    for (const map of MAPS) {
      for (const layer of map.clouds) this.load.image(`clouds:${layer.src}`, layer.src);
    }
    // Optional near-camera layer (an overhanging branch); no map has one now.
    this.load.image(TEX.FOREGROUND, 'raw/foreground.png');
    // The figures on the jetty: characters.json lists every pose picture
    // and film strip (scripts/make_characters.py); queue them as soon as
    // it is in. A film strip comes as two files, put together in create().
    this.load.json(CHARACTERS_KEY, 'clean/characters.json');
    this.load.once(`filecomplete-json-${CHARACTERS_KEY}`, (_key, _type, characters) => {
      for (const who of Object.values(characters)) {
        for (const pose of Object.values(who.poses || {})) {
          this.load.image(crewTextureKey(pose.file), `clean/${pose.file}`);
        }
        for (const clip of Object.values(who.clips || {})) {
          this.load.image(`${crewTextureKey(clip.rgb)}:rgb`, `clean/${clip.rgb}`);
          this.load.image(`${crewTextureKey(clip.rgb)}:alpha`, `clean/${clip.alpha}`);
        }
      }
    });

    // HUD icons + title-screen background.
    this.load.image(TEX.ICON_FISH,  'clean/icon-fish.png');
    this.load.image(TEX.ICON_FLOAT, 'clean/icon-float.png');
    this.load.image(TEX.ICON_BAIT,  'clean/icon-bait.png');
    this.load.image(TEX.ICON_MAP,   'clean/icon-map.png');
    this.load.image(TEX.START_BG,   'clean/start-friends.jpg');
    this.load.image(TEX.MAPSELECT_BG, 'clean/mapselect.jpg');
    this.load.image(TEX.COLLECTION_WALL, 'clean/ui-wall.jpg');
    // Menus: boards, the paper card, the green "go on fishing" button...
    for (const key of Object.values(UI)) this.load.image(key, `clean/${key}.png`);
    // ...and per team its faces (its button on the title screen; same key
    // as teamBadgeKey() in TitleScene).
    for (const team of TEAMS) {
      this.load.image(`team-${team.id}`, `clean/team_${team.id}.png`);
    }

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
    // What each place sounds like: birds, waves, bells, gulls...
    for (const name of ambienceNames(MAPS)) {
      this.load.audio(ambienceKey(name), ambiencePath(name));
    }
    // Voice atlases (preferred): a few mp3s that each hold many phrases.
    // The companion JSON gives us seek + duration per (species, size).
    for (const atlas of VOICE_ATLASES) {
      this.load.audio(atlas, voiceAtlasPath(atlas));
      this.load.json(voiceAtlasMetaKey(atlas), voiceAtlasMetaPath(atlas));
    }
    // Per-clip voice fallback: one short clip per species × size.
    // Loaded only if individual files exist; an atlas takes precedence.
    for (const species of FISH_SPECIES) {
      for (const size of FISH_SIZES) {
        this.load.audio(voiceKey(species.id, size), voicePath(species.id, size));
      }
    }
  }

  create() {
    const characters = this.cache.json.get(CHARACTERS_KEY) || {};
    for (const who of Object.values(characters)) {
      for (const clip of Object.values(who.clips || {})) buildClipTexture(this, clip);
    }
    // Once per device: James's collection for James & Boaz (SaveSystem.js).
    SaveSystem.adoptJamesCatches();
    this.scene.start('TitleScene');
  }
}
