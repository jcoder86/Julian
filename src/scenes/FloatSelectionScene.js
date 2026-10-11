import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../constants.js';
import { SaveSystem } from '../systems/SaveSystem.js';
import { bindLayout } from '../systems/Layout.js';
import { FLOATS, floatFullTextureKey, DEFAULT_FLOAT_ID } from '../data/floats.js';
import { addChoiceMenu, MENU_W, MENU_H } from '../systems/Ui.js';

/**
 * Modal-style scene for picking which float to use. Same as
 * BaitSelectionScene: a wooden board, one slot per float, tap to choose.
 */
export class FloatSelectionScene extends Phaser.Scene {
  constructor() { super('FloatSelectionScene'); }

  create() {
    // Phaser keeps this scene object between openings: start afresh.
    this._closed = false;

    // Camera: keep the board (plus a margin) fully on screen and centred,
    // zooming out only if the screen is too small for it.
    bindLayout(this, { mode: 'frame', fitWidth: MENU_W + 40, fitHeight: MENU_H + 40 });

    const selectedId = SaveSystem.getSelectedFloat() || DEFAULT_FLOAT_ID;

    addChoiceMenu(this, GAME_WIDTH / 2, GAME_HEIGHT / 2,
      FLOATS.map((fl) => ({
        texture: floatFullTextureKey(fl.id),
        label: fl.displayName,
        selected: fl.id === selectedId,
        onPick: () => {
          SaveSystem.setSelectedFloat(fl.id);
          this._close();
        },
      })),
      () => this._close());
  }

  _close() {
    if (this._closed) return;
    this._closed = true;
    this.scene.stop();
    this.scene.wake('FishingScene');
  }
}
