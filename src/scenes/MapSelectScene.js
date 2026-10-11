import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../constants.js';
import { bindLayout } from '../systems/Layout.js';
import { SaveSystem } from '../systems/SaveSystem.js';
import { MAPS } from '../data/maps.js';
import { TEX } from './BootScene.js';
import { addGlow, pressable } from '../systems/Ui.js';

/**
 * "Where shall we fish?" -- one big picture per map, tap to go there.
 *
 * Wordless on purpose: each card is simply that map's painting, hung like a
 * framed picture on the wall of a fishing cabin. The card of the map the
 * player fished on last gets a soft pulsing glow.
 *
 * Reached from the title screen and from the map button in the fishing HUD.
 */

// Cards are 4:3 like the paintings, side by side in the design frame.
const CARD_W   = 500;
const CARD_H   = 375;
const CARD_GAP = 70;
const BORDER   = 8;

const BG_COLOR      = 0x6b4a2b;   // shows only if the wall painting is missing
const BORDER_COLOR  = 0xfff6e0;
const GLOW_COLOR    = 0xffd24a;

// Drawn far larger than the design frame so it fills any screen.
const BG_OVERSIZE = 6000;

export class MapSelectScene extends Phaser.Scene {
  constructor() { super('MapSelectScene'); }

  create() {
    this._leaving = false;

    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, BG_OVERSIZE, BG_OVERSIZE, BG_COLOR);
    const wall = this.textures.exists(TEX.MAPSELECT_BG)
      ? this.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, TEX.MAPSELECT_BG)
      : null;

    const totalW = MAPS.length * CARD_W + (MAPS.length - 1) * CARD_GAP;
    const firstX = (GAME_WIDTH - totalW) / 2 + CARD_W / 2;
    const lastMapId = SaveSystem.getCurrentMap();

    MAPS.forEach((map, i) => {
      const x = firstX + i * (CARD_W + CARD_GAP);
      this._buildCard(map, x, GAME_HEIGHT / 2, map.id === lastMapId);
    });

    // Camera: keep both cards (plus breathing room) on screen, zooming out
    // only on screens too small for them.
    bindLayout(this, { mode: 'frame', fitWidth: totalW + 80, fitHeight: CARD_H + 120 }, (layout) => {
      if (!wall) return;
      // The wall covers whatever part of the frame is on screen, like CSS
      // background-size: cover.
      const { view } = layout;
      wall.setPosition(view.centerX, view.centerY);
      wall.setScale(Math.max(view.width / wall.width, view.height / wall.height));
    });
  }

  _buildCard(map, x, y, isLast) {
    // A glow behind the painting of the map visited last.
    if (isLast) addGlow(this, x, y, { w: CARD_W + 8, h: CARD_H + 8, radius: 14 });

    // Soft drop shadow, then the frame (golden on the map visited last).
    for (let i = 0; i < 4; i++) {
      this.add.rectangle(x + 5, y + 8, CARD_W + BORDER * 2 + i * 6, CARD_H + BORDER * 2 + i * 6,
                         0x000000, 0.08);
    }
    this.add.rectangle(x, y, CARD_W + BORDER * 2, CARD_H + BORDER * 2,
                       isLast ? GLOW_COLOR : BORDER_COLOR)
      .setStrokeStyle(4, 0x3a1d06);

    // The painting itself. Every map painting is 4:3, like the card.
    let picture;
    if (this.textures.exists(map.backdropKey)) {
      picture = this.add.image(x, y, map.backdropKey);
      picture.setDisplaySize(CARD_W, CARD_H);
    } else {
      picture = this.add.rectangle(x, y, CARD_W, CARD_H, 0x205070);
    }

    pressable(this, picture, () => this._enter(map));
  }

  _enter(map) {
    if (this._leaving) return;
    this._leaving = true;
    // Defer to the next frame: starting another scene from inside Phaser's
    // pointerdown pass can lose the transition (see CatchDisplayScene).
    this.time.delayedCall(0, () => {
      this.scene.start('FishingScene', { mapId: map.id });
    });
  }
}
