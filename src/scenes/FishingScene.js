import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT } from '../constants.js';
import { AudioManager, SFX } from '../systems/AudioManager.js';
import { SaveSystem } from '../systems/SaveSystem.js';
import { weightedPick } from '../data/fish.js';
import { TEX } from './BootScene.js';
import {
  createBobberPlaceholder,
  createFishPlaceholder,
  createCollectionButton,
} from '../placeholders.js';

// =============================================================================
// Tunable visual constants -- dial these in once the real assets are rendered.
// =============================================================================

/**
 * Fraction of canvas height occupied by the julian_dirk_fishing sprite.
 * The sprite is square, so this also determines its width.
 * 0.55 - 0.65 keeps Julian feeling natural against the backdrop.
 */
export const SPRITE_SCALE = 0.62;

/**
 * Where the player can click to cast. Right ~65% of the canvas matches the
 * water area in the painterly backdrop. Adjust if you swap backdrops.
 *
 * NOTE: this is a hit-test rectangle in canvas coords, NOT a render target.
 */
export const WATER_BOUNDS = Object.freeze({
  x: Math.round(GAME_WIDTH * 0.35),
  y: 0,
  width: Math.round(GAME_WIDTH * 0.65),
  height: GAME_HEIGHT,
});

/**
 * Rod-tip position relative to the sprite's TOP-LEFT, expressed in DISPLAYED
 * (post-scale) pixels. After first render, inspect the sprite on screen and
 * tweak these two numbers until the line emerges from Julian's rod tip.
 *
 * Defaults assume the sprite is "Julian on the left, Dirk on the right"
 * with the rod angled up and to the right -- rod tip roughly upper-right
 * of the sprite's bounding box.
 */
export const ROD_TIP_OFFSET_X = 360;
export const ROD_TIP_OFFSET_Y = 90;

// =============================================================================
// Internal constants -- gameplay, not layout.
// =============================================================================

// Bite cycle timing (ms).
const BITE_DELAY_MIN = 3000;
const BITE_DELAY_MAX = 15000;
const NIBBLE_MIN = 1000;
const NIBBLE_MAX = 2000;
const DIVE_MIN = 800;
const DIVE_MAX = 1500;

// Idle bob.
const BOB_AMPLITUDE = 4;
const BOB_PERIOD_MS = 1500;

// Cast arc.
const CAST_DURATION_MS = 600;
const CAST_ARC_HEIGHT = 220;

// Catch leap.
const CATCH_LEAP_MS = 1000;
const CATCH_DISPLAY_MS = 1500;

// Fishing line style.
const LINE_COLOR = 0x222222; // dark gray
const LINE_WIDTH = 2;

// State machine. Mirrors the spec phases.
const STATE = Object.freeze({
  READY: 'ready',
  CASTING: 'casting',
  IDLE: 'idle',
  NIBBLE: 'nibble',
  DIVE: 'dive',
  CATCHING: 'catching',
});

export class FishingScene extends Phaser.Scene {
  constructor() {
    super('FishingScene');
  }

  create() {
    this.audio = new AudioManager(this);
    this.state = STATE.READY;

    // Timers and tweens we may need to cancel mid-flight.
    this.biteTimer = null;
    this.phaseTimer = null;
    this.bobTween = null;
    this.nibbleTween = null;
    this.activeCastTween = null;

    this._buildBackdrop();
    this._buildSprite();
    this._buildBobber();
    this._buildCollectionButton();

    // Dynamic line from rod tip to bobber, redrawn each frame in update().
    this.lineGfx = this.add.graphics();
    this.lineGfx.setDepth(15);

    // Single global input handler -- state machine decides what to do.
    this.input.on('pointerdown', this._onPointerDown, this);

    // Coming back from the collection scene resets to ready-to-cast.
    this.events.on(Phaser.Scenes.Events.WAKE, () => this._enterReady());
  }

