import Phaser from 'phaser';
import {
  GAME_HEIGHT,
  WORLD_WIDTH, WORLD_HEIGHT, WORLD_LEFT, WORLD_TOP,
} from '../constants.js';
import { bindLayout } from '../systems/Layout.js';
import { SaveSystem } from '../systems/SaveSystem.js';
import { AudioManager, MUSIC } from '../systems/AudioManager.js';

// When a screen wider than 4:3 has to crop the painting top and bottom,
// keep the top: that is where the logo and Julian's face are. 0 = keep the
// very top, 0.5 = crop evenly. Used for BOTH the camera and the DOM
// background's object-position so the two always show the same slice.
const VIEW_ALIGN_Y = 0.1;

// Button block (design px). START is the container origin; the guest link
// hangs below it.
const START_W = 280;
const START_H = 90;
const START_MARGIN_RIGHT = 36;
const START_Y = Math.round(GAME_HEIGHT * 0.78);
const GUEST_OFFSET_Y = Math.round(GAME_HEIGHT * 0.90) - START_Y;
// Room the block needs between START's centre and the bottom of the screen.
const START_MIN_BOTTOM_GAP = 150;

/**
 * Title screen with start.png as the painted background.
 *
 * Two buttons:
 *   START          - launches the main game using Julian's save profile
 *   start as guest - launches with the 'guest' profile so trying out the
 *                    game doesn't pollute Julian's catch records
 */
export class TitleScene extends Phaser.Scene {
  constructor() { super('TitleScene'); }

