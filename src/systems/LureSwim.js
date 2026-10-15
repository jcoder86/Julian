import Phaser from 'phaser';
import { fishTextureKey } from '../data/fish.js';

/**
 * A lure being reeled in: where it is, how deep, how it swims, and what the
 * water around it does. The scene says how far the reel has brought it in
 * and whether the angler is cranking right now; this works out the rest
 * and moves the lure (the scene's container with the lure sprite in it).
 *
 * - The lure runs a straight way over the bottom of the picture's water,
 *   from where it landed to the spot at the jetty (`home`), NOSE FIRST --
 *   the line comes off its nose and runs on along that same way.
 * - Under water its depth shows: the deeper, the fainter and the more the
 *   colour of the water. Seen from the jetty, a thing under water also lies
 *   a touch lower in the picture. (Not blurred: Phaser's blur effect on a
 *   picture inside a container made the lure disappear altogether.)
 * - It lands with a splash and sinks to the depth it runs at. Cranking, it
 *   swims there, wobbling the way its kind does (a lure's `swim` in
 *   data/baits.js) -- the faster the crank, the livelier. Near the jetty it
 *   comes up: the water gets shallow and the line climbs to the rod. Not
 *   cranking, it sinks slowly towards the bottom. A dry fly never sinks: it
 *   skitters over the surface.
 * - The line enters the water a little in front of the lure: as much
 *   closer to the jetty as the lure is deep compared with how high the rod
 *   tip is. That point is `entry`; FishingLine draws the line from the rod
 *   to there through the air, and from there under water to the lure's
 *   nose. (Seen from above, line under water looks bent toward the
 *   surface: it lies along the way the lure swims.) Where the line cuts the
 *   surface, small ripples run off.
 * - A fish that is going to take it shows first as a dark shape that
 *   follows -- closer with every turn of the reel -- and at the bite the
 *   water boils. Now and then one follows and turns away.
 */

// Depths in metres. The bottom; how deep a lure has to be to look as faint
// as it gets; and how high the rod tip is above the water.
const BOTTOM = 2.2;
const SEE_DEPTH = 2.6;
const ROD_HEIGHT = 2.4;
// Seen from above, line under water looks shorter than it is -- the water
// bends the light: the point where it goes in seems this much nearer the
// lure. (It also keeps the bend where the line enters the water gentle.)
const UNDER_LOOKS = 0.32;
// How much lower in the picture a lure lies per metre of depth (design px,
// at full scale).
const DROP_PX = 12;
// How fast it goes deeper or comes up while cranked (m/s); a lure that
// lands sinks to its running depth at this speed.
const DIVE_RATE = 0.9;
const RISE_RATE = 1.1;
// In this last share of the way to the jetty it comes up to the surface.
const SHORE_SHARE = 0.3;
// A crank that moves the lure this fast (design px/s along the water) is
// "normal": the lure wobbles at its own pace. (Smoothed over ~0.15 s.)
const NORMAL_SPEED = 110;
const SPEED_SMOOTHING = 7;
// Not cranking, a lure still stirs a little: this share of its wobble.
const RESTING_WOBBLE = 0.25;

// The look under water.
const ALPHA_TOP = 0.97;
const ALPHA_DEEP = 0.6;
const TINT_DEEP = 0.6;         // how far toward the water's colour, at its faintest
// A lure heading straight toward the jetty (or away) is seen nearly end-on
// from up there: it looks this much shorter. (And so does a fish.)
const FORESHORTEN = 0.45;
const LURE_LENGTH = 82;        // design px at full scale (= LURE_DISPLAY_LENGTH)

// Ripples (design px at full scale; they shrink less with distance than the
// lure does, so that a lure far out can still be found).
const RING_KEEP = 0.4;
const SPLASH_RING_W = 90;      // where it lands, and where it is lifted out
const SPLASH_KEEP = 0.6;       // ...and it shrinks even less with distance
const RING_EDGE = 0x163246;    // the faint dark edge under a ring
// Where the line goes into the water, a small bright dimple.
const DIMPLE_W = 9;
const ENTRY_RING_MS = 320;     // where the line cuts the water, while cranking
const ENTRY_RING_W = 30;
const SHALLOW = 0.35;          // a lure less deep than this stirs the surface above it
const SURFACE_RING_MS = 300;
const SURFACE_RING_W = 60;
const FLOAT_RING_MS = 1500;    // a fly lying still on the surface
// A metal lure (spinner, spoon, pilker) flashes as it turns in the light.
const FLASH_MS = 220;
const FLASH_SIZE = 15;

