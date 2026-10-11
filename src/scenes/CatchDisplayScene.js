import Phaser from 'phaser';
import {
  WORLD_WIDTH, WORLD_HEIGHT, WORLD_LEFT, WORLD_TOP,
} from '../constants.js';
import { bindLayout } from '../systems/Layout.js';
import { TEX } from './BootScene.js';
import { fishTextureKey, speciesNlName } from '../data/fish.js';
import { AudioManager, SFX } from '../systems/AudioManager.js';
import { getMap } from '../data/maps.js';

/**
 * Catch display: shown when a fish is caught. Renders catch.png full-screen
 * with the caught fish sprite overlaid on the dock at a realistic
 * proportional size (cm length scaled against Julian's apparent height)
 * plus the Dutch species name above and a "XX CM" label below. Large
 * fish get sparkles. Dismissed only by tapping the dedicated green
 * Play button in the bottom-right -- taps elsewhere are ignored.
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
// Gap between the fish's belly and the centre of the first label.
const LABEL_GAP = 90;
// Breathing room kept between the catch block and the screen edges.
const CATCH_EDGE_MARGIN = 14;

// Play button (bottom-right).
const PLAY_BTN_SIZE   = 230;
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
    const map = getMap(this.catchData.mapId);
    const bgKey = this.textures.exists(map.catchBgKey) ? map.catchBgKey : TEX.CATCH_BG;
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
    //   t = 700    ms   VOICE    -- "een grote karper!" after the cheer
    // Falls back to silent console.log when audio files are missing.
    this.audio = new AudioManager(this);
    const { species, size, lengthCm } = this.catchData;
    this.audio.playSfx(SFX.APPLAUSE);
    if (species && size) {
      this.time.delayedCall(700, () => this.audio.playVoice(species, size));
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

        // Children draw in the order they are added: glow (large fish
        // only) behind the fish, then labels, then sparkles on top.
        if (size === 'large') group.add(this._makeGlow(halfW, halfH));
        group.add(fish);

        // Slower, calmer flop -- yoyo with a small hold-still between cycles.
        this.tweens.add({
          targets: fish,
          angle: { from: -WIGGLE_AMPLITUDE_DEG, to: WIGGLE_AMPLITUDE_DEG },
          duration: WIGGLE_DURATION_MS,
          yoyo: true,
          hold: WIGGLE_HOLD_MS,
          repeatDelay: WIGGLE_HOLD_MS,
          repeat: -1,
          ease: 'Sine.easeInOut',
        });

        // Labels stack BELOW the fish: first the length in cm, then the
        // species name underneath. This keeps the painted dock behind
        // Julian clean and groups the catch info together. Sizes shrunk
        // 20% per playtest feedback ("texts iets kleiner + meer naar
        // onder").
        let nextLabelY = halfH + LABEL_GAP;
        let blockBottom = halfH;
        if (lengthCm) {
          const cmLabel = this.add.text(
            0, nextLabelY,
            `${lengthCm} CM`, {
              fontFamily: 'sans-serif',
              fontSize: '37px',
              fontStyle: 'bold',
              color: '#ffffff',
              stroke: '#000000',
              strokeThickness: 4,
            }).setOrigin(0.5);
          group.add(cmLabel);
          blockBottom = nextLabelY + cmLabel.height / 2;
          nextLabelY += cmLabel.height + 12;
        }
        const nlName = speciesNlName(species);
        if (nlName) {
          const nameLabel = this.add.text(
            0, nextLabelY,
            nlName, {
              fontFamily: 'sans-serif',
              fontSize: '42px',
              fontStyle: 'bold',
              color: '#ffd24a',
              stroke: '#000000',
              strokeThickness: 5,
            }).setOrigin(0.5);
          group.add(nameLabel);
          blockBottom = nextLabelY + nameLabel.height / 2;
        }

        // Sparkles only for "large" -- visually marks an impressive catch.
        if (size === 'large') {
          this._addSparkles(group, halfW, halfH);
        }

        this._catchGroup = group;
        // Extents of the block around the container origin (unscaled).
        this._catchMetrics = { halfWidth: halfW, top: halfH, bottom: blockBottom };
      }
    }

    // Camera + placement of the catch block for this screen.
    bindLayout(this, { alignY: VIEW_ALIGN_Y }, (layout) => this._applyLayout(layout));

    // Big green Play button in the bottom-right corner. Only this button
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
    // The button is a hand-authored sprite (clean/play.png). It stays
    // static (no scale-tween) to avoid sub-pixel jitter. A separate
    // rounded-rectangle halo pulses behind it for the "tap me" cue --
    // shape matches the button. Both sit in one container that
    // _applyLayout pins to the screen corner.
    const group = this.add.container(0, 0);
    group.setDepth(40);

    // Halo as a rounded-rect Graphics. Tweening scale+alpha on a
    // Graphics object is jitter-free since it's vector, not a texture.
    const halo = this.add.graphics();
    const HALO_PAD    = 8;     // just outside the metal-rim edge
    const HALO_RADIUS = 34;
    const haloW = PLAY_BTN_SIZE + HALO_PAD * 2;
    const haloH = PLAY_BTN_SIZE + HALO_PAD * 2;
    halo.fillStyle(0x4ecd5a, 1);
    halo.fillRoundedRect(-haloW / 2, -haloH / 2, haloW, haloH, HALO_RADIUS);
    halo.setBlendMode(Phaser.BlendModes.ADD);
    group.add(halo);
    this.tweens.add({
      targets: halo,
      alpha: { from: 0.15, to: 0.55 },
      scale: { from: 1.0,  to: 1.07 },
      duration: 1100,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    // The button itself: STATIC. Crisp at all times.
    const btn = this.add.image(0, 0, TEX.PLAY);
    const scale = PLAY_BTN_SIZE / Math.max(btn.width, btn.height);
    btn.setScale(scale);
    btn.setInteractive({ useHandCursor: true });
    btn.on('pointerdown', () => this._close());
    group.add(btn);

    this._playGroup = group;
    this._applyLayout(this.layout);
  }

  /**
   * A soft golden outer glow behind a large fish -- completes the "rare!"
   * feel. Centred on the catch container's origin (= the fish).
   */
  _makeGlow(halfW, halfH) {
    const glow = this.add.circle(0, 0, Math.max(halfW, halfH) * 2 * 0.6, 0xffd24a, 0.18);
    glow.setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({
      targets: glow,
      alpha: { from: 0.18, to: 0.42 },
      scale: { from: 1.0, to: 1.15 },
      duration: 1100,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
    return glow;
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
