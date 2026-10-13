import Phaser from 'phaser';
import {
  WORLD_WIDTH, WORLD_HEIGHT, WORLD_LEFT, WORLD_TOP,
} from '../constants.js';
import { bindLayout } from '../systems/Layout.js';
import { TEX } from './BootScene.js';
import { fishTextureKey, isGiant, speciesNlName } from '../data/fish.js';
import { AudioManager, SFX } from '../systems/AudioManager.js';
import { getMap, catchBgKey } from '../data/maps.js';
import { getTeam, lookTeamId } from '../data/teams.js';
import { SaveSystem } from '../systems/SaveSystem.js';
import { UI, COLOR, lettering, addGlow, addHalo, addRays, addGlints, pressable } from '../systems/Ui.js';

/**
 * Catch display: shown when a fish is caught. Renders catch.png full-screen
 * with the caught fish sprite overlaid on the dock at a realistic
 * proportional size (cm length scaled against Julian's apparent height)
 * plus the Dutch species name above and a "XX CM" label below. Large
 * fish get sparkles. A GIANT -- within 5 % of the longest its kind can be
 * (isGiant in data/fish.js) -- gets the works: rays of light turning behind
 * it, a gleam running over it, glints all around, "Gigantisch!" above it,
 * and the voice calls out "Wow! Een gigantische snoek!". Dismissed only by
 * tapping the dedicated green Play button in the bottom-right -- taps
 * elsewhere are ignored.
 *
 * Launched via:
 *   this.scene.run('CatchDisplayScene', { species, size, lengthCm, mapId });
 *
 * mapId picks the painting behind the fish: each map can have its own
 * catch painting (data/maps.js); one that has none uses the lake's.
 */

// Julian is ~100cm tall. In the catch.png painting his sitting body fills
// roughly 400 canvas pixels of vertical space, which works out to a
// standing-equivalent of ~470 canvas px. PX_PER_CM was 4.7 -- bumped
// 20% to 5.64 per playtest feedback ("vissen lijken iets te klein").
const JULIAN_HEIGHT_CM = 100;
const JULIAN_PIXEL_HEIGHT_IN_CATCH = 470;
const FISH_DISPLAY_BOOST = 1.20;   // tweakable global "make fish bigger"
const PX_PER_CM = (JULIAN_PIXEL_HEIGHT_IN_CATCH / JULIAN_HEIGHT_CM) * FISH_DISPLAY_BOOST;

// Strict cm scaling would render a real 8cm baby fish at ~45px wide --
// barely identifiable on screen. Clamp small species to at least this many
// canvas pixels so a 4-year-old can still see what they caught. The "XX CM"
// label tells the actual length.
const MIN_FISH_DISPLAY_WIDTH = 90;
// ...and the true giants are capped: a 3.5 m shark at full cm scale would
// be half again as wide as the painting. Past this width a fish simply
// "fills the jetty"; the label still tells its real length.
const MAX_FISH_DISPLAY_WIDTH = 1240;

// Calmer wiggle than the original spec -- a 4-year-old plays for many
// catches, so the motion should feel "fresh fish flopping gently" rather
// than "panicked seizure". 1200ms is a slow yoyo with a brief settle.
const WIGGLE_AMPLITUDE_DEG = 3;
const WIGGLE_DURATION_MS   = 1200;
const WIGGLE_HOLD_MS       = 400;     // delay between flop cycles

// catch.png is a 4:3 painting like the rest. When a wider screen crops it
// top and bottom, lean toward the top so Julian's head (upper-left of the
// painting) stays in the picture.
const VIEW_ALIGN_Y = 0.25;

// The fish sits on the dock planks, this far down the VISIBLE part of the
// painting (0.59 of a full 4:3 view = the spot it has always had on iPad).
const FISH_Y_FRACTION = 0.59;
// The wooden board under the fish, with its name and length: its size, and
// the gap between the fish's belly and the board's top edge.
const BOARD_W = 372;
const BOARD_H = 124;               // the board's picture is 600 x 200
const BOARD_GAP = 26;
// Breathing room kept between the catch block and the screen edges.
const CATCH_EDGE_MARGIN = 14;

// A giant: "Gigantisch!" above the fish, this far over its back (to the
// middle of the word), in letters of this size.
const GIANT_WORD = 'Gigantisch!';
const GIANT_WORD_SIZE = 60;
const GIANT_WORD_GAP = 54;
// The gleam that runs over a giant: a band of light, brightest in the
// middle and fading to both sides. It is built from thin slices side by
// side: how bright each is, and how wide (as a share of the fish's length).
// It crosses the fish in so many ms, every so often.
const GIANT_GLEAM = [0.08, 0.18, 0.34, 0.52, 0.65, 0.52, 0.34, 0.18, 0.08];
const GIANT_GLEAM_SLICE = 0.016;
const GIANT_GLEAM_MS = 1000;
const GIANT_GLEAM_EVERY_MS = 1500;