// The fish that follows: how long it is drawn (px per cm, at full scale,
// within bounds), how far behind the lure it starts and ends (in its own
// lengths), how dark and how see-through.
const FOLLOWER_PX_PER_CM = 1.5;
const FOLLOWER_MIN = 60;
const FOLLOWER_MAX = 260;
const FOLLOW_BACK_FROM = 2.2;
const FOLLOW_BACK_TO = 0.12;
const FOLLOWER_COLOR = 0x0a2630;
const FOLLOWER_ALPHA = 0.5;
const FOLLOWER_DEEPER = 0.35;  // m below the lure

const lerp = (a, b, t) => a + (b - a) * t;
const clamp01 = (v) => Math.max(0, Math.min(1, v));

export class LureSwim {
  /**
   * @param scene
   * @param opts.container   the lure's container (the line ends at its origin, the lure's eye)
   * @param opts.sprite      the lure image in it (eye on the left)
   * @param opts.start       {x, y} where it landed
   * @param opts.home        {x, y} the spot at the jetty it is reeled to
   * @param opts.swim        the lure's `swim` (data/baits.js)
   * @param opts.depthScale  (y) => how big things look at that distance
   * @param opts.waterTint   the colour a thing deep in this water takes on
   * @param opts.isWater     (x, y) => is there water there? (a following fish
   *                         keeps out of sight where there is none)
   */
  constructor(scene, { container, sprite, start, home, swim, depthScale, waterTint, isWater }) {
    this.scene = scene;
    this.container = container;
    this.sprite = sprite;
    this.start = { x: start.x, y: start.y };
    this.home = { x: home.x, y: home.y };
    this.swim = { depth: 0.8, sink: 0.4, sway: 3, roll: 10, beat: 4, ...swim };
    this.depthScale = depthScale;
    this.isWater = isWater || (() => true);
    this.waterTint = Phaser.Display.Color.ValueToColor(waterTint ?? 0x4a7f99);

    const dx = this.home.x - this.start.x;
    const dy = this.home.y - this.start.y;
    this.length = Math.hypot(dx, dy) || 1;
    this.dir = { x: dx / this.length, y: dy / this.length };   // toward the jetty

    this.depth = 0;             // m
    this.shownDepth = 0;        // with the jig in it
    this.phase = 0;
    this.speed = 0;             // px/s along the water, smoothed
    this._p = 0;
    this._time = 0;
    this._entryIn = 0;
    this._surfaceIn = 0;
    this._lastBeat = 0;
    this.entry = { x: this.start.x, y: this.start.y };
    this.surface = { x: this.start.x, y: this.start.y };
    this.scale = depthScale(this.start.y);
    this.follower = null;

    this._spriteScale = sprite.scaleX;
    container.setAlpha(1);
    this.dimple = scene.add.ellipse(start.x, start.y, DIMPLE_W, DIMPLE_W * 0.4, 0xffffff, 0.55).setDepth(7);
    this.dimple.setVisible(false);

    this._splash(this.start, 1);
    this.update(0, { progress: 0, cranking: false });
  }

  /** Where things are, for the scene: the lure's eye. */
  get x() { return this.container.x; }
  get y() { return this.container.y; }