  update() {
    this.lineGfx.clear();
    if (this.bobber && this.state !== STATE.READY && this.state !== STATE.CATCHING) {
      this.lineGfx.lineStyle(LINE_WIDTH, LINE_COLOR, 0.95);
      this.lineGfx.beginPath();
      this.lineGfx.moveTo(this.rodTip.x, this.rodTip.y);
      this.lineGfx.lineTo(this.bobber.x, this.bobber.y);
      this.lineGfx.strokePath();
    }
  }

  // ---------------------------------------------------------------------------
  // Setup helpers
  // ---------------------------------------------------------------------------

  _buildBackdrop() {
    // Phaser cache may be empty if the file failed to load (first run before
    // the user has dropped backdrop.png in). Fall back to a flat color so the
    // canvas isn't pure black during setup.
    if (this.textures.exists(TEX.BACKDROP)) {
      const bg = this.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, TEX.BACKDROP);
      bg.setOrigin(0.5);
      // Cover mode: scale uniformly so the image fills the canvas, cropping
      // overflow on whichever axis has slack.
      const scale = Math.max(GAME_WIDTH / bg.width, GAME_HEIGHT / bg.height);
      bg.setScale(scale);
      bg.setDepth(0);
    } else {
      this.add.rectangle(
        GAME_WIDTH / 2, GAME_HEIGHT / 2,
        GAME_WIDTH, GAME_HEIGHT,
        0x205070
      ).setDepth(0);
    }

