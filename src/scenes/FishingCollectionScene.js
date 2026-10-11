import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../constants.js';
// Phaser is bundled via vite; ensure side-effect import for BlendModes etc.
import { FISH_SIZES, fishTextureKey, speciesForMap } from '../data/fish.js';
import { MAPS, getMap } from '../data/maps.js';
import { getTeam } from '../data/teams.js';
import { SaveSystem } from '../systems/SaveSystem.js';
import { bindLayout } from '../systems/Layout.js';
import { TEX } from './BootScene.js';
import { UI, UI_FONT, COLOR, continueKey, lettering, addGlow, addInset, pressable } from '../systems/Ui.js';

/**
 * Trophy collection: a grid of wooden boards on the cabin wall, one per
 * species. Each board shows the largest cm landed for each size (or the
 * fish's dark shape if never caught), the species' Dutch name and how many
 * were caught. The species of the most recent catch glows, so the player
 * can see "what I just caught" at a glance.
 *
 * The layout is fixed at 12 cards (one per species), so the screen never
 * grows even with thousands of catches -- the trophy values just go up.
 *
 * Each map has its own page of 12. The scene opens on the page of the map
 * it was launched from ({ mapId }); the little painting in the top-right
 * corner flips to the other map's page.
 */

// The wall of the fishing cabin (the map-select screen's painting), toned
// down so the boards with the fish stand out; a plain colour if it is
// missing.
const WALL_COLOR = 0x4a2f18;
const WALL_SHADE = 0.42;
// A fish that has not been caught yet: its shape, dark, like a burn mark.
const UNCAUGHT_TINT = 0x2b1505;

// 4 columns x 3 rows = 12 cells, one per species. Cells are 280×190 with 14px gap.
const COLS = 4;
const ROWS = 3;
const CARD_W = 280;
const CARD_H = 190;
const CARD_GAP = 14;
const TITLE_BAR_H = 92;

// Back button (top-left): the team's "go on fishing" picture.
const BACK_DISPLAY = 92;
const BACK_MARGIN  = 18;

// "Other map" button (top-right): a thumbnail of that map's painting.
const SWITCH_W = 112;
const SWITCH_H = 84;

// The background is drawn far larger than the design frame: on screens
// that aren't 16:9 the camera shows more than the frame, and it should
// all be "trophy hall", never a gap.
const BG_OVERSIZE = 6000;

export class FishingCollectionScene extends Phaser.Scene {
  constructor() {
    super('FishingCollectionScene');
  }

  init(data) {
    this.map = getMap((data && data.mapId) || SaveSystem.getCurrentMap());
  }

  create() {
    // This scene's background covers the whole screen, so the
    // FishingScene's DOM video behind the canvas is invisible -- hide it
    // rather than let the browser keep compositing it. Same as
    // CatchDisplayScene.
    this._hiddenVideoEl = document.querySelector('video');
    if (this._hiddenVideoEl) this._hiddenVideoEl.style.display = 'none';

    // Background: the cabin wall.
    this._buildBackground();

    // Title.
    const team = getTeam(SaveSystem.getProfile());
    this.add.text(GAME_WIDTH / 2, 48, team.collectionTitle, lettering(44, COLOR.GOLD))
      .setOrigin(0.5).setDepth(10);

    // Back button -- top-left: the same round picture that means "go on
    // fishing" on the catch screen, with the same breathing glow. Both
    // share a container that _applyLayout pins to the screen's left edge.
    const backGroup = this.add.container(0, 0);
    backGroup.setDepth(10);
    backGroup.add(addGlow(this, 0, 0, { r: BACK_DISPLAY / 2 - 4 }));
    const backKey = this.textures.exists(continueKey(team.id)) ? continueKey(team.id) : TEX.PLAY;
    const back = this.add.image(0, 0, backKey);
    back.setScale(BACK_DISPLAY / Math.max(back.width, back.height));
    backGroup.add(back);
    pressable(this, back, () => this._close());
    this._backGroup = backGroup;

    this._buildMapSwitch();
    this._buildCards();

    // Camera: zoom out just enough that the whole design frame (title +
    // 4x3 card grid) is on screen, whatever the aspect ratio. On a 4:3
    // iPad that is zoom 1 -- unchanged.
    bindLayout(this, { mode: 'frame' }, (layout) => this._applyLayout(layout));

    // ESC to close (desktop debugging).
    this.input.keyboard?.on('keydown-ESC', () => this._close());
  }