  /**
   * One frame. `progress` 0..1: how far along the way the reel has brought
   * the lure; `cranking`: whether the handle is being turned right now.
   */
  update(delta, { progress, cranking }) {
    const dt = Math.min(delta, 64) / 1000;
    this._time += dt;
    const swim = this.swim;

    // How fast it is going, along the water.
    if (dt > 0) {
      const now = Math.max(0, (progress - this._p) * this.length / dt);
      this.speed += (now - this.speed) * (1 - Math.exp(-SPEED_SMOOTHING * dt));
    }
    this._p = progress;
    const moving = cranking && this.speed > 4;

    // Where on the water, and how far away that is.
    const sx = lerp(this.start.x, this.home.x, progress);
    const sy = lerp(this.start.y, this.home.y, progress);
    this.surface.x = sx;
    this.surface.y = sy;
    const scale = this.depthScale(sy);
    this.scale = scale;

    // How deep: running depth while cranked (less near the jetty), the
    // bottom while not. A fly stays on top.
    const shore = clamp01((1 - progress) / SHORE_SHARE) ** 0.6;
    let target = swim.floats ? 0 : (cranking ? swim.depth * shore : BOTTOM);
    if (progress >= 1) target = 0;
    // (Down to its running depth it goes quickly -- just landed, or
    // cranked; below that, left alone, it sinks at its own pace.)
    const sinking = target > this.depth;
    const rate = !sinking ? RISE_RATE
      : (cranking || this.depth < swim.depth ? DIVE_RATE : swim.sink);
    const step = rate * dt;
    this.depth += Math.max(-step, Math.min(step, target - this.depth));

    // The wobble: its beat follows the crank.
    const pace = moving ? Phaser.Math.Clamp(this.speed / NORMAL_SPEED, 0.3, 1.6) : RESTING_WOBBLE;
    this.phase += Math.PI * 2 * swim.beat * pace * dt;
    const lively = moving ? 1 : RESTING_WOBBLE;
    const jig = swim.jig && moving ? swim.jig * (0.5 - 0.5 * Math.cos(this.phase * 0.5)) : 0;
    this.shownDepth = Math.max(0, this.depth - jig);
    const depth = this.shownDepth;

    // On the picture: the way, a sway across it, and lower for deeper.
    const sway = swim.sway * Math.sin(this.phase) * lively * scale;
    const x = sx - this.dir.y * sway;
    const y = sy + this.dir.x * sway + depth * DROP_PX * scale;
    this.container.setPosition(x, y);
    this.container.setScale(scale);

    // Nose first, toward the jetty; rolling a little as it wobbles. The eye
    // is on the picture's left, so the picture points the other way.
    const heading = Math.atan2(this.dir.y, this.dir.x);
    const roll = Phaser.Math.DegToRad(swim.roll) * Math.sin(this.phase + Math.PI / 2) * lively;
    const rotation = heading + Math.PI + roll;
    this.sprite.setRotation(rotation);
    this.sprite.setFlipY(Math.cos(rotation) < 0);
    this.sprite.setScale(this._spriteScale * lerp(1, FORESHORTEN, Math.abs(this.dir.y)), this._spriteScale);

    // Under water: fainter, the water's colour.
    const deep = clamp01(depth / SEE_DEPTH);
    this.sprite.setAlpha(lerp(ALPHA_TOP, ALPHA_DEEP, deep));
    const c = Phaser.Display.Color.Interpolate.ColorWithColor(
      Phaser.Display.Color.ValueToColor(0xffffff), this.waterTint, 100, Math.round(deep * TINT_DEEP * 100));
    this.sprite.setTint(Phaser.Display.Color.GetColor(c.r, c.g, c.b));

    // Where the line goes into the water: between the lure and the jetty,
    // as much closer to the jetty as the lure is deep compared to the rod.
    const under = depth / (depth + ROD_HEIGHT) * UNDER_LOOKS;
    this.entry.x = lerp(sx, this.home.x, under);
    this.entry.y = lerp(sy, this.home.y, under);
    if (depth > 0.15) {
      // Never so short that the part under water cannot be seen.
      const min = 14 * scale;
      const ex = this.entry.x - x;
      const ey = this.entry.y - y;
      const d = Math.hypot(ex, ey);
      if (d < min) {
        this.entry.x = x + this.dir.x * min;
        this.entry.y = y + this.dir.y * min;
      }
    } else {
      this.entry.x = x;
      this.entry.y = y;
    }
    const underWater = depth > 0.15;
    this.dimple.setVisible(underWater);
    if (underWater) {
      this.dimple.setPosition(this.entry.x, this.entry.y);
      this.dimple.setScale(scale ** (1 - RING_KEEP));
    }

    // The water around it.
    if (moving && depth > 0.15) {
      this._entryIn -= delta;
      if (this._entryIn <= 0) {
        this._entryIn = ENTRY_RING_MS;
        this._ring(this.entry.x, this.entry.y, ENTRY_RING_W, 0.5, 7);
      }
    }
    if (depth < SHALLOW) {
      this._surfaceIn -= delta;
      if (this._surfaceIn <= 0) {
        const still = !moving;
        this._surfaceIn = still ? FLOAT_RING_MS : SURFACE_RING_MS;
        if (!still || swim.floats) {
          this._ring(x, sy, SURFACE_RING_W, 0.6 * (1 - depth / SHALLOW), 21);
        }
      }
    }
    if (swim.flash && moving && depth < SEE_DEPTH * 0.85) {
      // A flash each time it rolls over toward the light.
      const beat = Math.floor((this.phase + Math.PI / 2) / (Math.PI * 2));
      if (beat !== this._lastBeat) {
        this._lastBeat = beat;
        this._flash(x, y, scale, 1 - deep * 0.7);
      }
    }

    if (this.follower) this._updateFollower(dt, progress, x, y, depth);
  }

