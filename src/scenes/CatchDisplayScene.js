import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../constants.js';
import { TEX } from './BootScene.js';
import { fishTextureKey, speciesNlName } from '../data/fish.js';
import { AudioManager, SFX } from '../systems/AudioManager.js';

/**
 * Catch display: shown when a fish is caught. Renders catch.png full-screen
 * with the caught fish sprite overlaid on the dock at a realistic
 * proportional size (cm length scaled against Julian's apparent height)
 * plus the Dutch species name above and a "XX CM" label below. Large
 * fish get sparkles. Dismissed only by tapping the dedicated green
 * Play button in the bottom-right -- taps elsewhere are ignored.
 *
 * Launched via:
 *   this.scene.run('CatchDisplayScene', { species, size, lengthCm });
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

// Calmer wiggle than the original spec -- a 4-year-old plays for many
// catches, so the motion should feel "fresh fish flopping gently" rather
// than "panicked seizure". 1200ms is a slow yoyo with a brief settle.
const WIGGLE_AMPLITUDE_DEG = 3;
const WIGGLE_DURATION_MS   = 1200;
const WIGGLE_HOLD_MS       = 400;     // delay between flop cycles

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
  }

  create() {
    // Hide the FishingScene's DOM video backdrop so it doesn't peek through
    // the canvas letterbox bars (catch.png is 4:3 vs canvas 16:9, so on a
    // 4:3 iPad screen there'd otherwise be a video-colored band above/below).
    this._hiddenVideoEl = document.querySelector('video');
    if (this._hiddenVideoEl) this._hiddenVideoEl.style.display = 'none';

    // Solid dark backing so the canvas letterbox bars also read as "catch
    // mode" rather than showing through to whatever sits behind it.
    document.body.style.backgroundColor = '#1c2530';

    // Cover-mode background image.
    if (this.textures.exists(TEX.CATCH_BG)) {
      const bg = this.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, TEX.CATCH_BG);
      bg.setOrigin(0.5);
      const scale = Math.max(GAME_WIDTH / bg.width, GAME_HEIGHT / bg.height);
      bg.setScale(scale);
      bg.setDepth(0);
    } else {
      this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x1c2530).setDepth(0);
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

    // Fish sprite, scaled by its length in centimetres.
    if (species && size) {
      const key = fishTextureKey(species, size);
      if (this.textures.exists(key)) {
        const fishX = GAME_WIDTH / 2;
        const fishY = GAME_HEIGHT * 0.62;

        const fish = this.add.image(fishX, fishY, key);
        const targetW = Math.max(MIN_FISH_DISPLAY_WIDTH, (lengthCm || 30) * PX_PER_CM);
        fish.setScale(targetW / fish.width);
        fish.setDepth(10);

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
        let nextLabelY = fishY + fish.displayHeight / 2 + 90;
        if (lengthCm) {
          const cmLabel = this.add.text(
            fishX, nextLabelY,
            `${lengthCm} CM`, {
              fontFamily: 'sans-serif',
              fontSize: '37px',
              fontStyle: 'bold',
              color: '#ffffff',
              stroke: '#000000',
              strokeThickness: 4,
            }).setOrigin(0.5).setDepth(11);
          nextLabelY += cmLabel.height + 12;
        }
        const nlName = speciesNlName(species);
        if (nlName) {
          this.add.text(
            fishX, nextLabelY,
            nlName, {
              fontFamily: 'sans-serif',
              fontSize: '42px',
              fontStyle: 'bold',
              color: '#ffd24a',
              stroke: '#000000',
              strokeThickness: 5,
            }).setOrigin(0.5).setDepth(11);
        }

        // Sparkles only for "large" -- visually marks an impressive catch.
        if (size === 'large') {
          this._addSparkles(fish);
        }
      }
    }

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

  _buildPlayButton() {
    // The button is a hand-authored sprite (clean/play.png). We render
    // it at a fixed canvas size; it stays static (no scale-tween) to
    // avoid sub-pixel jitter. A separate rounded-rectangle halo pulses
    // behind it for the "tap me" cue -- shape matches the button.
    const BTN_DISPLAY_SIZE = 230;
    const btnX = GAME_WIDTH  - 30 - BTN_DISPLAY_SIZE / 2;
    const btnY = GAME_HEIGHT - 30 - BTN_DISPLAY_SIZE / 2;

    // Halo as a rounded-rect Graphics. Tweening scale+alpha on a
    // Graphics object is jitter-free since it's vector, not a texture.
    const halo = this.add.graphics();
    const HALO_PAD    = 8;     // just outside the metal-rim edge
    const HALO_RADIUS = 34;
    const haloW = BTN_DISPLAY_SIZE + HALO_PAD * 2;
    const haloH = BTN_DISPLAY_SIZE + HALO_PAD * 2;
    halo.fillStyle(0x4ecd5a, 1);
    halo.fillRoundedRect(-haloW / 2, -haloH / 2, haloW, haloH, HALO_RADIUS);
    halo.setBlendMode(Phaser.BlendModes.ADD);
    halo.setPosition(btnX, btnY);
    halo.setDepth(40);
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
    const btn = this.add.image(btnX, btnY, TEX.PLAY);
    const scale = BTN_DISPLAY_SIZE / Math.max(btn.width, btn.height);
    btn.setScale(scale);
    btn.setDepth(41);
    btn.setInteractive({ useHandCursor: true });
    btn.on('pointerdown', () => this._close());
  }

  /**
   * Random twinkling sparkles around a sprite. Uses small additive
   * yellow-white circles tween'd in alpha + scale with random delays so
   * the cluster feels alive rather than synchronised.
   */
  _addSparkles(fish) {
    const b = fish.getBounds();
    const pad = Math.max(b.width, b.height) * 0.18;
    const sparkles = [];

    const COUNT = 14;
    for (let i = 0; i < COUNT; i++) {
      const sx = b.x - pad + Math.random() * (b.width + pad * 2);
      const sy = b.y - pad + Math.random() * (b.height + pad * 2);
      const radius = 3 + Math.random() * 5;
      const sparkle = this.add.circle(sx, sy, radius, 0xffeaa0, 0);
      sparkle.setBlendMode(Phaser.BlendModes.ADD);
      sparkle.setDepth(12);
      sparkles.push(sparkle);

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

    // A soft golden outer glow behind the fish completes the "rare!" feel.
    const glow = this.add.circle(
      fish.x, fish.y,
      Math.max(b.width, b.height) * 0.6,
      0xffd24a, 0.18,
    );
    glow.setBlendMode(Phaser.BlendModes.ADD);
    glow.setDepth(9);   // behind fish, in front of background
    this.tweens.add({
      targets: glow,
      alpha: { from: 0.18, to: 0.42 },
      scale: { from: 1.0, to: 1.15 },
      duration: 1100,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  _close() {
    if (this._closed) return;
    this._closed = true;
    // Restore the DOM video backdrop for the fishing scene.
    if (this._hiddenVideoEl) this._hiddenVideoEl.style.display = '';
    document.body.style.backgroundColor = '';
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
