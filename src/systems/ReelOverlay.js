import Phaser from 'phaser';
import { TEX } from '../scenes/BootScene.js';

/**
 * ReelOverlay -- visual "fishing reel" widget that appears when a strong
 * fish is hooked. The player drags the loose handle around the reel's
 * centre; cumulative angular movement (in EITHER direction) counts as
 * "reeling in". When the configured number of full turns has been
 * accumulated the onComplete callback fires.
 *
 * Glow + slight pulse behind the reel suggests "interact with me!".
 *
 * Usage:
 *   const reel = new ReelOverlay(scene, {
 *     x, y,                  // canvas centre of the reel
 *     requiredTurns: 3,      // how many full 360° rotations to "land" the fish
 *     onComplete: () => ...
 *   });
 *   // When you want to cancel early:
 *   reel.destroy();
 */
export class ReelOverlay {
  constructor(scene, { x, y, requiredTurns = 3, onComplete = null }) {
    this.scene = scene;
    this.x = x;
    this.y = y;
    this.requiredTurns = requiredTurns;
    this.onComplete = onComplete;
    // Total accumulated absolute angular delta (radians). Drains slowly
    // when not dragging so the player has to stay engaged.
    this.accumulatedRadians = 0;
    this.requiredRadians = requiredTurns * Math.PI * 2;
    this.isDragging = false;
    this._lastPointerAngle = null;
    this._destroyed = false;

    this._build();
    this._attachInputs();
  }

