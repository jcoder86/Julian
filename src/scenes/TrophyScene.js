import Phaser from 'phaser';
import { WORLD_WIDTH, WORLD_HEIGHT, WORLD_LEFT, WORLD_TOP } from '../constants.js';
import { bindLayout } from '../systems/Layout.js';
import { TEX } from './BootScene.js';
import { fishTextureKey, isGiant, speciesNlName, weightKg } from '../data/fish.js';
import { AudioManager, SFX } from '../systems/AudioManager.js';
import { getMap } from '../data/maps.js';
import { getTeam } from '../data/teams.js';
import { SaveSystem } from '../systems/SaveSystem.js';
import { UI, COLOR, lettering, addGlow, addRays, addGlints, addPlate, pressable } from '../systems/Ui.js';

/**
 * The weighing station of the big ocean -- what a catch there gets instead
 * of the catch screen.
 *
 * At sunset, at the end of the harbour's dock: the fish hangs by its tail
 * from a big brass scale, head down, and the children stand beside it at
 * their REAL height (data/teams.js `trophy`), so that a white shark towers
 * over them and a dorado comes up to their nose. A measuring tape runs up
 * beside the fish, metre by metre. The fish drops onto the hook with a clank
 * of the chain, the needle swings round to its weight, the camera flashes,
 * confetti; for a giant: "Wereldrecord!". Then the voice, as everywhere.
 * The green button goes back to the boat.
 *
 * The pieces (scale, figures, where their dial and heads are) are cut by
 * scripts/make_trophy.py; the painting is assets/clean/weigh-ocean.jpg.
 *
 *   this.scene.run('TrophyScene', { species, size, lengthCm, mapId });
 */

export const TROPHY = Object.freeze({
  BG: 'weigh-ocean',
  SCALE: 'ui-scale-weigh',
  META: 'trophy-meta',
});
export function trophyFigureKey(who) {
  return `trophy-${who}`;
}

// Everything stands on the dock in one block, its own coordinates: the
// dock at y = 0, up is negative. From the dock to the top of the scale's
// ring it is STAGE_H; under the dock there is room for the name plate.
const STAGE_H = 860;
const BELOW = 120;
const SCALE_H = 300;                // the scale, ring to hook
const FISH_X = 120;                 // where the fish hangs
const HEAD_GAP = 22;                // between its head and the dock
const MIN_CHAIN = 26;               // between the hook and its tail
// The fish fills at most the room under the scale; the tallest child is
// never drawn taller than this share of it.
const KID_SHARE = 0.92;
const FIGURE_GAP = 26;              // between the fish and the first child, and between children
const TAPE_GAP = 30;                // between the fish and the measuring tape
const TAPE_W = 20;
// Beside a fish of many metres the children are only a few px tall: then a
// magnifying glass beside them shows them big (the tallest this tall),
// with a line to where they really stand.
const LENS_FROM_PX = 70;
const LENS_R = 125;
const LENS_KID_PX = 160;
// The dial: from 0 at the bottom left, clockwise round to its top value at
// the bottom right.
const DIAL_FROM = Math.PI * 0.75;
const DIAL_SWEEP = Math.PI * 1.5;
const DIAL_TOPS = [10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000, 50000];
// Timing (ms): the fish drops onto the hook; the needle swings; the flash.
const DROP_MS = 750;
const NEEDLE_MS = 1500;
const FLASH_AT = DROP_MS + NEEDLE_MS + 150;
const WORLD_RECORD = 'Wereldrecord!';
const CONFETTI = [0xffd23c, 0xff5a5a, 0x4ec3ff, 0x7dff8a, 0xff9de2, 0xffffff];
// The green "go on fishing" button, as on the catch screen.
const PLAY_BTN_SIZE = 210;
const PLAY_BTN_MARGIN = 30;

/** "4,8 m" or "85 cm" */
function lengthText(cm) {
  if (cm < 100) return `${Math.round(cm)} cm`;
  return `${(cm / 100).toFixed(1).replace('.', ',')} m`;
}
/** "1.240 kg", "312 kg", "12,4 kg" */
function weightText(kg) {
  if (kg >= 100) return `${Math.round(kg).toLocaleString('nl-NL')} kg`;
  return `${kg.toFixed(1).replace('.', ',')} kg`;
}