  // ---------------------------------------------------------------------------
  // The fish that follows
  // ---------------------------------------------------------------------------

  /**
   * A fish (`pick`, as data/fish.js picks it) that shows up behind the lure
   * once the reel has brought it `from` along the way, and is right behind
   * it at `to`. Then the scene calls strike() -- or, for a fish that only
   * follows (`refuses`), it turns away by itself.
   */
  follow(pick, from, to, refuses = false) {
    const key = fishTextureKey(pick.species, pick.size);
    if (!this.scene.textures.exists(key)) return;
    const shape = this.scene.add.image(0, 0, key).setDepth(19);
    shape.setTintFill(FOLLOWER_COLOR);
    shape.setAlpha(0);
    shape.setVisible(false);
    const length = Phaser.Math.Clamp((pick.lengthCm || 30) * FOLLOWER_PX_PER_CM, FOLLOWER_MIN, FOLLOWER_MAX);
    this.follower = { shape, from, to, refuses, length, gone: false };
  }

  _updateFollower(dt, progress, lx, ly, depth) {
    const f = this.follower;
    if (f.gone) return;
    if (progress < f.from) return;
    if (f.refuses && progress >= f.to) {
      this._turnAway();
      return;
    }
    const k = clamp01((progress - f.from) / Math.max(0.001, f.to - f.from));
    const scale = this.scale;
    const length = f.length * scale;
    const along = lerp(1, FORESHORTEN, Math.abs(this.dir.y));
    // Behind the lure on its way, closing in; swimming, so not quite in
    // line. (From the lure's eye: past the lure, the gap, half the fish.)
    const gap = lerp(FOLLOW_BACK_FROM, FOLLOW_BACK_TO, k ** 1.3) * length;
    const back = (LURE_LENGTH * scale + gap + length / 2) * along;
    const weave = Math.sin(this._time * 2.6) * 7 * scale;
    const x = lx - this.dir.x * back - this.dir.y * weave;
    const y = ly - this.dir.y * back + this.dir.x * weave + FOLLOWER_DEEPER * DROP_PX * scale;
    const heading = Math.atan2(this.dir.y, this.dir.x) + Math.sin(this._time * 7) * 0.06;
    const s = f.shape;
    s.setVisible(true);
    s.setPosition(x, y);
    s.setRotation(heading);
    s.setFlipY(Math.cos(heading) < 0);
    s.setScale(length / s.width * along, length / s.width);
    const deep = clamp01((depth + FOLLOWER_DEEPER) / SEE_DEPTH);
    const inWater = this.isWater(x, y) ? 1 : 0;
    s.setAlpha(FOLLOWER_ALPHA * clamp01(k * 3 + 0.15) * (1 - deep * 0.35) * inWater);
  }

  /** It only had a look: off it goes, sideways and down. */
  _turnAway() {
    const f = this.follower;
    if (!f || f.gone) return;
    f.gone = true;
    const s = f.shape;
    const side = Math.random() < 0.5 ? -1 : 1;
    const scale = this.scale;
    this.scene.tweens.add({
      targets: s,
      x: s.x - this.dir.y * side * 130 * scale - this.dir.x * 40 * scale,
      y: s.y + this.dir.x * side * 130 * scale + 30 * scale,
      rotation: s.rotation + side * 1.3,
      alpha: 0,
      duration: 750,
      ease: 'Cubic.easeIn',
      onComplete: () => s.destroy(),
    });
  }

  /**
   * The bite: the fish lunges at the lure, the water boils, and the lure is
   * gone -- the scene takes over with the fight.
   */
  strike() {
    const x = this.container.x;
    const y = this.container.y;
    const scale = this.scale;
    const f = this.follower;
    if (f && !f.gone) {
      f.gone = true;
      const s = f.shape;
      this.scene.tweens.add({
        targets: s,
        x: x - this.dir.x * f.length * 0.3 * scale,
        y,
        alpha: 0,
        duration: 260,
        ease: 'Quad.easeOut',
        onComplete: () => s.destroy(),
      });
    }
    // The boil: a burst of rings, and some spray.
    for (let i = 0; i < 4; i++) {
      this.scene.time.delayedCall(i * 90, () => this._ring(x, y - this.shownDepth * DROP_PX * scale,
        SURFACE_RING_W * 1.3, 0.9, 21, 900));
    }
    this._spray(x, y - this.shownDepth * DROP_PX * scale, 1.2);
    this.sprite.setVisible(false);
  }

  // ---------------------------------------------------------------------------
  // The water
  // ---------------------------------------------------------------------------

