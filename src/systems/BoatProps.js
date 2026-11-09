import Phaser from 'phaser';
import { propFiles, propTextureKey } from '../data/boats.js';
import { addGlints } from './Ui.js';
import { canBend } from './FishLeap.js';

/**
 * What stands on each boat of the big ocean (`props` in data/boats.js):
 * crates on the deck, a flag waving at the stern, a parrot on the rail,
 * gulls following the boat. The paintings show only the boat; these are
 * cut-outs, placed and moved here, so that they never touch the rail, the
 * water film or the children's place.
 */

const DECK_DEPTH = 6;          // over the painting, under the children (9, 10)
const HIGH_DEPTH = 7;          // flags and birds at the stern
const GULL_DEPTH = 4;
const SHADOW_KEY = 'prop-shadow';
const FLAG_POINTS = 16;
const FLAG_WAVE_HZ = 1.5;
const FLAG_WAVE = 0.05;        // how far the free end swings (share of its height)
const GULL_EVERY_MS = [9000, 20000];
const GULL_FIRST_MS = [2500, 5000];
const GULL_FLAP_MS = 170;
const GULL_CROSS_MS = [7000, 11000];
const PERCH_LOOK_MS = [2500, 6500];

export class BoatProps {
  constructor(scene) {
    this.scene = scene;
    this.boat = null;
    this.objects = [];
    this.timers = [];
    this.flags = [];
  }

  /** Show this boat's things (and take the previous boat's away). */
  show(boat) {
    if (this.boat === boat) return;
    this.clear();
    this.boat = boat;
    for (const prop of boat.props || []) {
      const keys = propFiles(prop).map((file) => propTextureKey(boat, file));
      if (!keys.every((key) => this.scene.textures.exists(key))) continue;
      if (prop.kind === 'flag') this._flag(prop, keys[0]);
      else if (prop.kind === 'perch') this._perch(prop, keys[0]);
      else if (prop.kind === 'gulls') this._gulls(prop, keys);
      else this._deck(prop, keys[0]);
    }
  }

  clear() {
    for (const timer of this.timers) timer.remove(false);
    for (const obj of this.objects) {
      this.scene.tweens.killTweensOf(obj);
      obj.destroy();
    }
    this.timers = [];
    this.objects = [];
    this.flags = [];
    this.boat = null;
  }

  update() {
    const t = this.scene.time.now / 1000;
    for (const wave of this.flags) wave(t);
  }

  _add(obj) {
    this.objects.push(obj);
    return obj;
  }

  _later(ms, fn) {
    const timer = this.scene.time.delayedCall(ms, fn);
    this.timers.push(timer);
    return timer;
  }

  /** Something standing on the deck, with a soft shadow under it. */
  _deck(prop, key) {
    const scene = this.scene;
    const img = this._add(scene.add.image(prop.x, prop.y, key).setOrigin(0.5, 1).setDepth(DECK_DEPTH));
    img.setScale(prop.height / img.height);
    const shadow = this._add(scene.add.image(prop.x, prop.y - 3, shadowTexture(scene)));
    shadow.setDisplaySize(img.displayWidth * 1.1, img.displayWidth * 0.24).setDepth(DECK_DEPTH - 0.5);
    if (prop.glints) {
      // Gold that catches the sun.
      const sparkle = this._add(scene.add.container(prop.x, prop.y - img.displayHeight * 0.62)
        .setDepth(DECK_DEPTH + 0.5));
      addGlints(scene, sparkle, { w: img.displayWidth * 0.55, h: img.displayHeight * 0.3, count: 7, size: 11 });
    }
  }