// The "go on fishing" button (bottom-right).
const PLAY_BTN_SIZE   = 210;
const PLAY_BTN_MARGIN = 30;

export class CatchDisplayScene extends Phaser.Scene {
  constructor() { super('CatchDisplayScene'); }

  init(data) {
    this.catchData = data || {};
    // Phaser keeps the scene class INSTANCE alive across stop/run, so any
    // state we mutated in a previous catch is still on `this`. The most
    // important one is _closed -- if we leave that set to `true` from the
    // previous catch, _close() short-circuits via the early-return guard
    // and the Play button "looks broken" on the second fish. Reset every
    // field we touch during a run, here.
    this._closed = false;
    this._hiddenVideoEl = null;
    this._catchGroup = null;
    this._catchMetrics = null;
    this._playGroup = null;
  }

  create() {
    // The catch painting covers the whole screen, so the FishingScene's
    // DOM video behind the canvas is invisible here -- hide it so the
    // browser doesn't keep compositing a video nobody can see.
    this._hiddenVideoEl = document.querySelector('video');
    if (this._hiddenVideoEl) this._hiddenVideoEl.style.display = 'none';

    // Background: the 4:3 painting stretched over exactly the world rect.
    // The canvas covers the screen, so this is full-bleed on every device.
    const worldCx = WORLD_LEFT + WORLD_WIDTH / 2;
    const worldCy = WORLD_TOP + WORLD_HEIGHT / 2;
    // The painting shows whoever is fishing, where they are fishing.
    const map = getMap(this.catchData.mapId);
    const team = getTeam(SaveSystem.getProfile());
    const bgKey = catchBgKey(lookTeamId(team), map.id);
    if (this.textures.exists(bgKey)) {
      const bg = this.add.image(worldCx, worldCy, bgKey);
      bg.setOrigin(0.5);
      bg.setDisplaySize(WORLD_WIDTH, WORLD_HEIGHT);
      bg.setDepth(0);
    } else {
      this.add.rectangle(worldCx, worldCy, WORLD_WIDTH, WORLD_HEIGHT, 0x1c2530).setDepth(0);
    }

    // Audio sequence on the catch-display:
    //   t = 0      ms   APPLAUSE -- success cheer right as the screen opens
    //   t = 700    ms   VOICE    -- "een grote karper!" after the cheer; for
    //                               a giant "Wow! Een gigantische karper!"
    // Falls back to silent console.log when audio files are missing.
    this.audio = new AudioManager(this);
    const { species, size, lengthCm } = this.catchData;
    const giant = isGiant(species, lengthCm);
    this.audio.playSfx(SFX.APPLAUSE);
    if (species && size) {
      this.time.delayedCall(700, () => {
        this.audio.playVoice(species, size, { giant, volume: map.voiceVolume ?? 1 });
      });
    }

    // Fish sprite, scaled by its length in centimetres. The fish, its
    // labels and its sparkles live in ONE container (origin = the fish's
    // centre) so _applyLayout can re-centre the whole block -- and shrink
    // it on small screens -- without touching the individual pieces.
    if (species && size) {
      const key = fishTextureKey(species, size);
      if (this.textures.exists(key)) {
        const group = this.add.container(0, 0);
        group.setDepth(10);

        const fish = this.add.image(0, 0, key);
        const targetW = Phaser.Math.Clamp(
          (lengthCm || 30) * PX_PER_CM, MIN_FISH_DISPLAY_WIDTH, MAX_FISH_DISPLAY_WIDTH);
        fish.setScale(targetW / fish.width);
        const halfW = fish.displayWidth / 2;
        const halfH = fish.displayHeight / 2;

        // Children draw in the order they are added: rays (a giant only)
        // and glow (large fish only) behind the fish, then labels, then
        // sparkles on top.
        if (giant) group.add(addRays(this, 0, 0, Math.max(halfW * 1.35, halfH * 2.6, 300)));
        if (size === 'large') group.add(this._makeGlow(halfW, halfH));
        // The fish flops in a holder of its own, so that the gleam on a
        // giant flops with it.
        const body = this.add.container(0, 0, [fish]);
        group.add(body);
        if (giant) this._addGleam(body, fish);

        // Slower, calmer flop -- yoyo with a small hold-still between cycles.
        this.tweens.add({
          targets: body,
          angle: { from: -WIGGLE_AMPLITUDE_DEG, to: WIGGLE_AMPLITUDE_DEG },
          duration: WIGGLE_DURATION_MS,
          yoyo: true,
          hold: WIGGLE_HOLD_MS,
          repeatDelay: WIGGLE_HOLD_MS,
          repeat: -1,
          ease: 'Sine.easeInOut',
        });

        // Below the fish: a wooden board with what it is and how long.
        // This keeps the painted dock behind the children clean and groups
        // the catch info together.
        const nlName = speciesNlName(species);
        const boardY = halfH + BOARD_GAP + BOARD_H / 2;
        let blockBottom = halfH;
        if (nlName || lengthCm) {
          if (this.textures.exists(UI.BOARD_LABEL)) {
            const board = this.add.image(0, boardY, UI.BOARD_LABEL);
            board.setDisplaySize(BOARD_W, BOARD_H);
            group.add(board);
          }
          // Both lines, or just the one there is, centred on the board.
          const both = nlName && lengthCm;
          if (nlName) {
            group.add(this.add.text(0, boardY - (both ? 21 : 0), nlName, lettering(40, COLOR.GOLD))
              .setOrigin(0.5));
          }
          if (lengthCm) {
            group.add(this.add.text(0, boardY + (both ? 27 : 0), `${lengthCm} cm`,
                                    lettering(giant ? 32 : 29, giant ? COLOR.GOLD : COLOR.CREAM))
              .setOrigin(0.5));
          }
          blockBottom = boardY + BOARD_H / 2;
        }

        // Sparkles only for "large" -- visually marks an impressive catch.
        if (size === 'large') {
          this._addSparkles(group, halfW, halfH);
        }

        // A giant: its word above it, and glints on and all around it.
        let blockTop = halfH;
        let blockHalfW = Math.max(halfW, BOARD_W / 2);
        if (giant) {
          const word = this._addGiantWord(group, -halfH - GIANT_WORD_GAP);
          blockTop = halfH + GIANT_WORD_GAP + GIANT_WORD_SIZE * 0.7;
          blockHalfW = Math.max(blockHalfW, word.width / 2 + 70);
          addGlints(this, group, {
            w: halfW * 2 + 120, h: halfH * 2 + 110,
            count: Phaser.Math.Clamp(Math.round(halfW / 8), 28, 64), size: 30,
          });
        }

        this._catchGroup = group;
        // Extents of the block around the container origin (unscaled).
        this._catchMetrics = { halfWidth: blockHalfW, top: blockTop, bottom: blockBottom };
      }
    }

    // Camera + placement of the catch block for this screen.
    bindLayout(this, { alignY: VIEW_ALIGN_Y }, (layout) => this._applyLayout(layout));

    // The big round button in the bottom-right corner. Only this button
    // closes the catch screen -- elsewhere taps do NOTHING. Gives the
    // 4-year-old a clear, intentional way to dismiss.
    //
    // The button is delayed 1.5s so the player actually looks at the
    // caught fish + reads the species + cm before being tempted to skip.
    this.time.delayedCall(1500, () => {
      if (!this._closed) this._buildPlayButton();
    });
  }

