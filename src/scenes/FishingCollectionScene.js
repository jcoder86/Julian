import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../constants.js';
// Phaser is bundled via vite; ensure side-effect import for BlendModes etc.
import { FISH_SPECIES, FISH_SIZES, fishTextureKey, speciesNlName } from '../data/fish.js';
import { SaveSystem } from '../systems/SaveSystem.js';
import { TEX } from './BootScene.js';

/**
 * Trophy collection: a grid of cards, one per species. Each card shows the
 * largest cm landed for each size (or a faded silhouette if never caught),
 * the species' Dutch name, and a total catch count badge. The species of
 * the most recent catch gets a yellow halo so the player can see "what
 * I just caught" at a glance.
 *
 * The layout is fixed at 11 cards (one per species), so the screen never
 * grows even with thousands of catches -- the trophy values just go up.
 */

const BG_TOP_COLOR    = 0x0d1f33;
const BG_BOTTOM_COLOR = 0x1a3b5c;
const CARD_BG_COLOR   = 0x182a40;
const CARD_BORDER     = 0x3a557a;
const HIGHLIGHT_COLOR = 0xffd24a;   // last-catch halo

// 4 columns x 3 rows = 12 cells (11 used). Cells are 280×190 with 14px gap.
const COLS = 4;
const ROWS = 3;
const CARD_W = 280;
const CARD_H = 190;
const CARD_GAP = 14;
const TITLE_BAR_H = 92;

export class FishingCollectionScene extends Phaser.Scene {
  constructor() {
    super('FishingCollectionScene');
  }

  create() {
    // Hide the FishingScene's DOM video backdrop so it doesn't leak through
    // the canvas letterbox bars. Same trick as CatchDisplayScene.
    this._hiddenVideoEl = document.querySelector('video');
    if (this._hiddenVideoEl) this._hiddenVideoEl.style.display = 'none';
    document.body.style.backgroundColor = '#0d1f33';

    // Background: vertical gradient via two stacked rectangles.
    this._buildBackground();

    // Title.
    this.add.text(
      GAME_WIDTH / 2, 46,
      "Julian's vangst",
      {
        fontFamily: 'sans-serif',
        fontSize: '44px',
        fontStyle: 'bold',
        color: '#ffd24a',
        stroke: '#000000',
        strokeThickness: 5,
      },
    ).setOrigin(0.5).setDepth(10);

    // Back button -- top-left. Same green play.png sprite + same pulsing
    // rounded-rect halo behind it as the catch-screen continue button.
    const BACK_DISPLAY = 75;
    const backX = BACK_DISPLAY / 2 + 18;
    const backY = BACK_DISPLAY / 2 + 18;

    const halo = this.add.graphics();
    const HALO_PAD    = 4;     // tight against the button edge
    const HALO_RADIUS = 14;
    const haloW = BACK_DISPLAY + HALO_PAD * 2;
    const haloH = BACK_DISPLAY + HALO_PAD * 2;
    halo.fillStyle(0x4ecd5a, 1);
    halo.fillRoundedRect(-haloW / 2, -haloH / 2, haloW, haloH, HALO_RADIUS);
    halo.setBlendMode(Phaser.BlendModes.ADD);
    halo.setPosition(backX, backY);
    halo.setDepth(9);
    this.tweens.add({
      targets: halo,
      alpha: { from: 0.15, to: 0.55 },
      scale: { from: 1.0,  to: 1.07 },
      duration: 1100, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
    });

    const back = this.add.image(backX, backY, TEX.PLAY);
    back.setScale(BACK_DISPLAY / Math.max(back.width, back.height));
    back.setDepth(10);
    back.setInteractive({ useHandCursor: true });
    back.on('pointerdown', () => this._close());

    this._buildCards();

    // ESC to close (desktop debugging).
    this.input.keyboard?.on('keydown-ESC', () => this._close());
  }

  _close() {
    if (this._hiddenVideoEl) this._hiddenVideoEl.style.display = '';
    document.body.style.backgroundColor = '';
    this.scene.stop();
    this.scene.wake('FishingScene');
  }