  /** A flag on its pole, waving: its picture bent along a wave (a Rope). */
  _flag(prop, key) {
    const scene = this.scene;
    if (!canBend(scene)) {
      const img = this._add(scene.add.image(prop.x, prop.y, key).setOrigin(prop.flip ? 1 : 0, 1));
      img.setScale(prop.height / img.height).setFlipX(!!prop.flip).setDepth(HIGH_DEPTH);
      return;
    }
    const frame = scene.textures.getFrame(key);
    const W = frame.width;
    const H = frame.height;
    // Local (0, 0) is the foot of the pole; the picture lies to the right of
    // it, or (flipped) to the left.
    const points = [];
    for (let i = 0; i < FLAG_POINTS; i++) {
      const u = i / (FLAG_POINTS - 1);
      points.push(new Phaser.Math.Vector2(prop.flip ? -W + u * W : u * W, -H / 2));
    }
    const rope = this._add(scene.add.rope(prop.x, prop.y, key, null, points).setDepth(HIGH_DEPTH));
    rope.setScale(prop.height / H);
    if (prop.flip) rope.flipX = true;
    const amp = H * FLAG_WAVE;
    const phase = Math.random() * 10;
    this.flags.push((t) => {
      const w = (t + phase) * Math.PI * 2 * FLAG_WAVE_HZ;
      for (let i = 0; i < FLAG_POINTS; i++) {
        const u = i / (FLAG_POINTS - 1);
        const out = prop.flip ? 1 - u : u;          // 0 at the pole, 1 at the free end
        rope.points[i].y = -H / 2 + Math.sin(w - out * 5) * amp * out ** 1.3;
      }
      rope.setDirty();
    });
  }

  /** A bird on the rail: it shifts its weight and now and then looks about. */
  _perch(prop, key) {
    const scene = this.scene;
    const bird = this._add(scene.add.image(prop.x, prop.y, key).setOrigin(0.5, 1).setDepth(HIGH_DEPTH));
    bird.setScale(prop.height / bird.height);
    scene.tweens.add({
      targets: bird, angle: { from: -2.5, to: 2.5 }, duration: 1300, yoyo: true, repeat: -1,
      ease: 'Sine.easeInOut',
    });
    const look = () => {
      if (Math.random() < 0.6) {
        bird.setFlipX(!bird.flipX);
      } else {
        scene.tweens.add({ targets: bird, y: prop.y - 7, duration: 140, yoyo: true, ease: 'Quad.easeOut' });
      }
      this._later(Phaser.Math.Between(...PERCH_LOOK_MS), look);
    };
    this._later(Phaser.Math.Between(...PERCH_LOOK_MS), look);
  }

  /** Gulls following the boat: now and then one or two fly across the wake. */
  _gulls(prop, keys) {
    const scene = this.scene;
    const fly = () => {
      const view = scene.cameras.main.worldView;
      const count = Math.random() < 0.4 ? 2 : 1;
      const toRight = Math.random() < 0.5;
      for (let n = 0; n < count; n++) {
        const size = prop.height * Phaser.Math.FloatBetween(0.7, 1.15);
        const y = Phaser.Math.Between(-60, 140) + n * 26;
        const from = toRight ? view.x - 80 - n * 70 : view.right + 80 + n * 70;
        const to = toRight ? view.right + 80 : view.x - 80;
        const gull = this._add(scene.add.image(from, y, keys[0]).setDepth(GULL_DEPTH));
        gull.setScale(size / gull.height).setFlipX(!toRight);
        let frame = 0;
        const flap = scene.time.addEvent({
          delay: GULL_FLAP_MS + Phaser.Math.Between(-20, 20), loop: true,
          callback: () => { frame = 1 - frame; gull.setTexture(keys[frame % keys.length]); },
        });
        this.timers.push(flap);
        const t = { p: 0 };
        const bob = Phaser.Math.FloatBetween(8, 16);
        scene.tweens.add({
          targets: t, p: 1, duration: Phaser.Math.Between(...GULL_CROSS_MS), delay: n * 300,
          onUpdate: () => {
            gull.x = Phaser.Math.Linear(from, to, t.p);
            gull.y = y + Math.sin(t.p * Math.PI * 3) * bob;
          },
          onComplete: () => {
            flap.remove(false);
            this.objects = this.objects.filter((o) => o !== gull);
            gull.destroy();
          },
        });
      }
      this._later(Phaser.Math.Between(...GULL_EVERY_MS), fly);
    };
    this._later(Phaser.Math.Between(...GULL_FIRST_MS), fly);
  }
}

/** A soft round shadow, made once. */
function shadowTexture(scene) {
  if (!scene.textures.exists(SHADOW_KEY)) {
    const tex = scene.textures.createCanvas(SHADOW_KEY, 128, 128);
    const ctx = tex.getContext();
    const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, 'rgba(20, 12, 4, 0.5)');
    g.addColorStop(0.55, 'rgba(20, 12, 4, 0.28)');
    g.addColorStop(1, 'rgba(20, 12, 4, 0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 128, 128);
    tex.refresh();
  }
  return SHADOW_KEY;
}