export class TrophyScene extends Phaser.Scene {
  constructor() { super('TrophyScene'); }

  init(data) {
    this.catchData = data || {};
    this._closed = false;
    this._hiddenVideoEl = null;
    this._stage = null;
    this._stageBox = null;
    this._playGroup = null;
  }

  create() {
    // The painting covers the screen: the boat's video behind the canvas
    // need not play meanwhile.
    this._hiddenVideoEl = document.querySelector('video');
    if (this._hiddenVideoEl) this._hiddenVideoEl.style.display = 'none';

    const worldCx = WORLD_LEFT + WORLD_WIDTH / 2;
    const worldCy = WORLD_TOP + WORLD_HEIGHT / 2;
    if (this.textures.exists(TROPHY.BG)) {
      this.add.image(worldCx, worldCy, TROPHY.BG).setDisplaySize(WORLD_WIDTH, WORLD_HEIGHT);
    } else {
      this.add.rectangle(worldCx, worldCy, WORLD_WIDTH, WORLD_HEIGHT, 0x6a3a1a);
    }

    const { species, size, lengthCm } = this.catchData;
    const map = getMap(this.catchData.mapId);
    this.audio = new AudioManager(this);
    this.giant = isGiant(species, lengthCm);
    this.kg = weightKg(species, lengthCm) ?? 0;

    this._buildStage(species, size, lengthCm);

    // The sounds: the chain takes the weight; the flash and the applause;
    // then the voice.
    this.time.delayedCall(DROP_MS * 0.8, () => this.audio.playSfx(SFX.CHAIN));
    this.time.delayedCall(FLASH_AT, () => {
      this.audio.playSfx(SFX.SHUTTER);
      this.cameras.main.flash(500, 255, 255, 255);
      this.audio.playSfx(SFX.APPLAUSE);
      this._confetti();
      if (this.giant) this._worldRecord();
    });
    this.time.delayedCall(FLASH_AT + 700, () => {
      if (species && size) {
        this.audio.playVoice(species, size, { giant: this.giant, volume: map.voiceVolume ?? 1 });
      }
    });

    // (On a wide screen the bottom of the painting shows: the dock the
    // children stand on. The beam at the top may go.)
    bindLayout(this, { alignY: 1 }, (layout) => this._applyLayout(layout));
    this.time.delayedCall(FLASH_AT + 1200, () => {
      if (!this._closed) this._buildPlayButton();
    });
  }

  // ---------------------------------------------------------------------------
  // The block on the dock: scale, fish, tape, children, name plate
  // ---------------------------------------------------------------------------

