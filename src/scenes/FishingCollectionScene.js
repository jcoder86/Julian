import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../constants.js';
import { FISH } from '../data/fish.js';
import { SaveSystem } from '../systems/SaveSystem.js';
import {
  createFishPlaceholder,
  createFishSilhouette,
  createBackButton,
} from '../placeholders.js';

const BG_COLOR = 0x10243d;
const CARD_BG_COLOR = 0xf5f5f5;
const CARD_SHADOW_COLOR = 0x000000;
const COUNT_COLOR = '#222222';

// Layout: 5 cards across, evenly spaced. With CARD_W=200 and CARD_GAP=30 on
// a 1280px canvas the row fits comfortably without needing a second row.
const CARD_W = 200;
const CARD_H = 240;
const CARD_GAP = 30;

export class FishingCollectionScene extends Phaser.Scene {
  constructor() {
    super('FishingCollectionScene');
  }

  create() {
    this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, BG_COLOR);

    // Back button -- returns to the fishing scene.
    const back = createBackButton(this, 70, 70);
    back.on('pointerdown', () => {
      this.scene.stop();
      this.scene.wake('FishingScene');
    });

    this._buildCards();

    // Keyboard escape as a bonus for desktop users.
    this.input.keyboard?.on('keydown-ESC', () => {
      this.scene.stop();
      this.scene.wake('FishingScene');
    });
  }

  _buildCards() {
    const counts = SaveSystem.getFishCounts();

    const totalWidth = FISH.length * CARD_W + (FISH.length - 1) * CARD_GAP;
    const startX = (GAME_WIDTH - totalWidth) / 2 + CARD_W / 2;
    const y = GAME_HEIGHT / 2;

    FISH.forEach((fish, i) => {
      const x = startX + i * (CARD_W + CARD_GAP);
      const count = counts[fish.id] || 0;
      this._buildCard(x, y, fish, count);
    });
  }

  _buildCard(x, y, fish, count) {
    // Soft drop-shadow behind the card.
    const shadow = this.add.rectangle(x + 4, y + 4, CARD_W, CARD_H, CARD_SHADOW_COLOR, 0.25);
    shadow.setOrigin(0.5);

    const card = this.add.rectangle(x, y, CARD_W, CARD_H, CARD_BG_COLOR);
    card.setStrokeStyle(3, 0x222222, 0.4);

    // Reserve top section for the fish art, bottom for the count.
    const artY = y - 20;

    if (count > 0) {
      const art = createFishPlaceholder(this, fish, x, artY);
      // Scale down if the fish placeholder is taller than the card art slot.
      const fitScale = Math.min(1, (CARD_W - 40) / (fish.size + 20));
      art.setScale(fitScale);

      // Caught count -- the only on-screen "text" is a small number,
      // which is explicitly allowed by the spec (0-9 are fine).
      this.add.text(x, y + CARD_H / 2 - 36, String(count), {
        fontFamily: 'sans-serif',
        fontSize: '40px',
        fontStyle: 'bold',
        color: COUNT_COLOR,
      }).setOrigin(0.5);
    } else {
      const art = createFishSilhouette(this, fish, x, artY);
      const fitScale = Math.min(1, (CARD_W - 40) / (fish.size + 20));
      art.setScale(fitScale);
      // No count for uncaught -- pure silhouette.
    }
  }
}