  /**
   * Called on create and on every resize / rotation.
   */
  _applyLayout(layout) {
    if (!layout) return;
    const view = layout.view;
    const safe = layout.safe;

    // Catch block: at its usual spot on the dock, but always fully on
    // screen. If the block is taller or wider than the screen (a huge
    // pike on a phone) it is scaled down to fit.
    if (this._catchGroup && this._catchMetrics) {
      const m = this._catchMetrics;
      const availW = safe.width  - CATCH_EDGE_MARGIN * 2;
      const availH = safe.height - CATCH_EDGE_MARGIN * 2;
      const k = Math.min(1, availW / (m.halfWidth * 2), availH / (m.top + m.bottom));
      let y = view.top + view.height * FISH_Y_FRACTION;
      y = Math.min(y, safe.bottom - CATCH_EDGE_MARGIN - m.bottom * k);
      y = Math.max(y, safe.top + CATCH_EDGE_MARGIN + m.top * k);
      this._catchGroup.setScale(k);
      this._catchGroup.setPosition(view.centerX, y);
    }

    // Play button: bottom-right corner of the screen, inside the safe
    // area. Shrinks on short screens so it never dominates a phone.
    if (this._playGroup) {
      const k = Math.min(1, (safe.height * 0.34) / PLAY_BTN_SIZE);
      const inset = (PLAY_BTN_MARGIN + PLAY_BTN_SIZE / 2) * k;
      this._playGroup.setScale(k);
      this._playGroup.setPosition(safe.right - inset, safe.bottom - inset);
    }
  }

  _buildPlayButton() {
    // "Go on fishing": the round green button with the rod and the arrow.
    // The picture stays still (a scaled picture shimmers); a glow breathes
    // behind it for the "tap me" cue. Both sit in one container that
    // _applyLayout pins to the screen corner.
    const group = this.add.container(0, 0);
    group.setDepth(40);
    group.add(addGlow(this, 0, 0, { r: PLAY_BTN_SIZE / 2 - 6 }));

    const key = this.textures.exists(UI.CONTINUE) ? UI.CONTINUE : TEX.PLAY;
    const btn = this.add.image(0, 0, key);
    btn.setScale(PLAY_BTN_SIZE / Math.max(btn.width, btn.height));
    group.add(btn);
    pressable(this, btn, () => this._close());

    this._playGroup = group;
    this._applyLayout(this.layout);
  }