  _buildStage(species, size, lengthCm) {
    const stage = this.add.container(0, 0).setDepth(10);
    this._stage = stage;
    const meta = this.cache.json.get(TROPHY.META) || {};
    const team = getTeam(SaveSystem.getProfile());
    const kids = (team.trophy || []).filter((k) => meta.figures?.[k.who]
      && this.textures.exists(trophyFigureKey(k.who)));
    const tallest = Math.max(1, ...kids.map((k) => k.cm));

    // The scale hangs from above; its hook tip is where the fish hangs from.
    const sm = meta.scale || { w: 280, h: 560, cx: 140, cy: 254, r: 110, hookX: 140, hookY: 559 };
    const ks = SCALE_H / sm.h;
    const scaleTop = -STAGE_H;
    const hookY = scaleTop + sm.hookY * ks;
    const room = -hookY - HEAD_GAP - MIN_CHAIN;
    // One scale for fish and children alike: px per cm.
    const cm = lengthCm || 100;
    const k = Math.min(room / cm, (room * KID_SHARE) / tallest);
    this.pxPerCm = k;
    const fishPx = cm * k;

    // The rope the scale hangs from, up out of sight.
    const rope = this.add.rectangle(FISH_X, scaleTop - 600, 6, 1200, 0x5a3a1c).setOrigin(0.5, 0.5);
    stage.add(rope);
    if (this.textures.exists(TROPHY.SCALE)) {
      const scaleImg = this.add.image(FISH_X - (sm.hookX - sm.w / 2) * ks, scaleTop, TROPHY.SCALE)
        .setOrigin(0.5, 0).setScale(ks);
      stage.add(scaleImg);
    }
    // The dial: our own face over the painted one, with numbers and a needle.
    const dialX = FISH_X + (sm.cx - sm.hookX) * ks;
    const dialY = scaleTop + sm.cy * ks;
    const dialR = sm.r * ks;
    this._buildDial(stage, dialX, dialY, dialR);

    // The fish, hanging by its tail on a chain that swings a little.
    const hang = this.add.container(FISH_X, hookY);
    stage.add(hang);
    const tailY = -HEAD_GAP - fishPx;            // in stage coordinates
    const chainLen = tailY - hookY;
    const chain = this.add.graphics();
    chain.lineStyle(4, 0x3a3a3a, 1);
    for (let y = 0; y < chainLen; y += 12) {
      chain.strokeEllipse(0, y + 6, 8, 12);
    }
    hang.add(chain);
    let fishHalfW = 40;
    const key = fishTextureKey(species, size);
    if (this.textures.exists(key)) {
      const fish = this.add.image(0, chainLen + fishPx / 2, key);
      fish.setScale(fishPx / fish.width);
      fish.setRotation(Math.PI / 2);              // its head (on the right) points down
      fishHalfW = (fish.height * fish.scaleY) / 2;
      if (this.giant) {
        hang.addAt(addRays(this, 0, chainLen + fishPx / 2, Math.max(fishPx, 200) * 0.75), 0);
      }
      hang.add(fish);
      if (this.giant) {
        const sparkle = this.add.container(0, chainLen + fishPx / 2);
        hang.add(sparkle);
        addGlints(this, sparkle, { w: fishHalfW * 2 + 120, h: fishPx + 80, count: 30, size: 26 });
      }
    }
    // It comes down onto the hook, and swings.
    hang.y = hookY - 260;
    this.tweens.add({ targets: hang, y: hookY, duration: DROP_MS, ease: 'Bounce.easeOut' });
    this.tweens.add({
      targets: hang, rotation: { from: -0.025, to: 0.025 }, duration: 1600, yoyo: true,
      repeat: -1, ease: 'Sine.easeInOut', delay: DROP_MS,
    });

    // The measuring tape, beside it, from the dock up to its tail.
    const tapeX = FISH_X + fishHalfW + TAPE_GAP;
    this._buildTape(stage, tapeX, cm, k);

    // The children, at their true size, on the dock to the left of it.
    let x = FISH_X - fishHalfW - FIGURE_GAP;
    let left = x;
    for (const kid of kids) {
      const f = meta.figures[kid.who];
      const img = this.add.image(0, 0, trophyFigureKey(kid.who)).setOrigin(0.5, 1);
      const s = (kid.cm * k) / (f.h - f.headY);
      img.setScale(s);
      const w = f.w * s;
      img.setPosition(x - w / 2, 0);
      x -= w + FIGURE_GAP * 0.4;
      left = Math.min(left, x);
      stage.add(img);
      img.setAlpha(0);
      this.tweens.add({ targets: img, alpha: 1, duration: 400, delay: 200 });
    }
    if (kids.length && tallest * k < LENS_FROM_PX) {
      const first = FISH_X - fishHalfW - FIGURE_GAP;
      const spot = { x: (x + FIGURE_GAP * 0.4 + first) / 2, y: -tallest * k / 2 };
      left = Math.min(left, this._buildLens(stage, kids, meta, spot, first - LENS_R - 40));
    }

    // The name plate, on the dock below, with length and weight.
    const name = speciesNlName(species) || '';
    const plateY = BELOW / 2 + 6;
    const title = this.add.text(0, plateY - 20, name, lettering(40, COLOR.GOLD)).setOrigin(0.5);
    this._readout = this.add.text(0, plateY + 24, `${lengthText(cm)}  ·  0 kg`,
                                  lettering(this.giant ? 32 : 29, this.giant ? COLOR.GOLD : COLOR.CREAM))
      .setOrigin(0.5);
    const plateW = Math.min(720, Math.max(400, title.width + 150, this._readout.width + 200));
    const plateX = 0;
    if (this.textures.exists(UI.BOARD_LABEL)) stage.add(addPlate(this, plateX, plateY, plateW, 124));
    stage.add(title);
    stage.add(this._readout);

    // How wide the block is: from the leftmost child to the tape.
    const right = tapeX + TAPE_W + 90;
    this._stageBox = { left: Math.min(left, -plateW / 2), right: Math.max(right, plateW / 2) };
  }

