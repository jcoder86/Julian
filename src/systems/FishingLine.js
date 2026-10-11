/**
 * The fishing line: from the tip of the rod to whatever is on its end.
 *
 * A real line looks different in every phase of fishing, and so does this
 * one. The scene says what the line is doing; this class works out its
 * shape, lets it move like a line (not like a ruler) and draws it.
 *
 *   hang(tip, delta)      The rig dangles from the rod tip and swings as
 *                         the rod moves -- a little pendulum. Returns where
 *                         its end is, so the scene can hang the float there.
 *   update(..., shape)    Draw the line from the tip to `end`:
 *     { kind: 'straight' }                   taut through the air
 *     { kind: 'flight', t }                  flying out during a cast (t =
 *                                            0..1 of the way): the line
 *                                            trails the float in a bow that
 *                                            rises as the float comes down
 *     { kind: 'water', slack, foot, tremble } on the water. slack 1: the
 *                                            line droops from the rod, lands
 *                                            on the water part of the way
 *                                            and lies on it up to the float.
 *                                            slack 0: pulled tight, straight
 *                                            from the tip into the water.
 *
 * Between any two shapes the line does not jump: every point of it trails
 * a little behind where it should be, the middle more than the ends. That
 * is what makes it whip when the rod is swung and settle when it lands.
 */

const SEGMENTS = 26;

// The dangling rig.
const HANG_LENGTH = 54;        // design px from the rod tip to the top of the float
const GRAVITY = 2600;          // px / s^2
const SWING_DAMPING = 1.6;     // per second
const BREEZE = 170;            // px / s^2, slowly changing: a gentle sway at rest
const REEL_UP_SPEED = 1500;    // px / s: how fast spare line is wound in to HANG_LENGTH

// How quickly a point of the line catches up with where it should be
// (per second): the ends at once, the middle with a visible delay.
const FOLLOW_ENDS = 90;
const FOLLOW_MIDDLE = 15;

// A cast: behind the flying float the line arches up, at most this share
// of its length. After the float lands, that bow falls onto the water.
const BOW_HEIGHT = 0.15;
const BOW_FALL_MS = 520;

// How it is drawn: a touch thicker and clearer at the rod, finer far away,
// fainter where it lies on the water.
const COLOR = 0xfbfaf2;
const WIDTH_NEAR = 1.7;
const WIDTH_FAR = 0.9;
const ALPHA_NEAR = 0.92;
const ALPHA_FAR = 0.6;
const ALPHA_ON_WATER = 0.72;

// Of a slack line, this share (from the rod) hangs in the air; it lands on
// the water this far along the way from the rod's foot to the float, and
// lies on the surface from there on. (Seen from the jetty the float is far
// away and the rod tip not high: most of the line is in the air.)
const AIR_SHARE = 0.8;
const LANDING_SHARE = 0.8;

const lerp = (a, b, t) => a + (b - a) * t;

export class FishingLine {
  constructor(scene, depth) {
    this.gfx = scene.add.graphics();
    this.gfx.setDepth(depth);
    this._time = 0;
    this._pts = null;                                   // where the line is drawn
    this._target = Array.from({ length: SEGMENTS + 1 }, () => ({ x: 0, y: 0 }));
    this._wet = new Float32Array(SEGMENTS + 1);         // 1 = this point lies on the water
    this._bow = null;                                   // bow left over from the flight...
    this._bowLeft = 0;                                  // ...and how much of it (1..0)
    this._hang = { x: 0, y: 0, px: 0, py: 0, length: HANG_LENGTH, ready: false, time: 0 };
  }

  /** Nothing to draw (and forget where the line was). */
  clear() {
    this.gfx.clear();
    this._pts = null;
    this._bow = null;
  }