  /** It lands: rings and spray. Also when it is lifted out (`leaveWater`). */
  _splash(at, strength) {
    // A burst of foam, rings running out from it, and spray.
    const k = this.depthScale(at.y) ** (1 - SPLASH_KEEP);
    const foam = this.scene.add.ellipse(at.x, at.y, 34 * k, 12 * k, 0xffffff, 0.8 * strength).setDepth(21);
    this.scene.tweens.add({
      targets: foam,
      scale: { from: 0.5, to: 2 },
      alpha: { from: 0.8 * strength, to: 0 },
      duration: 520,
      ease: 'Quad.easeOut',
      onComplete: () => foam.destroy(),
    });
    for (let i = 0; i < 3; i++) {
      this.scene.time.delayedCall(i * 140, () => this._ring(at.x, at.y, SPLASH_RING_W, 0.95 * strength, 21, 1200, SPLASH_KEEP));
    }
    this._spray(at.x, at.y, strength * 1.4);
  }

  /** Home at the jetty: the lure comes out of the water. */
  leaveWater() {
    this._splash({ x: this.container.x, y: this.container.y }, 0.6);
  }

  /**
   * A ring running out over the water. White on a faint dark edge: the
   * painted water is full of white glints, and a ring has to stand out
   * against them.
   */
  _ring(x, y, width, alpha, depth, ms = 800, keep = RING_KEEP) {
    const k = this.depthScale(y) ** (1 - keep);
    const line = Math.max(2, 3.2 * k);
    const edge = this.scene.add.ellipse(x, y, width * k, width * k * 0.34).setDepth(depth);
    edge.setStrokeStyle(line + 2.5, RING_EDGE, 0.35);
    edge.setFillStyle();
    const ring = this.scene.add.ellipse(x, y, width * k, width * k * 0.34).setDepth(depth);
    ring.setStrokeStyle(line, 0xffffff, 1);
    ring.setFillStyle();
    this.scene.tweens.add({
      targets: [edge, ring],
      scale: { from: 0.35, to: 1.6 },
      alpha: { from: alpha, to: 0 },
      duration: ms,
      ease: 'Sine.easeOut',
      onComplete: () => {
        edge.destroy();
        ring.destroy();
      },
    });
  }

  _spray(x, y, strength) {
    const k = this.depthScale(y) ** (1 - RING_KEEP);
    const count = Math.round(7 * strength);
    for (let i = 0; i < count; i++) {
      const drop = this.scene.add.circle(x, y, (2.2 + Math.random() * 2.2) * k, 0xffffff, 0.95).setDepth(22);
      const dx = (Math.random() - 0.5) * 40 * k * strength;
      const up = (18 + Math.random() * 26) * k * strength;
      this.scene.tweens.add({
        targets: drop,
        x: x + dx,
        y: { from: y, to: y - up, yoyo: true },
        alpha: { from: 0.9, to: 0.2 },
        duration: 260 + Math.random() * 120,
        ease: 'Quad.easeOut',
        onComplete: () => drop.destroy(),
      });
    }
  }

  /** A flash of light on metal, at the middle of the lure. */
  _flash(x, y, scale, strength) {
    const along = LURE_LENGTH * 0.45 * scale * lerp(1, FORESHORTEN, Math.abs(this.dir.y));
    const size = FLASH_SIZE * scale ** 0.7 * strength;
    const star = this.scene.add.star(x - this.dir.x * along, y - this.dir.y * along, 4, size * 0.18, size, 0xffffff, 1)
      .setDepth(22).setBlendMode(Phaser.BlendModes.ADD).setAngle(Math.random() * 90);
    this.scene.tweens.add({
      targets: star,
      scale: { from: 0.2, to: 1 },
      alpha: { from: strength, to: 0 },
      angle: '+=40',
      duration: FLASH_MS,
      ease: 'Quad.easeOut',
      onComplete: () => star.destroy(),
    });
  }

  /**
   * Done with this retrieve: the lure picture is itself again (the rings and
   * the spray still fading out play on by themselves). A follower that is
   * still around fades away.
   */
  destroy() {
    const f = this.follower;
    if (f && !f.gone) {
      f.gone = true;
      this.scene.tweens.add({ targets: f.shape, alpha: 0, duration: 300, onComplete: () => f.shape.destroy() });
    }
    this.follower = null;
    if (this.dimple) this.dimple.destroy();
    this.dimple = null;
    const s = this.sprite;
    if (s && s.active) {
      s.clearTint();
      s.setAlpha(1);
      s.setScale(this._spriteScale);
      s.setVisible(true);
    }
  }
}