  /**
   * A magnifying glass with the children in it, big, and a dotted line to
   * the speck on the dock where they really stand. Returns its left edge.
   */
  _buildLens(stage, kids, meta, spot, cx) {
    const lens = this.add.container(0, 0);
    const cy = -LENS_R - 150;
    const R = LENS_R;
    const g = this.add.graphics();
    // The handle, down to the left.
    const a = Math.PI * 0.75;
    g.lineStyle(26, 0x5a3a1c, 1);
    g.lineBetween(cx + Math.cos(a) * R, cy + Math.sin(a) * R,
                  cx + Math.cos(a) * (R + 95), cy + Math.sin(a) * (R + 95));
    // The glass: sky, and a strip of the dock they stand on.
    g.fillStyle(0xcfe9ff, 1);
    g.fillCircle(cx, cy, R);
    const dockY = cy + R * 0.5;
    const half = Math.acos(0.5);
    const arc = [];
    for (let i = 0; i <= 24; i++) {
      const t = Math.PI / 2 - half + (2 * half * i) / 24;
      arc.push(new Phaser.Math.Vector2(cx + Math.cos(t) * R, cy + Math.sin(t) * R));
    }
    g.fillStyle(0xa8743e, 1);
    g.fillPoints(arc, true);
    g.lineStyle(3, 0x6a4420, 1);
    g.lineBetween(cx - R * Math.sin(half), dockY, cx + R * Math.sin(half), dockY);
    lens.add(g);
    // The children, side by side, the tallest LENS_KID_PX.
    const kl = LENS_KID_PX / Math.max(...kids.map((kid) => kid.cm));
    const figs = kids.map((kid) => {
      const f = meta.figures[kid.who];
      const img = this.add.image(0, dockY + 4, trophyFigureKey(kid.who)).setOrigin(0.5, 1);
      img.setScale((kid.cm * kl) / (f.h - f.headY));
      return img;
    });
    const total = figs.reduce((sum, img) => sum + img.displayWidth, 0) + (figs.length - 1) * 8;
    let fx = cx - total / 2;
    for (const img of figs) {
      img.x = fx + img.displayWidth / 2;
      fx += img.displayWidth + 8;
      lens.add(img);
    }
    // The rim, a glint on the glass.
    const rim = this.add.graphics();
    rim.lineStyle(14, 0x8a5a1c, 1);
    rim.strokeCircle(cx, cy, R);
    rim.lineStyle(5, 0xffd23c, 1);
    rim.strokeCircle(cx, cy, R - 2);
    rim.lineStyle(6, 0xffffff, 0.5);
    rim.beginPath();
    rim.arc(cx, cy, R * 0.8, Math.PI * 1.15, Math.PI * 1.4);
    rim.strokePath();
    // Dots from the glass to the speck, and a ring round it.
    const from = { x: cx + R * 0.72, y: cy + R * 0.72 };
    const d = Math.hypot(spot.x - from.x, spot.y - from.y);
    rim.fillStyle(0xffd23c, 1);
    for (let t = 0; t < d - 14; t += 14) {
      rim.fillCircle(from.x + ((spot.x - from.x) * t) / d, from.y + ((spot.y - from.y) * t) / d, 3);
    }
    rim.lineStyle(3, 0xffd23c, 1);
    rim.strokeCircle(spot.x, spot.y, 14);
    lens.add(rim);
    stage.add(lens);
    lens.setAlpha(0);
    this.tweens.add({ targets: lens, alpha: 1, duration: 500, delay: 500 });
    return cx + Math.cos(a) * (R + 110);
  }

