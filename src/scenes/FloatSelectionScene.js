import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../constants.js';
import { SaveSystem } from '../systems/SaveSystem.js';
import { FLOATS, floatFullTextureKey, DEFAULT_FLOAT_ID } from '../data/floats.js';

/**
 * Modal-style scene for picking which bobber to use. Same architecture as
 * BaitSelectionScene -- scrim, panel, row of cards, tap to select.
 */
export class FloatSelectionScene extends Phaser.Scene {
  constructor() { super('FloatSelectionScene'); }

  create() {
    const scrim = this.add.rectangle(
      GAME_WIDTH / 2, GAME_HEIGHT / 2,
      GAME_WIDTH, GAME_HEIGHT,
      0x000000, 0.55
    );
    scrim.setInteractive();
    scrim.on('pointerdown', () => this._close());

    const panelW = Math.round(GAME_WIDTH * 0.78);
    const panelH = Math.round(GAME_HEIGHT * 0.60);
    const panel = this.add.rectangle(
      GAME_WIDTH / 2, GAME_HEIGHT / 2,
      panelW, panelH,
      0x1c2530, 0.95
    );
    panel.setStrokeStyle(3, 0xffffff, 0.4);
    panel.setInteractive();

    const selectedId = SaveSystem.getSelectedFloat() || DEFAULT_FLOAT_ID;

    const cardW = Math.floor((panelW - 60) / FLOATS.length);
    const cardH = Math.round(panelH * 0.85);
    const startX = GAME_WIDTH / 2 - panelW / 2 + 30 + cardW / 2;
    const cardY = GAME_HEIGHT / 2;

    FLOATS.forEach((fl, i) => {
      const x = startX + i * cardW;
      this._buildCard(fl, x, cardY, cardW - 12, cardH, fl.id === selectedId);
    });
  }

  _buildCard(fl, x, y, w, h, isSelected) {
    const c = this.add.container(x, y);
    c.setSize(w, h);
    c.setInteractive({ useHandCursor: true });

    const cardBg = this.add.rectangle(0, 0, w, h, isSelected ? 0x2c5e2c : 0x2b3540);
    cardBg.setStrokeStyle(isSelected ? 4 : 2, isSelected ? 0xffd24a : 0xffffff, isSelected ? 1 : 0.4);

    const key = floatFullTextureKey(fl.id);
    const sprite = this.add.image(0, -8, key);
    const longest = Math.max(sprite.width, sprite.height);
    if (longest > 0) sprite.setScale((h * 0.80) / longest);

    const label = this.add.text(0, h / 2 - 18, fl.displayName, {
      fontFamily: 'sans-serif',
      fontSize: '20px',
      fontStyle: 'bold',
      color: '#ffffff',
    });
    label.setOrigin(0.5);

    c.add([cardBg, sprite, label]);
    c.on('pointerdown', (_pointer, _x, _y, event) => {
      if (event && event.stopPropagation) event.stopPropagation();
      SaveSystem.setSelectedFloat(fl.id);
      this._close();
    });

    return c;
  }

  _close() {
    this.scene.stop();
    this.scene.wake('FishingScene');
  }
}
