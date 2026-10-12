import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../constants.js';
import { SaveSystem } from '../systems/SaveSystem.js';
import { bindLayout } from '../systems/Layout.js';
import { baitOnMap, baitsForMap, baitFullTextureKey } from '../data/baits.js';
import { getMap } from '../data/maps.js';
import { addChoiceMenu, MENU_W, MENU_H } from '../systems/Ui.js';

/**
 * Modal-style scene that overlays the running FishingScene. Shows the
 * current map's baits and lures on a wooden board, the current one lit up.
 * Tap one to choose it and return; tap beside the board to cancel.
 *
 * Launched with { mapId }; the choice is remembered per map.
 */
export class BaitSelectionScene extends Phaser.Scene {
  constructor() { super('BaitSelectionScene'); }

  init(data) {
    this.map = getMap((data && data.mapId) || SaveSystem.getCurrentMap());
  }

  create() {
    // Phaser keeps this scene object between openings: start afresh.
    this._closed = false;

    // Camera: keep the board (plus a margin) fully on screen and centred,
    // zooming out only if the screen is too small for it.
    bindLayout(this, { mode: 'frame', fitWidth: MENU_W + 40, fitHeight: MENU_H + 40 });

    const saved = SaveSystem.getSelectedBait(this.map.id);
    const selectedId = baitOnMap(saved, this.map.id) ? saved : this.map.defaultBait;

    addChoiceMenu(this, GAME_WIDTH / 2, GAME_HEIGHT / 2,
      baitsForMap(this.map.id).map((bait) => ({
        texture: baitFullTextureKey(bait.id),
        label: bait.nlName,
        selected: bait.id === selectedId,
        onPick: () => {
          SaveSystem.setSelectedBait(bait.id, this.map.id);
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