  /** The dial: a clean face, ticks, numbers up to a round top, and the needle. */
  _buildDial(stage, x, y, r) {
    const top = DIAL_TOPS.find((t) => t >= this.kg * 1.15) || DIAL_TOPS[DIAL_TOPS.length - 1];
    const face = this.add.graphics();
    face.fillStyle(0xf7f0dc, 1);
    face.fillCircle(x, y, r * 0.97);
    for (let i = 0; i <= 40; i++) {
      const a = DIAL_FROM + DIAL_SWEEP * (i / 40);
      const major = i % 10 === 0;
      const r1 = r * (major ? 0.74 : 0.82);
      face.lineStyle(major ? 2.4 : 1.2, 0x2a1a0a, 1);
      face.lineBetween(x + Math.cos(a) * r1, y + Math.sin(a) * r1,
                       x + Math.cos(a) * r * 0.9, y + Math.sin(a) * r * 0.9);
    }
    stage.add(face);
    for (let i = 0; i <= 4; i++) {
      const a = DIAL_FROM + DIAL_SWEEP * (i / 4);
      const value = (top * i) / 4;
      const label = value >= 1000 ? `${value / 1000}t` : `${value}`;
      stage.add(this.add.text(x + Math.cos(a) * r * 0.55, y + Math.sin(a) * r * 0.55, label, {
        fontFamily: '"Arial Rounded MT Bold", "Trebuchet MS", sans-serif',
        fontSize: `${Math.round(r * 0.2)}px`, color: '#2a1a0a',
      }).setOrigin(0.5));
    }
    stage.add(this.add.text(x, y + r * 0.42, 'kg', {
      fontFamily: '"Arial Rounded MT Bold", "Trebuchet MS", sans-serif',
      fontSize: `${Math.round(r * 0.18)}px`, color: '#7a5a3a',
    }).setOrigin(0.5));
    const needle = this.add.graphics();
    needle.fillStyle(0xc81e1e, 1);
    needle.fillTriangle(-r * 0.06, 0, r * 0.06, 0, 0, -r * 0.84);
    needle.fillStyle(0x3a2a1a, 1);
    needle.fillCircle(0, 0, r * 0.09);
    needle.setPosition(x, y);
    stage.add(needle);
    // From 0 round to its weight, overshooting a little and settling.
    const angle = (kg) => DIAL_FROM + DIAL_SWEEP * Math.min(1, kg / top) + Math.PI / 2;
    needle.rotation = angle(0);
    const v = { kg: 0 };
    this.tweens.add({
      targets: v, kg: this.kg, duration: NEEDLE_MS, delay: DROP_MS, ease: 'Back.easeOut',
      onUpdate: () => {
        needle.rotation = angle(Math.max(0, v.kg));
        if (this._readout) {
          this._readout.setText(`${lengthText(this.catchData.lengthCm || 0)}  ·  ${weightText(Math.max(0, Math.min(v.kg, this.kg * 1.2)))}`);
        }
      },
      onComplete: () => {
        if (this._readout) {
          this._readout.setText(`${lengthText(this.catchData.lengthCm || 0)}  ·  ${weightText(this.kg)}`);
        }
      },
    });
  }

  /** A yellow measuring tape from the dock up, with its metres marked. */
  _buildTape(stage, x, cm, k) {
    const height = cm * k + HEAD_GAP;
    const tape = this.add.graphics();
    tape.fillStyle(0xf2c200, 1);
    tape.fillRect(x, -height, TAPE_W, height);
    tape.lineStyle(2, 0x6a4a00, 1);
    tape.strokeRect(x, -height, TAPE_W, height);
    // Marks: every 10 cm where there is room, every 50 cm, every metre.
    const every = [10, 50, 100].filter((step) => step * k >= 5);
    for (let c = 0; c <= cm + 0.01; c += every[0] || 100) {
      const y = -HEAD_GAP - c * k;
      const len = c % 100 === 0 ? TAPE_W : c % 50 === 0 ? TAPE_W * 0.65 : TAPE_W * 0.35;
      tape.lineStyle(c % 100 === 0 ? 2 : 1, 0x2a1a0a, 1);
      tape.lineBetween(x, y, x + len, y);
    }
    stage.add(tape);
    // The metres, as many as fit.
    const labelEvery = [1, 2, 5, 10].find((m) => m * 100 * k >= 34) || 10;
    for (let m = labelEvery; m * 100 <= cm + 0.01; m += labelEvery) {
      stage.add(this.add.text(x + TAPE_W + 8, -HEAD_GAP - m * 100 * k, `${m} m`, lettering(20))
        .setOrigin(0, 0.5));
    }
    // And the whole length, at the top.
    stage.add(this.add.text(x + TAPE_W + 8, -height, lengthText(cm), lettering(30, COLOR.GOLD))
      .setOrigin(0, 0.5));
  }

