import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../constants.js';
import { TEX } from './BootScene.js';
import { SaveSystem } from '../systems/SaveSystem.js';
import { AudioManager, MUSIC } from '../systems/AudioManager.js';

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
    // Background as a DOM <div> behind the (transparent) Phaser canvas.
    // Mirrors the FishingScene's DOM video trick: the painted 4:3 scene
    // fills the entire device viewport via CSS `background-size: cover`,
    // so on an iPad (also 4:3) it lines up edge-to-edge without
    // letterbox. Without this, a Phaser-rendered bg would get
    // double-letterboxed (canvas 16:9 in a 4:3 viewport AND a 4:3 image
    // in a 16:9 canvas) and the scene would shrink to ~50% screen area.
    this._setupDomBackground();

    // Match the catch-display approach: keep the canvas letterbox bars
    // dark instead of showing whatever sat behind the canvas.
    document.body.style.backgroundColor = '#1c2530';

    // Title-screen music at slightly lower volume than gameplay ambient.
    // Use game.sound (global) and stopByKey to defend against duplicate
    // plays from HMR / scene re-enter: nothing of this key is allowed to
    // be playing before we start a fresh one.
    this.sound.stopByKey(MUSIC.START);
    this.audio = new AudioManager(this);
    this.audio.playMusic(MUSIC.START, { volume: 0.20 });

    // Hard guarantee: when this scene shuts down for ANY reason, kill
    // every sound instance for this key so the title theme never leaks
    // into the FishingScene.
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.sound.stopByKey(MUSIC.START);
    });

    // === START button (big, primary) ===
    this._buildPrimaryButton();

    // === Start-as-guest (small, secondary) ===
    this._buildGuestButton();
  }

  _buildPrimaryButton() {
    // Bottom-right of the canvas. Because the DOM background fills the
    // device viewport (no letterbox), canvas-right == screen-right on
    // a 4:3 iPad.
    const W = 280, H = 90;
    const btnX = GAME_WIDTH - 36 - W / 2;
    const btnY = Math.round(GAME_HEIGHT * 0.78);

    // Drop shadow.
    for (let i = 0; i < 5; i++) {
      const sh = this.add.rectangle(btnX + 4, btnY + 6, W + i * 4, H + i * 3,
                                    0x000000, 0.07);
      sh.setDepth(9);
    }
    // Main pill -- olive-green to match the painted style of start.png.
    const pill = this.add.rectangle(btnX, btnY, W, H, 0x35b94a, 1);
    pill.setStrokeStyle(4, 0xffffff, 1);
    pill.setDepth(10);
    pill.setInteractive({ useHandCursor: true });

    // Pulsing halo behind for "tap me" cue (vector-only, no PNG jitter).
    const halo = this.add.rectangle(btnX, btnY, W + 30, H + 30, 0x4ecd5a, 0.30);
    halo.setBlendMode(Phaser.BlendModes.ADD);
    halo.setDepth(9);
    this.tweens.add({
      targets: halo,
      alpha: { from: 0.12, to: 0.50 },
      scale: { from: 1.0, to: 1.05 },
      duration: 1100,
      yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
    });

    this.add.text(btnX, btnY, 'START', {
      fontFamily: 'sans-serif',
      fontSize: '52px',
      fontStyle: 'bold',
      color: '#ffffff',
      stroke: '#0a3914',
      strokeThickness: 4,
    }).setOrigin(0.5).setDepth(11);

    pill.on('pointerdown', () => this._enterGame('julian'));
  }

  _buildGuestButton() {
    // Directly under the primary button, same canvas-right alignment.
    const W = 280;
    const btnX = GAME_WIDTH - 36 - W / 2;
    const btnY = Math.round(GAME_HEIGHT * 0.90);

    // Just a small text link with a hit-area.
    const label = this.add.text(btnX, btnY, 'start as guest', {
      fontFamily: 'sans-serif',
      fontSize: '22px',
      fontStyle: 'bold',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 3,
    }).setOrigin(0.5).setDepth(11);
    label.setInteractive({ useHandCursor: true });
    label.on('pointerover', () => label.setColor('#ffd24a'));
    label.on('pointerout',  () => label.setColor('#ffffff'));
    label.on('pointerdown', () => this._enterGame('guest'));
  }

  _enterGame(profile) {
    SaveSystem.setProfile(profile);
    document.body.style.backgroundColor = '';
    this._teardownDomBackground();
    // Stop the title theme so it doesn't overlap with FishingScene ambient.
    if (this.audio) this.audio.stopMusic();
    this.scene.start('FishingScene');
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
    img.style.top = '0';
    img.style.left = '0';
    img.style.width = '100vw';
    img.style.height = '100vh';
    img.style.objectFit = 'cover';
    img.style.objectPosition = 'center';
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