  /**
   * Called on create and on every resize / rotation.
   */
  _applyLayout(layout) {
    if (!layout || !this._backGroup) return;
    // The wall covers whatever part of the frame is on screen.
    if (this._wall) {
      const { view } = layout;
      this._wall.setPosition(view.centerX, view.centerY);
      this._wall.setScale(Math.max(view.width / this._wall.width, view.height / this._wall.height));
    }
    // Back button: on the title row, hugging the left edge of the screen
    // (inside the safe area -- phones have a notch there in landscape).
    // If the safe area starts below the title row, the button follows it.
    const half = BACK_DISPLAY / 2;
    const rowY = Math.max(BACK_MARGIN + half, layout.safe.top + BACK_MARGIN + half);
    this._backGroup.setPosition(layout.safe.left + BACK_MARGIN + half, rowY);
    // The map switch mirrors it on the right edge.
    if (this._switchGroup) {
      this._switchGroup.setPosition(layout.safe.right - BACK_MARGIN - SWITCH_W / 2, rowY);
    }
  }

  /**
   * A small framed painting of the NEXT map; tap it to see that map's
   * catches. With a single map there is nothing to switch to.
   */
  _buildMapSwitch() {
    this._switchGroup = null;
    if (MAPS.length < 2) return;
    const next = MAPS[(MAPS.findIndex((m) => m.id === this.map.id) + 1) % MAPS.length];

    const group = this.add.container(0, 0);
    group.setDepth(10);
    group.add(this.add.rectangle(0, 0, SWITCH_W + 12, SWITCH_H + 12, 0xfff3d6)
      .setStrokeStyle(3, 0x3a1d06));
    let picture;
    if (this.textures.exists(next.backdropKey)) {
      picture = this.add.image(0, 0, next.backdropKey);
      picture.setDisplaySize(SWITCH_W, SWITCH_H);
    } else {
      picture = this.add.rectangle(0, 0, SWITCH_W, SWITCH_H, 0x205070);
    }
    picture.setInteractive({ useHandCursor: true });
    picture.on('pointerdown', () => {
      // Next frame: restarting from inside the pointerdown pass can be lost.
      this.time.delayedCall(0, () => this.scene.restart({ mapId: next.id }));
    });
    group.add(picture);
    this._switchGroup = group;
  }

  _close() {
    if (this._hiddenVideoEl) this._hiddenVideoEl.style.display = '';
    this.scene.stop();
    this.scene.wake('FishingScene');
  }