    // Transparent water-hit target. Bound to WATER_BOUNDS so taps on shore
    // are not interpreted as casts. Sits below the sprite/UI so those still
    // win pointer events.
    this.waterHit = this.add.rectangle(
      WATER_BOUNDS.x + WATER_BOUNDS.width / 2,
      WATER_BOUNDS.y + WATER_BOUNDS.height / 2,
      WATER_BOUNDS.width,
      WATER_BOUNDS.height,
      0x000000,
      0
    );
    this.waterHit.setDepth(1);
    this.waterHit.setInteractive();
  }

  _buildSprite() {
    const displayHeight = GAME_HEIGHT * SPRITE_SCALE;
    const displayWidth = displayHeight; // sprite is square

    if (this.textures.exists(TEX.JULIAN_DIRK_FISHING)) {
      this.julianSprite = this.add.image(0, GAME_HEIGHT, TEX.JULIAN_DIRK_FISHING);
      this.julianSprite.setOrigin(0, 1); // bottom-left anchor
      this.julianSprite.setDisplaySize(displayWidth, displayHeight);
    } else {
      // Visible placeholder so layout work continues until the file lands.
      this.julianSprite = this.add.rectangle(
        0, GAME_HEIGHT,
        displayWidth, displayHeight,
        0x888888, 0.4
      );
      this.julianSprite.setOrigin(0, 1);
      this.julianSprite.setStrokeStyle(2, 0xffffff, 0.6);
    }
    this.julianSprite.setDepth(10);

    // Sprite top-left in world coords -- ROD_TIP_OFFSET is measured from here.
    const spriteTopLeftX = 0;
    const spriteTopLeftY = GAME_HEIGHT - displayHeight;

    this.rodTip = new Phaser.Math.Vector2(
      spriteTopLeftX + ROD_TIP_OFFSET_X,
      spriteTopLeftY + ROD_TIP_OFFSET_Y
    );
  }

  _buildBobber() {
    // Bobber sits at rod tip until first cast, then gets hidden.
    this.bobber = createBobberPlaceholder(this, this.rodTip.x, this.rodTip.y);
    this.bobber.setVisible(false);
    this.bobberHomeY = 0;
  }

  _buildCollectionButton() {
    const button = createCollectionButton(this, GAME_WIDTH - 60, 60);
    button.on('pointerdown', (pointer, _x, _y, event) => {
      // Don't let the click also count as a cast.
      if (event && event.stopPropagation) event.stopPropagation();
      this._cancelAllPhaseLogic();
      this.scene.sleep();
      this.scene.run('FishingCollectionScene');
    });
  }

  // ---------------------------------------------------------------------------
  // Input handling
  // ---------------------------------------------------------------------------

  _onPointerDown(pointer) {
    const { x, y } = pointer;

    switch (this.state) {
      case STATE.READY:
        if (this._isInsideWater(x, y)) this._beginCast(x, y);
        break;

      case STATE.CASTING:
        // Ignore -- bobber already in flight.
        break;

      case STATE.IDLE:
        // Click outside a bite phase pulls the line in so we can re-cast.
        // For a 4-year-old this is more forgiving than "ignored".
        this._enterReady();
        break;

      case STATE.NIBBLE:
        this._missBite();
        break;

      case STATE.DIVE:
        this._catchFish();
        break;

      case STATE.CATCHING:
        // Animation in progress -- ignore.
        break;
    }
  }

  _isInsideWater(x, y) {
    return (
      x >= WATER_BOUNDS.x &&
      x <= WATER_BOUNDS.x + WATER_BOUNDS.width &&
      y >= WATER_BOUNDS.y &&
      y <= WATER_BOUNDS.y + WATER_BOUNDS.height
    );
  }

  // ---------------------------------------------------------------------------
  // State transitions
  // ---------------------------------------------------------------------------

  _enterReady() {
    this._cancelAllPhaseLogic();
    this.state = STATE.READY;
    this.bobber.setVisible(false);
    this.bobber.setScale(1);
    this.bobber.setAlpha(1);
    this.bobber.x = this.rodTip.x;
    this.bobber.y = this.rodTip.y;
  }

  _beginCast(targetX, targetY) {
    this.state = STATE.CASTING;
    this.audio.playSfx(SFX.CAST);

    this.bobber.setVisible(true);
    this.bobber.setScale(1);
    this.bobber.setAlpha(1);
    this.bobber.x = this.rodTip.x;
    this.bobber.y = this.rodTip.y;

    const startX = this.rodTip.x;
    const startY = this.rodTip.y;
    const midX = (startX + targetX) / 2;
    const peakY = Math.min(startY, targetY) - CAST_ARC_HEIGHT;

    // Quadratic-bezier arc via a t-driven tween.
    const progress = { t: 0 };
    this.activeCastTween = this.tweens.add({
      targets: progress,
      t: 1,
      duration: CAST_DURATION_MS,
      ease: 'Sine.easeOut',
      onUpdate: () => {
        const t = progress.t;
        const inv = 1 - t;
        const x = inv * inv * startX + 2 * inv * t * midX + t * t * targetX;
        const y = inv * inv * startY + 2 * inv * t * peakY + t * t * targetY;
        this.bobber.x = x;
        this.bobber.y = y;
      },
      onComplete: () => {
        this.activeCastTween = null;
        this._enterIdle(targetX, targetY);
      },
    });
  }

  _enterIdle(x, y) {
    this.state = STATE.IDLE;
    this.audio.playSfx(SFX.SPLASH);

    this.bobber.x = x;
    this.bobber.y = y;
    this.bobberHomeY = y;

    this.bobTween = this.tweens.add({
      targets: this.bobber,
      y: y - BOB_AMPLITUDE,
      duration: BOB_PERIOD_MS / 2,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    const delay = Phaser.Math.Between(BITE_DELAY_MIN, BITE_DELAY_MAX);
    this.biteTimer = this.time.delayedCall(delay, () => this._enterNibble());
  }

  _enterNibble() {
    if (this.state !== STATE.IDLE) return;
    this.state = STATE.NIBBLE;
    this.audio.playSfx(SFX.NIBBLE);

    this._stopBobTween();

    const baseX = this.bobber.x;
    this.nibbleTween = this.tweens.add({
      targets: this.bobber,
      x: { from: baseX - 3, to: baseX + 3 },
      duration: 60,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    const duration = Phaser.Math.Between(NIBBLE_MIN, NIBBLE_MAX);
    this.phaseTimer = this.time.delayedCall(duration, () => this._enterDive(baseX));
  }

  _enterDive(restX) {
    if (this.state !== STATE.NIBBLE) return;
    this.state = STATE.DIVE;
    this.audio.playSfx(SFX.DIVE);

    if (this.nibbleTween) {
      this.nibbleTween.stop();
      this.nibbleTween = null;
    }
    this.bobber.x = restX;

    this.tweens.add({
      targets: this.bobber,
      y: this.bobberHomeY + 30,
      alpha: 0.35,
      scale: 0.85,
      duration: 220,
      ease: 'Sine.easeIn',
    });

    const duration = Phaser.Math.Between(DIVE_MIN, DIVE_MAX);
    this.phaseTimer = this.time.delayedCall(duration, () => {
      if (this.state !== STATE.DIVE) return;
      this._resurfaceAndIdle();
    });
  }

  _resurfaceAndIdle() {
    this.tweens.add({
      targets: this.bobber,
      y: this.bobberHomeY,
      alpha: 1,
      scale: 1,
      duration: 220,
      ease: 'Sine.easeOut',
      onComplete: () => {
        if (this.state !== STATE.DIVE) return;
        this._enterIdle(this.bobber.x, this.bobberHomeY);
      },
    });
  }

  // ---------------------------------------------------------------------------
  // Outcomes
  // ---------------------------------------------------------------------------

  _missBite() {
    this.audio.playSfx(SFX.MISS);
    this._stopPhaseTimer();
    if (this.nibbleTween) {
      this.nibbleTween.stop();
      this.nibbleTween = null;
    }
    this.tweens.add({
      targets: this.bobber,
      alpha: 0.4,
      duration: 120,
      yoyo: true,
      onComplete: () => {
        this.bobber.alpha = 1;
        this._enterReady();
      },
    });
  }

  _catchFish() {
    this.state = STATE.CATCHING;
    this._stopPhaseTimer();
    this._stopBobTween();
    this.audio.playSfx(SFX.CATCH);

    const fish = weightedPick();
    SaveSystem.incrementFishCount(fish.id);

    const startX = this.bobber.x;
    const startY = this.bobber.y;
    const endX = GAME_WIDTH / 2;
    const endY = GAME_HEIGHT / 2;
    const peakY = Math.min(startY, endY) - 180;

    const fishSprite = createFishPlaceholder(this, fish, startX, startY);
    fishSprite.setDepth(30);
    fishSprite.setScale(0.4);

    const progress = { t: 0 };
    this.tweens.add({
      targets: progress,
      t: 1,
      duration: CATCH_LEAP_MS,
      ease: 'Sine.easeInOut',
      onUpdate: () => {
        const t = progress.t;
        const inv = 1 - t;
        const x = inv * inv * startX + 2 * inv * t * ((startX + endX) / 2) + t * t * endX;
        const y = inv * inv * startY + 2 * inv * t * peakY + t * t * endY;
        this.bobber.x = x;
        this.bobber.y = y;
        fishSprite.x = x;
        fishSprite.y = y;
        fishSprite.setScale(0.4 + 0.6 * t);
      },
      onComplete: () => {
        this.bobber.setVisible(false);
        this.tweens.add({
          targets: fishSprite,
          angle: { from: -8, to: 8 },
          duration: 200,
          yoyo: true,
          repeat: 3,
        });
        this.time.delayedCall(CATCH_DISPLAY_MS, () => {
          fishSprite.destroy();
          this._enterReady();
        });
      },
    });
  }

  // ---------------------------------------------------------------------------
  // Cleanup helpers
  // ---------------------------------------------------------------------------

  _stopBobTween() {
    if (this.bobTween) {
      this.bobTween.stop();
      this.bobTween = null;
    }
  }

  _stopPhaseTimer() {
    if (this.phaseTimer) {
      this.phaseTimer.remove(false);
      this.phaseTimer = null;
    }
    if (this.biteTimer) {
      this.biteTimer.remove(false);
      this.biteTimer = null;
    }
  }

  _cancelAllPhaseLogic() {
    this._stopPhaseTimer();
    this._stopBobTween();
    if (this.nibbleTween) {
      this.nibbleTween.stop();
      this.nibbleTween = null;
    }
    if (this.activeCastTween) {
      this.activeCastTween.stop();
      this.activeCastTween = null;
    }
  }
}