  create() {
    this._startUi = null;

    // Background as a DOM <img> behind the (transparent) Phaser canvas.
    // The painting is 4:3; object-fit: cover makes it fill any screen, and
    // the browser scales the full-resolution PNG straight to device pixels
    // (sharper than routing it through the canvas).
    this._setupDomBackground();

    // Title-screen music at slightly lower volume than gameplay ambient.
    // Use game.sound (global) and stopByKey to defend against duplicate
    // plays from HMR / scene re-enter: nothing of this key is allowed to
    // be playing before we start a fresh one.
    this.sound.stopByKey(MUSIC.START);
    this.audio = new AudioManager(this);
    // AudioManager defers actual playback to the 'unlocked' event when
    // sound.locked is true (iOS Safari before first tap), so calling
    // this now is safe -- it will start the moment the user taps.
    this.audio.playMusic(MUSIC.START, { volume: 0.20 });

    // Hard guarantee: when this scene shuts down for ANY reason, kill
    // every sound instance for this key so the title theme never leaks
    // into the FishingScene.
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.sound.stopByKey(MUSIC.START);
    });

    // Camera + screen-anchored pieces (background box, button block).
    bindLayout(this, { alignY: VIEW_ALIGN_Y }, (layout) => this._applyLayout(layout));

    // === Invisible tap-to-start overlay ===
    // Show ONLY the painted scene at first. The START + guest buttons
    // are deliberately hidden until any tap lands on the page. That tap
    // serves two purposes:
    //   1. It unlocks WebAudio on iOS Safari so the title theme starts.
    //   2. It reveals the buttons, so a child doesn't waste their first
    //      tap on a visible button that wouldn't have triggered audio
    //      anyway (we want the audio to be heard, not skipped past).
    // We use a world-sized invisible Phaser zone (the visible screen is
    // always a slice of the world) so we don't need an extra DOM listener;
    // pointerdown on a Phaser Zone has the same gesture-credibility for
    // iOS' audio unlock as any other tap.
    this._tapZone = this.add.zone(WORLD_LEFT, WORLD_TOP, WORLD_WIDTH, WORLD_HEIGHT)
      .setOrigin(0, 0)
      .setInteractive()
      .setDepth(100);
    this._tapZone.once('pointerdown', () => this._revealStartUI());
  }

  _revealStartUI() {
    if (this._tapZone) { this._tapZone.destroy(); this._tapZone = null; }
    if (this._startUi) return;

    // One container for the whole button block so a resize / rotation
    // only has to move a single object.
    const ui = this.add.container(0, 0);
    ui.setDepth(10);
    this._buildPrimaryButton(ui);
    this._buildGuestButton(ui);
    this._startUi = ui;
    this._applyLayout(this.layout);
  }

  /**
   * Called on create and on every resize / rotation.
   */
  _applyLayout(layout) {
    if (!layout) return;

    // Background: exactly the game container's box (not 100vw/100vh --
    // on phones those can be larger than the visible area).
    if (this._domBgEl) {
      const c = layout.container;
      this._domBgEl.style.left   = `${c.left}px`;
      this._domBgEl.style.top    = `${c.top}px`;
      this._domBgEl.style.width  = `${c.width}px`;
      this._domBgEl.style.height = `${c.height}px`;
    }

    // Buttons: pinned to the right edge of the screen (inside the safe
    // area). Vertically they keep their spot in the design frame, unless
    // the screen is too short for that -- then they move up to stay fully
    // visible.
    if (this._startUi) {
      const safe = layout.safe;
      this._startUi.setPosition(
        safe.right - START_MARGIN_RIGHT - START_W / 2,
        Math.min(START_Y, safe.bottom - START_MIN_BOTTOM_GAP),
      );
    }
  }

  _buildPrimaryButton(ui) {
    // START sits at the container origin. Children draw in the order they
    // are added: shadow, halo, pill, label.
    const W = START_W, H = START_H;

    // Drop shadow.
    for (let i = 0; i < 5; i++) {
      ui.add(this.add.rectangle(4, 6, W + i * 4, H + i * 3, 0x000000, 0.07));
    }

    // Pulsing halo behind for "tap me" cue (vector-only, no PNG jitter).
    const halo = this.add.rectangle(0, 0, W + 30, H + 30, 0x4ecd5a, 0.30);
    halo.setBlendMode(Phaser.BlendModes.ADD);
    ui.add(halo);
    this.tweens.add({
      targets: halo,
      alpha: { from: 0.12, to: 0.50 },
      scale: { from: 1.0, to: 1.05 },
      duration: 1100,
      yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
    });

    // Main pill -- olive-green to match the painted style of start.png.
    const pill = this.add.rectangle(0, 0, W, H, 0x35b94a, 1);
    pill.setStrokeStyle(4, 0xffffff, 1);
    pill.setInteractive({ useHandCursor: true });
    ui.add(pill);

    ui.add(this.add.text(0, 0, 'START', {
      fontFamily: 'sans-serif',
      fontSize: '52px',
      fontStyle: 'bold',
      color: '#ffffff',
      stroke: '#0a3914',
      strokeThickness: 4,
    }).setOrigin(0.5));

    pill.on('pointerdown', () => this._enterGame('julian'));
  }

  _buildGuestButton(ui) {
    // Directly under the primary button, same right alignment.
    // Just a small text link with a hit-area.
    const label = this.add.text(0, GUEST_OFFSET_Y, 'start as guest', {
      fontFamily: 'sans-serif',
      fontSize: '22px',
      fontStyle: 'bold',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 3,
    }).setOrigin(0.5);
    label.setInteractive({ useHandCursor: true });
    label.on('pointerover', () => label.setColor('#ffd24a'));
    label.on('pointerout',  () => label.setColor('#ffffff'));
    label.on('pointerdown', () => this._enterGame('guest'));
    ui.add(label);
  }

  _enterGame(profile) {
    SaveSystem.setProfile(profile);
    this._teardownDomBackground();
    // Stop the title theme so it doesn't overlap with FishingScene ambient.
    if (this.audio) this.audio.stopMusic();
    // Next stop: choose where to fish.
    this.scene.start('MapSelectScene');
  }

  _setupDomBackground() {
    // Use a real <img> tag with object-fit: cover. Mirrors the video
    // element approach in FishingScene which works on iPad Safari. CSS
    // background-image on a div proved unreliable across iPad Safari
    // versions; <img> is uniformly supported.
    const img = document.createElement('img');
    img.className = 'title-bg';
    img.src = '/clean/start.png';
    img.alt = '';
    img.style.position = 'fixed';
    // Box = the game container; kept in sync by _applyLayout.
    img.style.top = '0';
    img.style.left = '0';
    img.style.width = '100%';
    img.style.height = '100%';
    img.style.objectFit = 'cover';
    // Same crop rule as the camera (see VIEW_ALIGN_Y).
    img.style.objectPosition = `50% ${VIEW_ALIGN_Y * 100}%`;
    // z-index 0 sits BELOW #game (z-index: 1, set in index.html) but
    // ABOVE html's background paint. Negative z-index proved unreliable
    // on iPad Safari -- the element could end up hidden behind the html
    // background paint regardless of fallback colour.
    img.style.zIndex = '0';
    img.style.pointerEvents = 'none';
    img.style.backgroundColor = '#1c2530';   // visible behind the img while it decodes
    document.body.appendChild(img);
    this._domBgEl = img;

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this._teardownDomBackground());
  }

  _teardownDomBackground() {
    if (this._domBgEl) {
      this._domBgEl.remove();
      this._domBgEl = null;
    }
  }
}
