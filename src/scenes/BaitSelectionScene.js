import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../constants.js';
import { SaveSystem } from '../systems/SaveSystem.js';
import { BAITS, baitFullTextureKey, DEFAULT_BAIT_ID } from '../data/baits.js';

/**
 * Modal-style scene that overlays the running FishingScene. Shows the five
 * baits as large cards, with the current selection highlighted. Tap a card
 * to set the new selection and return; tap outside (the scrim) to cancel.
 */
export class BaitSelectionScene extends Phaser.Scene {
  constructor() { super('BaitSelectionScene'); }

  create() {
    // Dim the underlying scene -- semi-transparent black scrim.
    const scrim = this.add.rectangle(
      GAME_WIDTH / 2, GAME_HEIGHT / 2,
      GAME_WIDTH, GAME_HEIGHT,
      0x000000, 0.55
    );
    scrim.setInteractive();
    scrim.on('pointerdown', () => this._close());

    // Panel behind the cards.
    const panelW = Math.round(GAME_WIDTH * 0.78);
    const panelH = Math.round(GAME_HEIGHT * 0.55);
    const panel = this.add.rectangle(
      GAME_WIDTH / 2, GAME_HEIGHT / 2,
      panelW, panelH,
      0x1c2530, 0.95
    );
    panel.setStrokeStyle(3, 0xffffff, 0.4);
    panel.setInteractive();   // swallow taps so they don't bubble to scrim

    const selectedId = SaveSystem.getSelectedBait() || DEFAULT_BAIT_ID;

    // Layout: single row of N cards, evenly spaced.
    const cardW = Math.floor((panelW - 60) / BAITS.length);
    const cardH = Math.round(panelH * 0.85);
    const startX = GAME_WIDTH / 2 - panelW / 2 + 30 + cardW / 2;
    const cardY = GAME_HEIGHT / 2;

    BAITS.forEach((bait, i) => {
      const x = startX + i * cardW;
      this._buildCard(bait, x, cardY, cardW - 12, cardH, bait.id === selectedId);
    });
  }

  _buildCard(bait, x, y, w, h, isSelected) {
    const c = this.add.container(x, y);
    c.setSize(w, h);
    c.setInteractive({ useHandCursor: true });

    // Card background. Highlight if selected.
    const cardBg = this.add.rectangle(0, 0, w, h, isSelected ? 0x2c5e2c : 0x2b3540);
    cardBg.setStrokeStyle(isSelected ? 4 : 2, isSelected ? 0xffd24a : 0xffffff, isSelected ? 1 : 0.4);

    // Bait sprite scaled to fit the card.
    const key = baitFullTextureKey(bait.id);
    const sprite = this.add.image(0, -8, key);
    const longest = Math.max(sprite.width, sprite.height);
    if (longest > 0) sprite.setScale((h * 0.78) / longest);

    // Name label at bottom.
    const label = this.add.text(0, h / 2 - 18, bait.nlName, {
      fontFamily: 'sans-serif',
      fontSize: '20px',
      fontStyle: 'bold',
      color: '#ffffff',
    });
    label.setOrigin(0.5);

    c.add([cardBg, sprite, label]);
    c.on('pointerdown', (_pointer, _x, _y, event) => {
      if (event && event.stopPropagation) event.stopPropagation();
      SaveSystem.setSelectedBait(bait.id);
      this._close();
    });

    return c;
  }

  _close() {
    this.scene.stop();
    this.scene.wake('FishingScene');
  }
}
