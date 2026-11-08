import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../constants.js';
import { SaveSystem } from '../systems/SaveSystem.js';
import { bindLayout } from '../systems/Layout.js';
import { BOATS, boatIconKey, DEFAULT_BOAT_ID } from '../data/boats.js';
import { addChoiceMenu, MENU_W, MENU_H } from '../systems/Ui.js';

/**
 * Modal-style scene for picking which boat to fish from on the big ocean
 * (it takes the place of the float menu there). Same as the bait and float
 * menus: a wooden board, one slot per boat, tap to choose. The fishing
 * scene puts the new boat in when it wakes up.
 */
export class BoatSelectionScene extends Phaser.Scene {
  constructor() { super('BoatSelectionScene'); }

  create() {
    // Phaser keeps this scene object between openings: start afresh.
    this._closed = false;

    bindLayout(this, { mode: 'frame', fitWidth: MENU_W + 40, fitHeight: MENU_H + 40 });

    const selectedId = SaveSystem.getSelectedBoat() || DEFAULT_BOAT_ID;

    addChoiceMenu(this, GAME_WIDTH / 2, GAME_HEIGHT / 2,
      BOATS.map((boat) => ({
        texture: boatIconKey(boat),
        label: boat.nlName,
        selected: boat.id === selectedId,
        onPick: () => {
          SaveSystem.setSelectedBoat(boat.id);
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
