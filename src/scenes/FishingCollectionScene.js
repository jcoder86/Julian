import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../constants.js';
// Phaser is bundled via vite; ensure side-effect import for BlendModes etc.
import { FISH_SIZES, catchKey, fishTextureKey, isGiant, speciesForMap } from '../data/fish.js';
import { MAPS, getMap } from '../data/maps.js';
import { getTeam } from '../data/teams.js';
import { SaveSystem } from '../systems/SaveSystem.js';
import { bindLayout } from '../systems/Layout.js';
import { TEX } from './BootScene.js';
import { AudioManager } from '../systems/AudioManager.js';
import { UI, COLOR, lettering, written, addGlow, addRays, addGlints, pressable } from '../systems/Ui.js';

/**
 * Trophy collection: a grid of paper cards pinned to the cabin wall, one
 * per species. Each card shows the largest cm landed for each size (or the
 * fish's faint shape if never caught), the species' Dutch name and how many
 * were caught. The species of the most recent catch glows, so the player
 * can see "what I just caught" at a glance.
 *
 * Tap a card and the voice says what fish it is: "een snoek!" -- the
 * phrase without a size, also for one that has not been caught yet.
 *
 * A species of which a GIANT was caught (the best catch is within 5 % of
 * the longest its kind can be: isGiant in data/fish.js) shows it for good:
 * golden rays behind the fish, glints on it, a gold star, and its length
 * on gold.
 *
 * The layout is fixed at 12 cards (one per species), so the screen never
 * grows even with thousands of catches -- the trophy values just go up.
 *
 * Each map has its own page of 12. Opened from the fishing screen the scene
 * shows the page of that map ({ mapId }); the little painting in the
 * top-right corner flips to the next map's page.
 *
 * Opened from the map screen ({ all: true, returnTo }) it is the whole
 * book: every map's page under the other, each under its name, and the
 * player scrolls through them with a finger. A fish that lives on two maps
 * has a card on both pages, each with its own catches (catchKey).
 */

// The bare wall of the fishing cabin, toned down a touch so the cards on it
// stand out; a plain colour if the painting is missing.
const WALL_COLOR = 0x8a5a2b;
const WALL_SHADE = 0.16;
// A fish that has not been caught yet: its shape, faint, like a pencil sketch.
const UNCAUGHT_TINT = 0x6b5740;
const UNCAUGHT_ALPHA = 0.3;
// The boxes at the foot of a card: a shade darker than its paper.
const CELL_COLOR = 0xb89a68;
const CELL_EDGE = 0x7a6140;
// A card with a giant on it. Paper is light, so the rays are drawn in gold
// paint rather than as added light; the white glints show on the fish, the
// amber ones on the paper around it.
const GIANT_GOLD = 0xffd23c;
const GIANT_GOLD_EDGE = 0x9a6a00;
const GIANT_RAYS = { radius: 100, color: 0xffa600, alpha: 0.85 };
const GIANT_AMBER = 0xff9a00;

// 4 columns x 3 rows = 12 cells, one per species. A card has the shape of
// its picture (480 x 352).
const COLS = 4;
const ROWS = 3;
const CARD_W = 268;
const CARD_H = 196;
const CARD_GAP = 14;
const TITLE_BAR_H = 92;

// Back button (top-left): the green "go on fishing" button.
const BACK_DISPLAY = 92;
const BACK_MARGIN  = 18;

// "Other map" button (top-right): a thumbnail of that map's painting.
const SWITCH_W = 112;
const SWITCH_H = 84;

// The room for a card's name and count on its top line, between the pins.
const TITLE_ROOM = 214;

// A tap on a card says its name; a finger that moved further than this
// (design px) was scrolling, not tapping.
const TAP_SLOP = 14;