  _buildBackground() {
    // Solid bottom half then a lighter top half evokes "trophy hall".
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2,
                       GAME_WIDTH, GAME_HEIGHT, BG_BOTTOM_COLOR).setDepth(0);
    const topBand = this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT * 0.25,
                                       GAME_WIDTH, GAME_HEIGHT * 0.5, BG_TOP_COLOR);
    topBand.setDepth(0);
    topBand.setAlpha(0.6);
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

    FISH_SPECIES.forEach((species, idx) => {
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
    // Yellow halo for the most recently caught species. Drawn UNDER the card
    // so the highlight glows around its edges.
    if (info.isLast) {
      const halo = this.add.rectangle(cx, cy, CARD_W + 16, CARD_H + 16,
                                      HIGHLIGHT_COLOR, 0.35);
      halo.setStrokeStyle(4, HIGHLIGHT_COLOR, 0.9);
      halo.setDepth(1);
      // Subtle pulse so the eye is drawn.
      this.tweens.add({
        targets: halo,
        alpha:   { from: 0.35, to: 0.7 },
        duration: 900,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    }

    // Card panel.
    const card = this.add.rectangle(cx, cy, CARD_W, CARD_H, CARD_BG_COLOR, 0.95);
    card.setStrokeStyle(2, CARD_BORDER, 1);
    card.setDepth(2);

    // Species name (top-left of card).
    this.add.text(cx - CARD_W / 2 + 14, cy - CARD_H / 2 + 10,
      species.nlName, {
        fontFamily: 'sans-serif',
        fontSize: '22px',
        fontStyle: 'bold',
        color: '#ffffff',
      }).setDepth(3);

    // Total-caught badge (top-right of card). 0 = grayed.
    const countColor = info.totalCount > 0 ? '#ffd24a' : '#5a6a80';
    this.add.text(cx + CARD_W / 2 - 14, cy - CARD_H / 2 + 12,
      `× ${info.totalCount}`, {
        fontFamily: 'sans-serif',
        fontSize: '20px',
        fontStyle: 'bold',
        color: countColor,
      }).setOrigin(1, 0).setDepth(3);

    // Centerpiece: the biggest specimen ever caught (any size). Helps the
    // player see "my best of this species". If never caught, a grey
    // silhouette of the medium-size sprite hints at what's possible.
    this._renderBestFish(cx, cy + 2, species, info);

    // Bottom strip: three small size cells with best-cm-per-size.
    this._renderSizeStrip(cx, cy + CARD_H / 2 - 22, species, info);
  }

  /**
   * Renders the largest specimen the player has caught (across all sizes)
   * as the card centrepiece. Falls back to a translucent silhouette when
   * the species has never been caught.
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
    // Available footprint inside the card for the fish image.
    const targetW = CARD_W - 32;
    const targetH = CARD_H - 110;
    const scale = Math.min(targetW / fish.width, targetH / fish.height);
    fish.setScale(scale);
    fish.setDepth(3);

    if (bestSize === null) {
      // Silhouette: dark tint + low alpha so player can still see species shape.
      fish.setTint(0x223040);
      fish.setAlpha(0.45);
    }
  }

  /**
   * Three small cells under the card showing the best cm for each size.
   * Empty (uncaught) cells render as a dim "—" placeholder.
   */
  _renderSizeStrip(cx, cy, species, info) {
    const cellW = (CARD_W - 24) / 3;
    const startCellX = cx - CARD_W / 2 + 12 + cellW / 2;

    FISH_SIZES.forEach((size, i) => {
      const x = startCellX + i * cellW;
      const cm = info.speciesBest[size];
      const haveCount = info.speciesSizeCounts[size] || 0;

      // Background pill.
      const filled = typeof cm === 'number';
      const pill = this.add.rectangle(x, cy, cellW - 6, 30,
                                      filled ? 0x2a4060 : 0x222d3c, 0.85);
      pill.setStrokeStyle(1, filled ? HIGHLIGHT_COLOR : 0x3a4a5c, filled ? 1 : 0.7);
      pill.setDepth(3);

      const label = filled
        ? `${cm} cm${haveCount > 1 ? ` ·${haveCount}` : ''}`
        : '—';
      this.add.text(x, cy, label, {
        fontFamily: 'sans-serif',
        fontSize: '16px',
        fontStyle: filled ? 'bold' : 'normal',
        color: filled ? '#ffffff' : '#677787',
      }).setOrigin(0.5).setDepth(4);
    });
  }
}