  // ---------------------------------------------------------------------------
  // The party
  // ---------------------------------------------------------------------------

  _confetti() {
    const cam = this.cameras.main;
    const view = this.layout ? this.layout.view : { left: WORLD_LEFT, top: WORLD_TOP, width: WORLD_WIDTH, height: WORLD_HEIGHT };
    for (let i = 0; i < 90; i++) {
      const color = CONFETTI[i % CONFETTI.length];
      const piece = this.add.rectangle(view.left + Math.random() * view.width, view.top - 20 - Math.random() * 200,
                                       8 + Math.random() * 8, 12 + Math.random() * 10, color, 1).setDepth(50);
      piece.rotation = Math.random() * Math.PI;
      this.tweens.add({
        targets: piece,
        y: view.top + view.height + 40,
        x: piece.x + Phaser.Math.Between(-120, 120),
        rotation: piece.rotation + Phaser.Math.FloatBetween(-8, 8),
        duration: 2600 + Math.random() * 1800,
        delay: Math.random() * 600,
        ease: 'Sine.easeIn',
        onComplete: () => piece.destroy(),
      });
    }
    void cam;
  }

  /** A giant: "Wereldrecord!", big, over the scene. */
  _worldRecord() {
    const view = this.layout ? this.layout.view : { centerX: 640, top: 0, height: 720 };
    const word = this.add.text(view.centerX, view.top + view.height * 0.16, WORLD_RECORD,
                               lettering(72, COLOR.GOLD)).setOrigin(0.5).setDepth(55);
    word.setScale(0.2);
    this.tweens.add({ targets: word, scale: 1, duration: 500, ease: 'Back.easeOut' });
    this.tweens.add({
      targets: word, scale: { from: 1, to: 1.08 }, duration: 620, yoyo: true, repeat: -1,
      ease: 'Sine.easeInOut', delay: 520,
    });
    for (const side of [-1, 1]) {
      const star = this.add.star(word.x + side * (word.width / 2 + 50), word.y, 5, 13, 30, 0xffd23c)
        .setStrokeStyle(3, 0x3a1d06).setDepth(55);
      this.tweens.add({ targets: star, angle: side * 360, duration: 5200, repeat: -1 });
    }
  }

  // ---------------------------------------------------------------------------
  // Layout, the button, closing
  // ---------------------------------------------------------------------------

  _applyLayout(layout) {
    if (!layout) return;
    const { safe } = layout;
    if (this._stage && this._stageBox) {
      const box = this._stageBox;
      const width = box.right - box.left;
      const height = STAGE_H + BELOW;
      const k = Math.min(1, (safe.height - 20) / height, (safe.width - 40) / width);
      this._stage.setScale(k);
      const groundY = safe.bottom - 10 - BELOW * k;
      const centre = (box.left + box.right) / 2;
      this._stage.setPosition(safe.centerX - centre * k, groundY);
    }
    if (this._playGroup) {
      const k = Math.min(1, (safe.height * 0.3) / PLAY_BTN_SIZE);
      const inset = (PLAY_BTN_MARGIN + PLAY_BTN_SIZE / 2) * k;
      this._playGroup.setScale(k);
      this._playGroup.setPosition(safe.right - inset, safe.bottom - inset);
    }
  }

  _buildPlayButton() {
    const group = this.add.container(0, 0).setDepth(60);
    group.add(addGlow(this, 0, 0, { r: PLAY_BTN_SIZE / 2 - 6 }));
    const key = this.textures.exists(UI.CONTINUE) ? UI.CONTINUE : TEX.PLAY;
    const btn = this.add.image(0, 0, key);
    btn.setScale(PLAY_BTN_SIZE / Math.max(btn.width, btn.height));
    group.add(btn);
    pressable(this, btn, () => this._close());
    this._playGroup = group;
    this._applyLayout(this.layout);
  }

  _close() {
    if (this._closed) return;
    this._closed = true;
    if (this._hiddenVideoEl) this._hiddenVideoEl.style.display = '';
    // (Not from inside Phaser's pointerdown pass: see CatchDisplayScene.)
    this.time.delayedCall(0, () => {
      this.scene.stop();
      this.scene.wake('FishingScene');
    });
  }
}