// The whole book starts a little lower than a single page, clear of the
// back button: the cards slide away under one straight edge. A page is its
// name plate plus its grid, with some wall between pages -- on a 4:3 screen
// exactly one page fits. (The name plate's picture is 600 x 200.)
const BOOK_TOP = 112;
const PAGE_PLATE_W = 300;
const PAGE_PLATE_H = 100;
const PAGE_HEADER_H = 104;
const PAGE_GAP = 30;
const GRID_H = ROWS * CARD_H + (ROWS - 1) * CARD_GAP;
const PAGE_H = PAGE_HEADER_H + GRID_H + PAGE_GAP;
// Scrolling: how fast a flick dies out (share of its speed kept per
// 1/60 s), and below which speed (px/s) it stops.
const FLICK_KEEP = 0.94;
const FLICK_STOP = 12;
// Where in the book we are: a bar in the wall's right margin, and under it
// an arrow that bobs for as long as there is more below.
const BAR_X = GAME_WIDTH - 40;
const BAR_W = 12;
const BAR_MIN_THUMB = 48;
const BAR_COLOR = 0x3a1d06;
const THUMB_COLOR = 0xffd24a;
const MORE_ROOM = 58;            // kept free under the bar for the arrow

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
    // The whole book (every map's page) or one page; and where "back" goes
    // (a scene to start; without one, the fishing scene is woken).
    this.showAll = !!(data && data.all);
    this.returnTo = (data && data.returnTo) || null;
    this._content = null;
    this._scroll = 0;
    this._maxScroll = 0;
    this._flick = 0;
    this._drag = null;
    this._switchGroup = null;
    this._bar = null;
    this._more = null;
    this._view = null;
  }

  create() {
    this.audio = new AudioManager(this);
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

    // Back button -- top-left: the same round green button that means "go
    // on fishing" on the catch screen, with the same breathing glow. Both
    // share a container that _applyLayout pins to the screen's left edge.
    const backGroup = this.add.container(0, 0);
    backGroup.setDepth(10);
    backGroup.add(addGlow(this, 0, 0, { r: BACK_DISPLAY / 2 - 4 }));
    const backKey = this.textures.exists(UI.CONTINUE) ? UI.CONTINUE : TEX.PLAY;
    const back = this.add.image(0, 0, backKey);
    back.setScale(BACK_DISPLAY / Math.max(back.width, back.height));
    backGroup.add(back);
    pressable(this, back, () => this._close());
    this._backGroup = backGroup;

    // The cards live in one container: the whole book is moved by moving it.
    this._content = this.add.container(0, 0).setDepth(2);
    if (this.showAll) {
      MAPS.forEach((map, i) => this._buildPage(map, i * PAGE_H, true));
      this._enableScrolling();
    } else {
      this._buildMapSwitch();
      this._buildPage(this.map, 0, false);
    }

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
    // The whole book: how far it can be scrolled on this screen.
    if (this.showAll) {
      this._view = layout.view;
      const bookBottom = BOOK_TOP + MAPS.length * PAGE_H;
      this._maxScroll = Math.max(0, bookBottom - layout.view.bottom);
      this._scrollTo(this._scroll);
    }
  }

  /** Drag to scroll, flick to keep going, or turn the mouse wheel. */
  _enableScrolling() {
    // Cards disappear under the title row instead of sliding over it.
    const window = this.make.graphics();
    window.fillRect(-BG_OVERSIZE, BOOK_TOP - 4, BG_OVERSIZE * 2, BG_OVERSIZE);
    this._content.setMask(window.createGeometryMask());
    // (It is on no display list, so the scene does not clear it away itself.)
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => window.destroy());

    this._bar = this.add.graphics().setDepth(9);
    this._more = this.add.triangle(BAR_X, 0, 0, 0, 30, 0, 15, 20, THUMB_COLOR)
      .setStrokeStyle(3, BAR_COLOR).setDepth(9);

    const zoom = () => this.cameras.main.zoom || 1;
    this.input.on('pointerdown', (pointer) => {
      this._drag = { y: pointer.y, scroll: this._scroll, last: this._scroll, time: this.time.now };
      this._flick = 0;
    });
    this.input.on('pointermove', (pointer) => {
      if (!this._drag || !pointer.isDown) return;
      this._scrollTo(this._drag.scroll - (pointer.y - this._drag.y) / zoom());
      const dt = Math.max(1, this.time.now - this._drag.time);
      this._flick = (this._scroll - this._drag.last) / dt * 1000;
      this._drag.last = this._scroll;
      this._drag.time = this.time.now;
    });
    this.input.on('pointerup', () => { this._drag = null; });
    this.input.on('wheel', (_pointer, _over, _dx, dy) => {
      this._flick = 0;
      this._scrollTo(this._scroll + dy * 0.8);
    });
  }

  _scrollTo(y) {
    this._scroll = Phaser.Math.Clamp(y, 0, this._maxScroll);
    if (this._content) this._content.y = -this._scroll;
    this._drawBar();
  }

  /** The bar's thumb is as long as the share of the book that is on screen. */
  _drawBar() {
    if (!this._bar || !this._view) return;
    const canScroll = this._maxScroll > 0;
    this._bar.clear();
    this._more.setVisible(canScroll && this._scroll < this._maxScroll - 4);
    if (!canScroll) return;

    const top = BOOK_TOP + 8;
    const length = this._view.bottom - MORE_ROOM - top;
    const onScreen = this._view.bottom - BOOK_TOP;
    const thumb = Math.max(BAR_MIN_THUMB, length * onScreen / (onScreen + this._maxScroll));
    const at = top + (length - thumb) * this._scroll / this._maxScroll;
    this._bar.fillStyle(BAR_COLOR, 0.35);
    this._bar.fillRoundedRect(BAR_X - BAR_W / 2, top, BAR_W, length, BAR_W / 2);
    this._bar.fillStyle(THUMB_COLOR, 0.95);
    this._bar.fillRoundedRect(BAR_X - BAR_W / 2, at, BAR_W, thumb, BAR_W / 2);
    this._bar.lineStyle(2, BAR_COLOR, 0.9);
    this._bar.strokeRoundedRect(BAR_X - BAR_W / 2, at, BAR_W, thumb, BAR_W / 2);
  }

  update(time, delta) {
    if (!this.showAll) return;
    if (this._more && this._more.visible && this._view) {
      this._more.y = this._view.bottom - MORE_ROOM / 2 + Math.sin(time / 260) * 5;
    }
    // A flick carries the book on for a moment.
    if (this._drag || Math.abs(this._flick) < FLICK_STOP) return;
    const before = this._scroll;
    this._scrollTo(this._scroll + this._flick * delta / 1000);
    this._flick *= FLICK_KEEP ** (delta / (1000 / 60));
    if (this._scroll === before) this._flick = 0;       // against the top or the bottom
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
    if (this.returnTo) {
      // (Not from inside the pointerdown pass: see CatchDisplayScene.)
      this.time.delayedCall(0, () => this.scene.start(this.returnTo));
      return;
    }
    this.scene.stop();
    this.scene.wake('FishingScene');
  }

  _buildBackground() {
    // Drawn far beyond the design frame so it fills any screen.
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, BG_OVERSIZE, BG_OVERSIZE, WALL_COLOR)
      .setDepth(0);
    const wallKey = [TEX.COLLECTION_WALL, TEX.MAPSELECT_BG].find((key) => this.textures.exists(key));
    this._wall = wallKey
      ? this.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, wallKey).setDepth(0)
      : null;
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, BG_OVERSIZE, BG_OVERSIZE, 0x1a0c02, WALL_SHADE)
      .setDepth(0);
  }

  /** Add something to the book (it scrolls with it) and hand it back. */
  _put(object) {
    this._content.add(object);
    return object;
  }

  /**
   * One map's twelve cards, `top` px down the book; with its name on a
   * plate above them when the book shows more than one page.
   */
  _buildPage(map, top, withName) {
    const fishCounts = SaveSystem.getFishCounts();          // { key: n }
    const sizeCounts = SaveSystem.getCatchCountsBySize();   // { key: { size: n } }
    const best       = SaveSystem.getBestCatches();         // { key: { size: cm } }
    const lastCatch  = SaveSystem.getLastCatch();           // { species, size, lengthCm, mapId } | null
    const lastKey    = lastCatch ? catchKey(lastCatch.species, lastCatch.mapId) : null;

    let gridTop = top + (withName ? BOOK_TOP : TITLE_BAR_H);
    if (withName) {
      const plateY = gridTop + PAGE_HEADER_H / 2 - 4;
      if (this.textures.exists(UI.BOARD_LABEL)) {
        this._put(this.add.image(GAME_WIDTH / 2, plateY, UI.BOARD_LABEL)
          .setDisplaySize(PAGE_PLATE_W, PAGE_PLATE_H));
      }
      this._put(this.add.text(GAME_WIDTH / 2, plateY, map.nlName || map.id, lettering(30, COLOR.GOLD))
        .setOrigin(0.5));
      gridTop += PAGE_HEADER_H;
    } else {
      // One page alone is centred in the room under the title.
      gridTop += (GAME_HEIGHT - TITLE_BAR_H - GRID_H) / 2;
    }

    const totalGridW = COLS * CARD_W + (COLS - 1) * CARD_GAP;
    const startX = (GAME_WIDTH - totalGridW) / 2 + CARD_W / 2;
    const startY = gridTop + CARD_H / 2;

    speciesForMap(map.id).forEach((species, idx) => {
      const col = idx % COLS;
      const row = Math.floor(idx / COLS);
      const cx = startX + col * (CARD_W + CARD_GAP);
      const cy = startY + row * (CARD_H + CARD_GAP);
      // A fish that lives on two maps is kept apart per map.
      const key = catchKey(species.id, map.id);
      const isLast = key === lastKey;
      const speciesBest = best[key] || {};

      this._buildCard(cx, cy, species, {
        totalCount: fishCounts[key] || 0,
        speciesBest,
        speciesSizeCounts: sizeCounts[key] || {},
        isLast,
        lastCaughtSize: isLast ? lastCatch.size : null,
        // Was one of them a giant? (Nothing extra is saved for this: the
        // best length per size says it.)
        giant: FISH_SIZES.some((size) => isGiant(species.id, speciesBest[size])),
      });
    });
  }

  _buildCard(cx, cy, species, info) {
    this._makeSayable(cx, cy, species);
    // A glow behind the card of the species caught last, so the eye goes
    // to "what I just caught".
    if (info.isLast) {
      this._put(addGlow(this, cx, cy, { w: CARD_W - 4, h: CARD_H - 4, radius: 16 }));
    }

    // The card.
    if (this.textures.exists(UI.CARD)) {
      this._put(this.add.image(cx, cy, UI.CARD).setDisplaySize(CARD_W, CARD_H));
    } else {
      this._put(this.add.rectangle(cx, cy, CARD_W, CARD_H, 0xf1dfb8).setStrokeStyle(2, 0x7a6140));
    }
    // A giant: golden rays on the paper, behind everything written on it.
    if (info.giant) {
      this._put(addRays(this, cx, cy + 3, GIANT_RAYS.radius, {
        color: GIANT_RAYS.color, alpha: GIANT_RAYS.alpha, blend: Phaser.BlendModes.NORMAL,
      }));
    }

    // Top line, between the two pins: the name and how many were caught,
    // centred together.
    const y = cy - CARD_H / 2 + 31;
    const name = this._put(this.add.text(0, y, species.nlName, written(20)).setOrigin(0, 0.5));
    const count = this._put(this.add.text(0, y, `\u00d7 ${info.totalCount}`,
                                          written(19, info.totalCount > 0 ? COLOR.INK_RED : COLOR.INK_FADED))
      .setOrigin(0, 0.5));
    const gap = 9;
    // A long name ("Mediterrane horsmakreel") is written smaller, so that it
    // fits between the two pins.
    const fit = Math.min(1, TITLE_ROOM / (name.width + gap + count.width));
    name.setScale(fit);
    count.setScale(fit);
    name.x = cx - (name.displayWidth + gap * fit + count.displayWidth) / 2;
    count.x = name.x + name.displayWidth + gap * fit;

    // Centerpiece: the biggest specimen ever caught (any size). Helps the
    // player see "my best of this species". If never caught, its faint
    // shape hints at what is still out there.
    this._renderBestFish(cx, cy + 3, species, info);

    // Bottom strip: three small cells with the best cm per size.
    this._renderSizeStrip(cx, cy + CARD_H / 2 - 32, species, info);

    if (info.giant) this._renderGiantMarks(cx, cy);
  }

  /**
   * The card says its fish's name when tapped -- and lights up, so that it
   * is clear which one spoke. Not when the finger was scrolling, and not
   * where the card has scrolled away under the title.
   */
  _makeSayable(cx, cy, species) {
    const zone = this._put(this.add.zone(cx, cy, CARD_W, CARD_H));
    zone.setInteractive({ useHandCursor: true });
    zone.on('pointerup', (pointer) => {
      if (pointer.getDistance() > TAP_SLOP) return;
      if (this.showAll && pointer.worldY < BOOK_TOP) return;
      this.audio.playPhrase(`medium_${species.id}`);
      const flash = this._put(this.add.rectangle(cx, cy, CARD_W - 10, CARD_H - 10, 0xfff3c4, 0.5));
      flash.setBlendMode(Phaser.BlendModes.ADD);
      this.tweens.add({ targets: flash, alpha: 0, duration: 420, ease: 'Quad.easeOut', onComplete: () => flash.destroy() });
    });
  }

  /** What makes a giant's card glitter: glints, and a gold star. */
  _renderGiantMarks(cx, cy) {
    const glints = this._put(this.add.container(cx, cy + 3));
    addGlints(this, glints, { w: CARD_W - 70, h: CARD_H - 120, count: 7, size: 15 });
    addGlints(this, glints, {
      w: CARD_W - 40, h: CARD_H - 70, count: 6, size: 12,
      colors: [GIANT_AMBER, GIANT_GOLD], blend: Phaser.BlendModes.NORMAL,
    });

    const star = this._put(this.add.star(cx + CARD_W / 2 - 40, cy - CARD_H / 2 + 62, 5, 8, 18, GIANT_GOLD));
    star.setStrokeStyle(2.5, 0x3a1d06);
    star.setAngle(-12);
    this.tweens.add({
      targets: star,
      scale: { from: 0.9, to: 1.18 },
      angle: 12,
      duration: 800,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  /**
   * Renders the largest specimen the player has caught (across all sizes)
   * as the card centrepiece. Falls back to a faint shape when the species
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

    const fish = this._put(this.add.image(cx, cy, key));
    // Available footprint on the card for the fish image.
    const targetW = CARD_W - 64;
    const targetH = CARD_H - 112;
    fish.setScale(Math.min(targetW / fish.width, targetH / fish.height));

    if (bestSize === null) {
      fish.setTintFill(UNCAUGHT_TINT);
      fish.setAlpha(UNCAUGHT_ALPHA);
    }
  }

  /**
   * Three small cells at the foot of the card showing the best cm for
   * each size. Empty (uncaught) cells show a dim dash.
   */
  _renderSizeStrip(cx, cy, species, info) {
    const cellW = (CARD_W - 44) / 3;
    const cellH = 27;
    const startCellX = cx - CARD_W / 2 + 22 + cellW / 2;

    FISH_SIZES.forEach((size, i) => {
      const x = startCellX + i * cellW;
      const cm = info.speciesBest[size];
      const haveCount = info.speciesSizeCounts[size] || 0;
      const filled = typeof cm === 'number';
      // The length that made it a giant stands on gold.
      const giant = isGiant(species.id, cm);

      const box = this._put(this.add.graphics({ x, y: cy }));
      if (giant) box.fillStyle(GIANT_GOLD, 1);
      else box.fillStyle(CELL_COLOR, filled ? 0.5 : 0.22);
      box.fillRoundedRect(-(cellW - 5) / 2, -cellH / 2, cellW - 5, cellH, 8);
      if (giant) box.lineStyle(2.5, GIANT_GOLD_EDGE, 1);
      else box.lineStyle(1.5, CELL_EDGE, filled ? 0.7 : 0.35);
      box.strokeRoundedRect(-(cellW - 5) / 2, -cellH / 2, cellW - 5, cellH, 8);
      const label = filled
        ? `${cm} cm${haveCount > 1 ? ` \u00b7${haveCount}` : ''}`
        : '\u2014';
      this._put(this.add.text(x, cy, label, written(15, filled ? COLOR.INK : COLOR.INK_FADED))
        .setOrigin(0.5));
    });
  }
}