  _build() {
    const { scene, x, y } = this;

    // Glow: stacked soft circles in ADD blend mode for a warm bloom feel.
    // Pulsed via tween (alpha + scale) so it visibly invites interaction.
    this.glowOuter = scene.add.circle(x, y, 140, 0xffd24a, 0.18);
    this.glowOuter.setBlendMode(Phaser.BlendModes.ADD);
    this.glowOuter.setDepth(40);

    this.glowInner = scene.add.circle(x, y, 100, 0xffeaa0, 0.30);
    this.glowInner.setBlendMode(Phaser.BlendModes.ADD);
    this.glowInner.setDepth(40);

    this.glowTween = scene.tweens.add({
      targets: [this.glowOuter, this.glowInner],
      alpha: { from: 0.18, to: 0.45 },
      scale: { from: 1.0, to: 1.18 },
      duration: 800,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    // Reel body. Target ~140px tall on canvas.
    this.reel = scene.add.image(x, y, TEX.REEL);
    const targetReelH = 140;
    this.reelScale = targetReelH / this.reel.height;
    this.reel.setScale(this.reelScale);
    this.reel.setDepth(42);

    // The crank handle pivots on the reel's visible axis, NOT on the reel
    // centre. In reel.png the axis (small protrusion on the housing) sits
    // about 23% right of centre, roughly vertically centered. Storing this
    // pivot lets the pointer angle calculation use the right origin.
    this.pivotX = x + this.reel.displayWidth * 0.23;
    this.pivotY = y;

    // Handle. Its own origin is set close to its mount-hole on the LEFT
    // (0.12) so that when we place it at the pivot it visually attaches.
    this.handle = scene.add.image(this.pivotX, this.pivotY, TEX.REEL_HANDLE);
    this.handle.setOrigin(0.12, 0.5);
    // Scale handle so total displayed width ~ 70% of reel display width --
    // long enough to clearly project past the housing.
    const targetHandleW = this.reel.displayWidth * 0.70;
    this.handleScale = targetHandleW / this.handle.width;
    this.handle.setScale(this.handleScale);
    this.handle.setDepth(43);

    // Huge hit zone that fully covers the visible reel housing plus a
    // 25% margin. Anchored on the REEL centre (not the pivot offset) so
    // every visible pixel of the reel is interactive. A 4-year-old can
    // tap anywhere on/around the reel to start cranking.
    const zoneW = this.reel.displayWidth  * 1.25;
    const zoneH = this.reel.displayHeight * 1.25;
    this.hitZone = scene.add.zone(x, y, zoneW, zoneH);
    this.hitZone.setInteractive({ useHandCursor: true });
    this.hitZone.setDepth(44);   // above reel + handle so pointerdown lands here

    // Optional progress ring overlay (debug/visual feedback).
    // Drawn as an arc on a Graphics object underneath the reel.
    this.progressGfx = scene.add.graphics();
    this.progressGfx.setDepth(41);
    this._redrawProgress();
  }

  _attachInputs() {
    // Capture handlers as bound fns so we can detach them on destroy.
    this._onHandleDown = (pointer) => {
      if (this._destroyed) return;
      this.isDragging = true;
      this._lastPointerAngle = Math.atan2(pointer.y - this.pivotY, pointer.x - this.pivotX);
      // Snap handle to current pointer angle so it feels responsive.
      this.handle.rotation = this._lastPointerAngle;
      // Begin the looping reel-click sound while the player cranks.
      this.scene.audio?.startReelLoop();
    };
    this._onPointerUp = () => {
      this.isDragging = false;
      this._lastPointerAngle = null;
      this.scene.audio?.stopReelLoop();
    };
    this._onPointerMove = (pointer) => {
      if (this._destroyed || !this.isDragging) return;
      const ang = Math.atan2(pointer.y - this.pivotY, pointer.x - this.pivotX);
      if (this._lastPointerAngle !== null) {
        let delta = ang - this._lastPointerAngle;
        // Wrap into [-PI, PI] so a wrap-around at the angle seam doesn't
        // count as a huge spin.
        if (delta > Math.PI) delta -= 2 * Math.PI;
        if (delta < -Math.PI) delta += 2 * Math.PI;
        this.accumulatedRadians += Math.abs(delta);
      }
      this._lastPointerAngle = ang;
      this.handle.rotation = ang;
      this._redrawProgress();
      if (this.accumulatedRadians >= this.requiredRadians) this._complete();
    };

    // Pointerdown on the wide hit zone -- starts dragging anywhere on/near
    // the reel without requiring the player to grab the handle precisely.
    this.hitZone.on('pointerdown', this._onHandleDown);
    this.scene.input.on('pointerup', this._onPointerUp);
    this.scene.input.on('pointermove', this._onPointerMove);

    // Decay: drain ~12% of required progress per second while not dragging.
    // Keeps the player engaged without being punishing.
    this._decayEvent = this.scene.time.addEvent({
      delay: 100,
      loop: true,
      callback: () => {
        if (this._destroyed || this.isDragging) return;
        const drainPerTick = this.requiredRadians * 0.012;
        if (this.accumulatedRadians > 0) {
          this.accumulatedRadians = Math.max(0, this.accumulatedRadians - drainPerTick);
          this._redrawProgress();
        }
      },
    });
  }

  _redrawProgress() {
    if (!this.progressGfx) return;
    this.progressGfx.clear();
    const fraction = Math.min(1, this.accumulatedRadians / this.requiredRadians);
    if (fraction <= 0) return;
    // Yellow arc growing clockwise from -90deg (top).
    const radius = 80;
    const start = -Math.PI / 2;
    const end = start + fraction * Math.PI * 2;
    this.progressGfx.lineStyle(8, 0x66ff77, 0.85);
    this.progressGfx.beginPath();
    this.progressGfx.arc(this.x, this.y, radius, start, end, false);
    this.progressGfx.strokePath();
  }

  _complete() {
    if (this._destroyed) return;
    const cb = this.onComplete;
    this.destroy();
    if (cb) cb();
  }

  destroy() {
    if (this._destroyed) return;
    this._destroyed = true;
    if (this.glowTween) this.glowTween.stop();
    if (this._decayEvent) this._decayEvent.remove(false);
    if (this.hitZone) this.hitZone.off('pointerdown', this._onHandleDown);
    this.scene.input.off('pointerup', this._onPointerUp);
    this.scene.input.off('pointermove', this._onPointerMove);
    // Belt + suspenders: ensure the reel loop stops even if the player
    // never released their finger (e.g. catch completes mid-drag).
    this.scene.audio?.stopReelLoop();
    [this.glowOuter, this.glowInner, this.reel, this.handle, this.hitZone, this.progressGfx]
      .filter(Boolean)
      .forEach((obj) => obj.destroy());
  }
}
