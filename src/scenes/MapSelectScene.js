import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../constants.js';
import { bindLayout } from '../systems/Layout.js';
import { SaveSystem } from '../systems/SaveSystem.js';
import { MAPS } from '../data/maps.js';
import { AudioManager } from '../systems/AudioManager.js';
import { TEX } from './BootScene.js';
import { UI, COLOR, addGlow, lettering, pressable } from '../systems/Ui.js';

/**
 * "Where shall we fish?" -- one big picture per map, tap to go there.
 *
 * Each card is simply that map's painting, hung like a framed picture on
 * the wall of a fishing cabin, with its name on a plate under it; a tap
 * also SAYS the name, for whoever cannot read yet. The card of the map the
 * player fished on last gets a soft pulsing glow.
 *
 * A third, small picture hangs in the top-left corner: the title painting.
 * It leads back to the start menu, where the other team can take over.
 *
 * Reached from the title screen and from the map button in the fishing HUD.
 */

// Cards are 4:3 like the paintings, side by side in the design frame: three
// of them fill its width.
const CARD_W   = 384;
const CARD_H   = 288;
const CARD_GAP = 34;
const BORDER   = 8;
// The name plate hangs from the frame's lower edge (its picture is 600 x 200).
const PLATE_W  = 264;
const PLATE_H  = 88;
const PLATE_DROP = 34;            // from the frame's lower edge to the plate's middle
// A moment for the name to start sounding before the map opens.
const ENTER_DELAY_MS = 350;

const BG_COLOR      = 0x6b4a2b;   // shows only if the wall painting is missing
const BORDER_COLOR  = 0xfff6e0;
const GLOW_COLOR    = 0xffd24a;

// Drawn far larger than the design frame so it fills any screen.
const BG_OVERSIZE = 6000;

// The way back to the start menu: the title painting in a small frame, with
// a name plate under it for whoever can read.
const HOME_W = 200;
const HOME_H = 150;              // 4:3, like the painting
const HOME_BORDER = 6;
const HOME_PLATE_W = 190;        // the board's picture is 600 x 200
const HOME_PLATE_H = 62;
const HOME_PLATE_Y = HOME_H / 2 + 18;
const HOME_MARGIN = 22;          // from the screen's edges
const HOME_MIN_SCALE = 0.5;      // on a low screen it shrinks, but not to nothing
// From the top of its frame to the bottom of its name plate.
const HOME_TOP = (HOME_H + HOME_BORDER * 2) / 2;
const HOME_FULL_H = HOME_TOP + HOME_PLATE_Y + HOME_PLATE_H / 2;

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
    const home = this._buildHomeButton();

    // Camera: keep both cards (plus breathing room) on screen, zooming out
    // only on screens too small for them.
    bindLayout(this, { mode: 'frame', fitWidth: totalW + 40, fitHeight: CARD_H + 190 }, (layout) => {
      const { view, safe } = layout;

      // The way back hangs in the top-left corner of the screen. Where the
      // screen is too low to fit it above the cards, it shrinks.
      const cardsTop = GAME_HEIGHT / 2 - CARD_H / 2 - BORDER;
      const room = cardsTop - safe.top - HOME_MARGIN - 10;
      const scale = Phaser.Math.Clamp(room / HOME_FULL_H, HOME_MIN_SCALE, 1);
      home.setScale(scale);
      home.setPosition(safe.left + HOME_MARGIN + (HOME_W / 2 + HOME_BORDER) * scale,
                       safe.top + HOME_MARGIN + HOME_TOP * scale);

      if (!wall) return;
      // The wall covers whatever part of the frame is on screen, like CSS
      // background-size: cover.
      wall.setPosition(view.centerX, view.centerY);
      wall.setScale(Math.max(view.width / wall.width, view.height / wall.height));
    });
  }

  /** The title painting as a small framed picture: tap to go back there. */
  _buildHomeButton() {
    const home = this.add.container(0, 0);
    for (let i = 0; i < 3; i++) {
      home.add(this.add.rectangle(3, 5, HOME_W + HOME_BORDER * 2 + i * 5, HOME_H + HOME_BORDER * 2 + i * 5,
                                  0x000000, 0.08));
    }
    home.add(this.add.rectangle(0, 0, HOME_W + HOME_BORDER * 2, HOME_H + HOME_BORDER * 2, BORDER_COLOR)
      .setStrokeStyle(3, 0x3a1d06));
    home.add(this.textures.exists(TEX.START_BG)
      ? this.add.image(0, 0, TEX.START_BG).setDisplaySize(HOME_W, HOME_H)
      : this.add.rectangle(0, 0, HOME_W, HOME_H, 0x205070));

    if (this.textures.exists(UI.BOARD_LABEL)) {
      home.add(this.add.image(0, HOME_PLATE_Y, UI.BOARD_LABEL).setDisplaySize(HOME_PLATE_W, HOME_PLATE_H));
    }
    home.add(this.add.text(0, HOME_PLATE_Y, 'Startmenu', lettering(22)).setOrigin(0.5));

    // One generous tap target for picture and plate together (it reaches
    // as far above the frame as the plate hangs below it).
    home.setSize(HOME_W + 40, (HOME_PLATE_Y + HOME_PLATE_H / 2) * 2 + 12);
    pressable(this, home, () => this._toTitle());
    return home;
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

    // Its name, for whoever can read.
    if (map.nlName) {
      const plateY = y + CARD_H / 2 + BORDER + PLATE_DROP;
      if (this.textures.exists(UI.BOARD_LABEL)) {
        this.add.image(x, plateY, UI.BOARD_LABEL).setDisplaySize(PLATE_W, PLATE_H);
      }
      this.add.text(x, plateY, map.nlName, lettering(27, COLOR.GOLD)).setOrigin(0.5);
    }

    pressable(this, picture, () => this._enter(map));
  }

  _enter(map) {
    if (this._leaving) return;
    this._leaving = true;
    // Say where we are going; the voice carries on while the map opens.
    new AudioManager(this).playPhrase(`map_${map.id}`);
    // (Not from inside Phaser's pointerdown pass: starting another scene
    // there can lose the transition -- see CatchDisplayScene.)
    this.time.delayedCall(ENTER_DELAY_MS, () => {
      this.scene.start('FishingScene', { mapId: map.id });
    });
  }

  _toTitle() {
    if (this._leaving) return;
    this._leaving = true;
    // The player has tapped already: the title may show its buttons at once.
    this.time.delayedCall(0, () => {
      this.scene.start('TitleScene', { showButtons: true });
    });
  }
}