  _buildBackground() {
    // Drawn far beyond the design frame so it fills any screen.
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, BG_OVERSIZE, BG_OVERSIZE, WALL_COLOR)
      .setDepth(0);
    this._wall = this.textures.exists(TEX.MAPSELECT_BG)
      ? this.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, TEX.MAPSELECT_BG).setDepth(0)
      : null;
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, BG_OVERSIZE, BG_OVERSIZE, 0x1a0c02, WALL_SHADE)
      .setDepth(0);
  }

  _buildCards() {
    const fishCounts = SaveSystem.getFishCounts();          // { species: n }
    const sizeCounts = SaveSystem.getCatchCountsBySize();   // { species: { size: n } }
    const best       = SaveSystem.getBestCatches();         // { species: { size: cm } }
    const lastCatch  = SaveSystem.getLastCatch();           // { species, size, lengthCm } | null

    // Grid origin: centred horizontally, starting just below the title bar.
    const totalGridW = COLS * CARD_W + (COLS - 1) * CARD_GAP;
    const totalGridH = ROWS * CARD_H + (ROWS - 1) * CARD_GAP;
    const startX = (GAME_WIDTH  - totalGridW) / 2 + CARD_W / 2;
    const startY = TITLE_BAR_H + (GAME_HEIGHT - TITLE_BAR_H - totalGridH) / 2 + CARD_H / 2;

    speciesForMap(this.map.id).forEach((species, idx) => {
      const col = idx % COLS;
      const row = Math.floor(idx / COLS);
      const cx = startX + col * (CARD_W + CARD_GAP);
      const cy = startY + row * (CARD_H + CARD_GAP);

      const totalCount = fishCounts[species.id] || 0;
      const speciesBest = best[species.id] || {};
      const speciesSizeCounts = sizeCounts[species.id] || {};
      const isLast = lastCatch && lastCatch.species === species.id;

      this._buildCard(cx, cy, species, {
        totalCount,
        speciesBest,
        speciesSizeCounts,
        isLast,
        lastCaughtSize: isLast ? lastCatch.size : null,
      });
    });
  }

  _buildCard(cx, cy, species, info) {
    // A glow behind the board of the species caught last, so the eye goes
    // to "what I just caught".
    if (info.isLast) {
      addGlow(this, cx, cy, { w: CARD_W - 6, h: CARD_H - 6, radius: 30 }).setDepth(1);
    }

    // The board.
    if (this.textures.exists(UI.BOARD_CARD)) {
      this.add.image(cx, cy, UI.BOARD_CARD).setDisplaySize(CARD_W, CARD_H).setDepth(2);
    } else {
      this.add.rectangle(cx, cy, CARD_W, CARD_H, 0x8a4f1d).setStrokeStyle(3, 0x3a1d06).setDepth(2);
    }

    // Top line, between the two nails: the name and how many were caught,
    // centred together.
    const y = cy - CARD_H / 2 + 29;
    const name = this.add.text(0, y, species.nlName, lettering(19)).setOrigin(0, 0.5).setDepth(3);
    const count = this.add.text(0, y, `\u00d7 ${info.totalCount}`,
                                lettering(18, info.totalCount > 0 ? COLOR.GOLD : COLOR.FADED))
      .setOrigin(0, 0.5).setDepth(3);
    const gap = 9;
    name.x = cx - (name.width + gap + count.width) / 2;
    count.x = name.x + name.width + gap;

    // Centerpiece: the biggest specimen ever caught (any size). Helps the
    // player see "my best of this species". If never caught, its dark
    // shape hints at what is still out there.
    this._renderBestFish(cx, cy + 3, species, info);

    // Bottom strip: three small cells with the best cm per size.
    this._renderSizeStrip(cx, cy + CARD_H / 2 - 29, species, info);
  }

  /**
   * Renders the largest specimen the player has caught (across all sizes)
   * as the card centrepiece. Falls back to a dark shape when the species
   * has never been caught.
   */
  _renderBestFish(cx, cy, species, info) {
    // Find which size has the biggest cm; default to medium for fallback.
    let bestSize = null;
    let bestCm = -1;
    for (const size of FISH_SIZES) {
      const cm = info.speciesBest[size];
      if (typeof cm === 'number' && cm > bestCm) {
        bestSize = size;
        bestCm = cm;
      }
    }

    const renderSize = bestSize ?? 'medium';
    const key = fishTextureKey(species.id, renderSize);
    if (!this.textures.exists(key)) return;

    const fish = this.add.image(cx, cy, key);
    // Available footprint inside the board for the fish image.
    const targetW = CARD_W - 64;
    const targetH = CARD_H - 106;
    const scale = Math.min(targetW / fish.width, targetH / fish.height);
    fish.setScale(scale);
    fish.setDepth(3);

    if (bestSize === null) {
      fish.setTintFill(UNCAUGHT_TINT);
      fish.setAlpha(0.5);
    }
  }

  /**
   * Three small cells at the foot of the board showing the best cm for
   * each size. Empty (uncaught) cells show a dim dash.
   */
  _renderSizeStrip(cx, cy, species, info) {
    const cellW = (CARD_W - 40) / 3;
    const startCellX = cx - CARD_W / 2 + 20 + cellW / 2;

    FISH_SIZES.forEach((size, i) => {
      const x = startCellX + i * cellW;
      const cm = info.speciesBest[size];
      const haveCount = info.speciesSizeCounts[size] || 0;
      const filled = typeof cm === 'number';

      addInset(this, x, cy, cellW - 5, 28, filled ? 0.72 : 0.4).setDepth(3);
      const label = filled
        ? `${cm} cm${haveCount > 1 ? ` \u00b7${haveCount}` : ''}`
        : '\u2014';
      this.add.text(x, cy, label, {
        fontFamily: UI_FONT,
        fontSize: '15px',
        fontStyle: 'bold',
        color: filled ? COLOR.CREAM : COLOR.FADED,
      }).setOrigin(0.5).setDepth(4);
    });
  }
}
