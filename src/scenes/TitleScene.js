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
    // Background: start.png is a 4:3 image (1448x1086). Fit by HEIGHT so
    // the full painted scene is visible without cropping the top or
    // bottom. The 16:9 canvas leaves dark bars on the LEFT and RIGHT;
    // body.backgroundColor (set below) covers them seamlessly.
    //
    // We store the visible image's right-edge x so the buttons can be
    // positioned WITHIN the painted scene rather than against the canvas
    // edge (which would land them in the dark letterbox).
    if (this.textures.exists(TEX.START_BG)) {
      const bg = this.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, TEX.START_BG);
      bg.setOrigin(0.5);
      bg.setScale(GAME_HEIGHT / bg.height);
      bg.setDepth(0);
      this._bgRightX = GAME_WIDTH / 2 + bg.displayWidth / 2;
      this._bgLeftX  = GAME_WIDTH / 2 - bg.displayWidth / 2;
    } else {
      this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2,
                         GAME_WIDTH, GAME_HEIGHT, 0x1c2530).setDepth(0);
      this._bgRightX = GAME_WIDTH;
      this._bgLeftX  = 0;
    }

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
    // Bottom-right placement WITHIN the painted scene -- positioned from
    // the actual displayed image's right edge, not the canvas edge, so
    // the button doesn't land in the letterbox.
    const W = 280, H = 90;
    const btnX = this._bgRightX - 28 - W / 2;
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
    // Sit directly under the primary START button (also bottom-right,
    // within the painted scene, not against the canvas edge).
    const W = 280;
    const btnX = this._bgRightX - 28 - W / 2;
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
    // Stop the title theme so it doesn't overlap with FishingScene ambient.
    if (this.audio) this.audio.stopMusic();
    this.scene.start('FishingScene');
  }
}