  /**
   * Let the rig hang from `tip`, starting where it is now -- or, if `from`
   * is given, from there (the end of a retrieve: the spare line is wound
   * in). Call once when the hanging starts.
   */
  startHanging(tip, from = null) {
    const h = this._hang;
    h.x = from ? from.x : tip.x;
    h.y = from ? from.y : tip.y + HANG_LENGTH;
    h.px = h.x;
    h.py = h.y;
    h.length = Math.max(HANG_LENGTH, Math.hypot(h.x - tip.x, h.y - tip.y));
    h.ready = true;
  }

  /** One step of the pendulum; returns the end of the rig. */
  hang(tip, delta) {
    const h = this._hang;
    if (!h.ready) this.startHanging(tip);
    // Small fixed steps: a pendulum on a moving rod is only stable that way.
    const steps = Math.max(1, Math.min(8, Math.round(delta / 8)));
    const dt = Math.min(delta, 64) / 1000 / steps;
    for (let i = 0; i < steps; i++) {
      h.time += dt;
      h.length = Math.max(HANG_LENGTH, h.length - REEL_UP_SPEED * dt);
      const keep = Math.exp(-SWING_DAMPING * dt);
      const vx = (h.x - h.px) * keep;
      const vy = (h.y - h.py) * keep;
      h.px = h.x;
      h.py = h.y;
      h.x += vx + BREEZE * Math.sin(h.time * 0.9) * dt * dt;
      h.y += vy + GRAVITY * dt * dt;
      // The line cannot stretch: back onto the circle around the tip.
      const dx = h.x - tip.x;
      const dy = h.y - tip.y;
      const d = Math.hypot(dx, dy);
      if (d > h.length && d > 0) {
        h.x = tip.x + (dx / d) * h.length;
        h.y = tip.y + (dy / d) * h.length;
      }
    }
    return h;
  }

  /** The float has left for the water. */
  startFlight() {
    this._bow = null;
    this._bowLeft = 0;
    this._hang.ready = false;
  }

  /**
   * Work out the line's shape, move it there and draw it.
   * @param tip, end   {x, y} design coordinates
   * @param shape      see the top of this file
   */
  update(delta, tip, end, shape) {
    const dt = Math.min(delta, 64) / 1000;
    this._time += dt;
    const target = this._target;
    const wet = this._wet;
    wet.fill(0);

    for (let i = 0; i <= SEGMENTS; i++) {
      const s = i / SEGMENTS;
      target[i].x = lerp(tip.x, end.x, s);
      target[i].y = lerp(tip.y, end.y, s);
    }

    if (shape.kind === 'flight') {
      this._flightShape(tip, end, shape.t ?? 1);
    } else if (shape.kind === 'water') {
      this._waterShape(tip, end, shape);
    }

    // What is left of the bow from the cast, falling.
    if (shape.kind !== 'flight' && this._bow && this._bowLeft > 0) {
      this._bowLeft = Math.max(0, this._bowLeft - delta / BOW_FALL_MS);
      const k = this._bowLeft * this._bowLeft;            // slow at first, then it drops
      for (let i = 0; i <= SEGMENTS; i++) {
        target[i].x += this._bow[i].x * k;
        target[i].y += this._bow[i].y * k;
      }
      if (this._bowLeft === 0) this._bow = null;
    }

    // Each point trails a little behind its target.
    if (!this._pts) {
      this._pts = target.map((p) => ({ x: p.x, y: p.y }));
    } else {
      for (let i = 0; i <= SEGMENTS; i++) {
        const s = i / SEGMENTS;
        const follow = lerp(FOLLOW_ENDS, FOLLOW_MIDDLE, Math.sin(Math.PI * s));
        const k = i === 0 || i === SEGMENTS ? 1 : 1 - Math.exp(-follow * dt);
        this._pts[i].x += (target[i].x - this._pts[i].x) * k;
        this._pts[i].y += (target[i].y - this._pts[i].y) * k;
      }
    }

    this._draw(shape.tremble || 0);
  }