  /**
   * A soft golden outer glow behind a large fish -- completes the "rare!"
   * feel. Centred on the catch container's origin (= the fish).
   */
  _makeGlow(halfW, halfH) {
    return addHalo(this, 0, 0, Math.max(halfW, halfH) * 1.5);
  }

  /**
   * A gleam that runs over the fish from head to tail, again and again:
   * the fish's own shape in white light, of which only a narrow band shows
   * -- and that band travels. `body` is the holder the fish flops in.
   */
  _addGleam(body, fish) {
    const length = fish.width;            // in the picture's own px
    const slice = length * GIANT_GLEAM_SLICE;
    const band = slice * GIANT_GLEAM.length;
    const lights = GIANT_GLEAM.map((alpha) => {
      const light = this.add.image(0, 0, fish.texture.key);
      light.setScale(fish.scaleX, fish.scaleY);
      light.setTintFill(0xffffff);
      light.setBlendMode(Phaser.BlendModes.ADD);
      light.setAlpha(alpha);
      light.setCrop(0, 0, 0, fish.height);
      body.add(light);
      return light;
    });

    const run = { at: 0 };
    this.tweens.add({
      targets: run,
      at: 1,
      duration: GIANT_GLEAM_MS,
      delay: 500,
      repeat: -1,
      repeatDelay: GIANT_GLEAM_EVERY_MS,
      ease: 'Sine.easeInOut',
      onUpdate: () => {
        // From just before the head to just past the tail.
        const start = -band + run.at * (length + band);
        lights.forEach((light, i) => {
          const from = Math.max(0, start + i * slice);
          const to = Math.min(length, start + (i + 1) * slice);
          light.setCrop(from, 0, Math.max(0, to - from), fish.height);
        });
      },
    });
  }

  /** "Gigantisch!", swelling and sinking, between two stars that turn. */
  _addGiantWord(group, y) {
    const word = this.add.text(0, y, GIANT_WORD, lettering(GIANT_WORD_SIZE, COLOR.GOLD)).setOrigin(0.5);
    group.add(word);
    this.tweens.add({
      targets: word,
      scale: { from: 1, to: 1.08 },
      duration: 620,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
    for (const side of [-1, 1]) {
      const star = this.add.star(side * (word.width / 2 + 40), y, 5, 10, 23, 0xffd23c);
      star.setStrokeStyle(3, 0x3a1d06);
      group.add(star);
      this.tweens.add({ targets: star, angle: side * 360, duration: 5200, repeat: -1 });
      this.tweens.add({
        targets: star, scale: { from: 0.85, to: 1.15 }, duration: 620, yoyo: true, repeat: -1,
        ease: 'Sine.easeInOut',
      });
    }
    return word;
  }

  /**
   * Random twinkling sparkles around the fish. Uses small additive
   * yellow-white circles tween'd in alpha + scale with random delays so
   * the cluster feels alive rather than synchronised. Positions are
   * relative to the catch container's origin (= the fish's centre).
   */
  _addSparkles(group, halfW, halfH) {
    const width = halfW * 2;
    const height = halfH * 2;
    const pad = Math.max(width, height) * 0.18;

    const COUNT = 14;
    for (let i = 0; i < COUNT; i++) {
      const sx = -halfW - pad + Math.random() * (width + pad * 2);
      const sy = -halfH - pad + Math.random() * (height + pad * 2);
      const radius = 3 + Math.random() * 5;
      const sparkle = this.add.circle(sx, sy, radius, 0xffeaa0, 0);
      sparkle.setBlendMode(Phaser.BlendModes.ADD);
      group.add(sparkle);

      this.tweens.add({
        targets: sparkle,
        alpha:   { from: 0, to: 0.9 },
        scale:   { from: 0.4, to: 1.2 },
        duration: 600 + Math.random() * 600,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
        delay: Math.random() * 1200,
      });
    }
  }

  _close() {
    if (this._closed) return;
    this._closed = true;
    // Restore the DOM video backdrop for the fishing scene.
    if (this._hiddenVideoEl) this._hiddenVideoEl.style.display = '';
    // Defer the scene transition to the NEXT frame. Calling scene.stop()
    // synchronously from inside Phaser's pointerdown processing loses the
    // SHUTDOWN action silently -- the scene keeps running. delayedCall(0)
    // runs the body in the next tick where the input pass is already done.
    this.time.delayedCall(0, () => {
      this.scene.stop();
      this.scene.wake('FishingScene');
    });
  }
}