  /**
   * In the air behind the float. Line that has left the rod keeps going
   * where the float went: up. So while the float comes down again, the
   * line behind it arches above the straight way from rod to float.
   */
  _flightShape(tip, end, t) {
    if (!this._bow) this._bow = Array.from({ length: SEGMENTS + 1 }, () => ({ x: 0, y: 0 }));
    const height = Math.hypot(end.x - tip.x, end.y - tip.y) * BOW_HEIGHT * t * t;
    for (let i = 0; i <= SEGMENTS; i++) {
      const s = i / SEGMENTS;
      // Highest a little past the middle, toward the float.
      const arch = Math.sin(Math.PI * Math.pow(s, 1.25));
      this._bow[i].x = 0;
      this._bow[i].y = -height * arch;
      this._target[i].y += this._bow[i].y;
    }
    this._bowLeft = 1;
  }

  /**
   * On the water. `foot` is the water straight under the rod tip: a slack
   * line comes down in the air and lands on the way from there to the
   * float, then lies on the surface.
   */
  _waterShape(tip, end, shape) {
    const slack = Math.max(0, Math.min(1, shape.slack ?? 0));
    if (slack <= 0.001) return;
    const foot = shape.foot || { x: tip.x, y: end.y };
    const landX = lerp(foot.x, end.x, LANDING_SHARE);
    const landY = lerp(foot.y, end.y, LANDING_SHARE);
    // The air part: down from the tip, flattening out as it meets the water.
    const cx = lerp(tip.x, landX, 0.5);
    const cy = lerp(tip.y, landY, 0.82);
    for (let i = 0; i <= SEGMENTS; i++) {
      const s = i / SEGMENTS;
      let x;
      let y;
      if (s <= AIR_SHARE) {
        const t = s / AIR_SHARE;
        const inv = 1 - t;
        x = inv * inv * tip.x + 2 * inv * t * cx + t * t * landX;
        y = inv * inv * tip.y + 2 * inv * t * cy + t * t * landY;
        // A breath of wind in the hanging part.
        const sway = Math.sin(this._time * 2.1 + t * 2.4) * 2.4 * Math.sin(Math.PI * t);
        x += sway;
      } else {
        const t = (s - AIR_SHARE) / (1 - AIR_SHARE);
        x = lerp(landX, end.x, t);
        y = lerp(landY, end.y, t);
        // Lying on the water it rides the ripples.
        y += Math.sin(this._time * 2.6 + t * 9) * 0.9 * Math.sin(Math.PI * t);
        this._wet[i] = slack;
      }
      this._target[i].x = lerp(this._target[i].x, x, slack);
      this._target[i].y = lerp(this._target[i].y, y, slack);
    }
  }

  _draw(tremble) {
    const g = this.gfx;
    const pts = this._pts;
    g.clear();
    // A line under strain sings: a fast, tiny shiver, strongest mid-line.
    let nx = 0;
    let ny = 0;
    if (tremble > 0) {
      const dx = pts[SEGMENTS].x - pts[0].x;
      const dy = pts[SEGMENTS].y - pts[0].y;
      const d = Math.hypot(dx, dy) || 1;
      nx = -dy / d;
      ny = dx / d;
    }
    const at = (i) => {
      if (tremble <= 0) return pts[i];
      const s = i / SEGMENTS;
      const shiver = Math.sin(this._time * 88 + s * 11) * tremble * Math.sin(Math.PI * s);
      return { x: pts[i].x + nx * shiver, y: pts[i].y + ny * shiver };
    };
    let a = at(0);
    for (let i = 1; i <= SEGMENTS; i++) {
      const s = (i - 0.5) / SEGMENTS;
      const b = at(i);
      const wet = Math.max(this._wet[i - 1], this._wet[i]);
      g.lineStyle(lerp(WIDTH_NEAR, WIDTH_FAR, s), COLOR, lerp(ALPHA_NEAR, ALPHA_FAR, s) * lerp(1, ALPHA_ON_WATER, wet));
      g.beginPath();
      g.moveTo(a.x, a.y);
      g.lineTo(b.x, b.y);
      g.strokePath();
      a = b;
    }
  }
}
