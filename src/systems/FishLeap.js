import Phaser from 'phaser';

/**
 * A fish leaping out of the sea -- not a stiff picture turning along an
 * arc, but its picture bent along a curve (a Phaser Rope): it comes up out
 * of the water with its body following its own path, arches over, dives
 * back in head first, and beats its tail all the while. What is under the
 * surface is not drawn (a mask: the water line is sharp, and white water
 * covers it); only a faint dark shape of it shows through the water.
 *
 * Every species leaps its own way (`LEAP_SPECIES`):
 *   arc       a ballistic leap: up, over, down (the dorado low and twice,
 *             the mako highest of all)
 *   tailwalk  the billfish: up on its tail, "walking" across the water and
 *             shaking its head, then falling over forward
 *   breach    the white shark and the orca: straight up out of the sea,
 *             turning over at the top and crashing back on its side
 *   glide     the manta: a flat flight, flapping, and a belly flop
 *   photo     the last, slow leap beside the boat, frozen at its top by
 *             the camera flash (every species)
 *
 * The movements are worked out for a fish one unit long, leaping to the
 * right from the point where it breaks the water (y down, as on screen);
 * `FishBody` scales and mirrors them.
 *
 * Needs WebGL (a Rope is not drawn on a canvas renderer): see `canBend`.
 */

const N = 26;                         // points along the body
const SHADOW = 0x06202e;              // the shape seen through the water
const SHADOW_ALPHA = 0.3;
const SPRAY_EVERY_MS = 50;            // white water where the body cuts the surface
const DRIP_EVERY_MS = 45;             // water running off it in the air
const LINE_IN_MS = 120;               // the line goes to its mouth once out...
const LINE_BACK_MS = 380;             // ...and back to where it swims once it is under again

/** How each species leaps (anything not listed: DEFAULT). */
const DEFAULT = { jump: 'arc', span: 1.9, height: 0.6, bend: 1, mouth: 0.95, wiggle: 0.035 };
export const LEAP_SPECIES = {
  mahimahi:   { span: 2.1, height: 0.45, again: 0.55 },        // low and fast, often twice
  mako:       { span: 1.45, height: 1.1 },                     // the highest leaper of all
  sailfish:   { jump: 'tailwalk', mouth: 0.84 },
  bluemarlin: { jump: 'tailwalk', mouth: 0.82 },
  swordfish:  { jump: 'tailwalk', mouth: 0.72 },
  whiteshark: { jump: 'breach' },
  orca:       { jump: 'breach', wiggle: 0.07 },                // its flukes beat up and down
  mantaray:   { jump: 'glide', bend: 0, flap: 0.32, mouth: 0.97 },   // drawn from above
  sunfish:    { bend: 0.3 },
  anglerfish: { bend: 0.6 },
  grouper:    { bend: 0.7 },
  whaleshark: { bend: 0.7 },
};
export function leapSpecies(id) {
  return { ...DEFAULT, ...(LEAP_SPECIES[id] || {}) };
}

/** Can this game bend pictures? (WebGL; on a canvas renderer it cannot.) */
export function canBend(scene) {
  return scene.sys.renderer && scene.sys.renderer.type === Phaser.WEBGL;
}

const clamp01 = (v) => Math.max(0, Math.min(1, v));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (t) => { const c = clamp01(t); return c * c * (3 - 2 * c); };

/**
 * The body's centre line for a pose, in units of its length: N points
 * {x, y, a} from tail (u = 0) to head (u = 1), a = the direction there.
 *   x, y    where the anchor point is
 *   at      which point that is: 0 the tail, 0.5 the middle
 *   angle   the body's direction at the anchor (head to the right: 0)
 *   arch    how much it bends (1/length; > 0: back humped up)
 *   wiggle, wave   the tail beat: how far, and where in its swing
 */
function centreLine(pose, out) {
  const { x, y, angle, arch = 0, at = 0.5, wiggle = 0, wave = 0 } = pose;
  const sinA = Math.sin(angle);
  const cosA = Math.cos(angle);
  for (let i = 0; i < N; i++) {
    const u = i / (N - 1);
    const d = u - at;
    let px;
    let py;
    let a = angle;
    if (Math.abs(arch) < 1e-4) {
      px = x + d * cosA;
      py = y + d * sinA;
    } else {
      a = angle + arch * d;
      px = x + (Math.sin(a) - sinA) / arch;
      py = y + (cosA - Math.cos(a)) / arch;
    }
    const w = wiggle * (1 - u) ** 2 * Math.sin(wave - u * 4);
    const p = out[i];
    p.x = px + Math.sin(a) * w;
    p.y = py - Math.cos(a) * w;
    p.a = a;
  }
  return out;
}
const newLine = () => Array.from({ length: N }, () => ({ x: 0, y: 0, a: 0 }));

// ---------------------------------------------------------------------------
// The leaps, for a fish one unit long. Each: { ms, pose(p, ms), big }.
// ---------------------------------------------------------------------------

/** Up, over and down along a parabola, the body following its path. */
function ballistic({ span, height, bend, wiggle, flat = 1, flap = 0 }, lengthPx) {
  const D = span;
  const h = height;
  const tangent = (t) => Math.atan2(-4 * h * (1 - 2 * t), D);
  const curve = (t) => (8 * h * D) / ((D * D + (4 * h * (1 - 2 * t)) ** 2) ** 1.5);
  const at = (t, ms) => ({
    x: D * t,
    y: -4 * h * t * (1 - t),
    angle: flat * tangent(t),
    // (Following its path, but stiffer: a high, narrow leap would fold it double.)
    arch: bend * 0.75 * Math.min(curve(t), 1.5) * flat,
    wiggle,
    wave: (ms / 1000) * Math.PI * 2 * 5,
    thick: flap ? 1 - flap * (0.5 + 0.5 * Math.sin((ms / 1000) * Math.PI * 2 * 2.4)) : 1,
  });
  // From where it is still all under water to where it is again.
  const line = newLine();
  let t0 = 0;
  while (t0 > -1 && centreLine(at(t0, 0), line).some((q) => q.y < 0.04)) t0 -= 0.01;
  const t1 = 1 - t0 + 0.02;
  const air = Phaser.Math.Clamp(560 + 0.8 * lengthPx, 700, 1200) * Math.sqrt(h / 0.6);
  return {
    ms: air * (t1 - t0),
    pose: (p, ms) => at(lerp(t0, t1, p), ms),
    big: !!flap,
  };
}

/** Straight up out of the sea, turning over at the top, crashing back. */
function breach({ wiggle }, lengthPx) {
  const H = 0.62;          // the middle of the body this far above the water at the top
  const D = 0.55;          // and this far forward over the whole leap
  const start = 0.62;      // how deep its middle is at the start...
  const end = 0.5;         // ...and at the end
  const r = Math.sqrt((H + end) / (H + start));
  const top = 1 / (1 + r);
  const K = (H + start) / (top * top);
  return {
    ms: Phaser.Math.Clamp(1250 + 0.9 * lengthPx, 1500, 2000),
    pose: (p, ms) => ({
      x: D * p,
      y: -H + K * (p - top) ** 2,
      angle: lerp(-1.35, 0.45, smooth((p - 0.12) / 0.78)),
      arch: 0.3 * Math.sin(Math.PI * p),
      wiggle: wiggle * (1.4 - p),
      wave: (ms / 1000) * Math.PI * 2 * 3,
    }),
    big: true,
  };
}

/** The billfish's dance: up on its tail across the water, then over. */
function tailwalk({ wiggle }) {
  const ms = 2300;
  const rise = 0.2;
  const walk = 0.72;
  const shakeHz = 3.2;
  const walkAt = (p, msNow) => {
    const q = (p - rise) / (walk - rise);
    const s = msNow / 1000;
    const shake = smooth(q / 0.15);
    return {
      x: 0.1 + 1.1 * q,
      y: 0.22 + 0.04 * Math.sin(s * Math.PI * 2 * 4),
      angle: -1.12 + shake * 0.2 * Math.sin(s * Math.PI * 2 * shakeHz),
      arch: 0.12 + shake * 0.55 * Math.sin(s * Math.PI * 2 * shakeHz + 1.2),
    };
  };
  const fallFrom = walkAt(walk, walk * ms);
  return {
    ms,
    pose: (p, msNow) => {
      const wave = (msNow / 1000) * Math.PI * 2 * 6;
      if (p < rise) {
        const q = 1 - (1 - p / rise) ** 3;
        return { x: 0.1 * q, y: lerp(1.08, 0.22, q), angle: lerp(-1.3, -1.12, q), arch: 0.12,
                 at: 0, wiggle: wiggle * 1.6, wave };
      }
      if (p < walk) return { ...walkAt(p, msNow), at: 0, wiggle: wiggle * 1.6, wave };
      const q = ((p - walk) / (1 - walk)) ** 2;
      return {
        x: fallFrom.x + 0.3 * q,
        y: lerp(fallFrom.y, 0.32, q),
        angle: lerp(fallFrom.angle, 0.55, q),
        arch: lerp(fallFrom.arch, 0.25, q),
        at: 0, wiggle, wave,
      };
    },
    big: false,
  };
}

/** The last leap: slowly up out of the water, arched, frozen at the top. */
function photo({ bend, wiggle, flap = 0 }, aspect) {
  const atEnd = { x: 0.12, y: 0, angle: -0.42, arch: 0.55 * bend, wiggle: wiggle * 0.3, wave: 0 };
  // At the top its lowest point (the tail, or the belly of a round one) is
  // just clear of the water.
  const half = aspect / 2;
  const low = Math.max(...centreLine(atEnd, newLine()).map((q) => q.y + half * Math.abs(Math.cos(q.a))));
  const topY = -(low + 0.05);
  return {
    ms: 2100,
    pose: (p, ms) => ({
      x: 0.12 * p,
      y: lerp(0.62, topY, p),
      angle: lerp(-0.95, atEnd.angle, p),
      arch: lerp(0.2 * bend, atEnd.arch, p),
      wiggle: wiggle * lerp(1.6, 0.3, p),
      wave: (ms / 1000) * Math.PI * 2 * 4,
      thick: flap ? 1 - flap * (0.5 + 0.5 * Math.sin((ms / 1000) * Math.PI * 2 * 1.6)) : 1,
    }),
    big: false,
  };
}

/**
 * The leap `kind` ('photo' or the species' own) for a fish `lengthPx` long
 * whose picture is `aspect` (height / width).
 */
export function planLeap(speciesId, kind, lengthPx, aspect = 0.4) {
  const sp = leapSpecies(speciesId);
  const which = kind || sp.jump;
  if (which === 'photo') return photo(sp, aspect);
  if (which === 'tailwalk') return tailwalk(sp);
  if (which === 'breach') return breach(sp, lengthPx);
  if (which === 'glide') {
    return ballistic({ span: 1.5, height: 0.8, bend: 0, wiggle: 0, flat: 0.4, flap: sp.flap }, lengthPx);
  }
  return ballistic(sp, lengthPx);
}

/**
 * Where a leap goes, in units of the fish's length, counting only what is
 * out of the water: { left, right, top } (x from the point where it breaks
 * the water, top < 0). `aspect` is the picture's height / width.
 */
export function leapExtent(plan, aspect) {
  const line = newLine();
  let left = Infinity;
  let right = -Infinity;
  let top = 0;
  for (let i = 0; i <= 60; i++) {
    const p = i / 60;
    const pose = plan.pose(p, p * plan.ms);
    const half = (aspect / 2) * (pose.thick ?? 1);
    for (const q of centreLine(pose, line)) {
      if (q.y - half > 0.02) continue;          // under water
      left = Math.min(left, q.x - half);
      right = Math.max(right, q.x + half);
      top = Math.min(top, q.y - half);
    }
  }
  if (left === Infinity) { left = 0; right = 0; }
  return { left, right, top };
}

/**
 * A fish's picture bent along a curve: one Rope above the water, and a
 * dark one for what shows through it below.
 */
export class FishBody {
  /**
   * @param scene
   * @param key       the fish's texture (head to the right)
   * @param opts.length   how long it is drawn, px
   * @param opts.dir      1: it leaps to the right, -1: to the left
   * @param opts.x, opts.y  where it breaks the water
   * @param opts.isWater  (x, y) => is there water (for the shape below it)
   * @param opts.depth    its depth in the scene
   * @param opts.mouth    where along it its mouth is (0 tail .. 1 head)
   */
  constructor(scene, key, { length, dir, x, y, isWater, depth, mouth = 0.95 }) {
    this.scene = scene;
    this.length = length;
    this.dir = dir;
    this.x0 = x;
    this.waterY = y;
    this.isWater = isWater;
    this.mouthAt = mouth;
    const pts = Array.from({ length: N }, (_, i) => ({ x: i, y: 0 }));
    this.air = scene.add.rope(0, 0, key, null, pts).setDepth(depth);
    this.under = scene.add.rope(0, 0, key, null, pts).setDepth(5);
    this.under.setTintFill(true);
    this.under.setColors(SHADOW);
    if (dir < 0) {
      // Mirrored: running right to left its picture would be upside down.
      this.air.flipY = true;
      this.under.flipY = true;
    }
    // The water line: above it the fish, below it only its shape.
    this.surface = scene.make.graphics({}, false);
    this.surface.fillStyle(0xffffff, 1);
    this.surface.fillRect(-4000, -4000, 9000, y + 4000);
    this.air.setMask(this.surface.createGeometryMask());
    const below = this.surface.createGeometryMask();
    below.setInvertAlpha(true);
    this.under.setMask(below);
    const frame = this.air.frame;
    this.half = (frame.height / 2) * (length / frame.width);
    this.line = newLine();
    this.points = Array.from({ length: N }, () => ({ x: 0, y: 0 }));
    this.crossings = [];
  }

  /**
   * Put it in a pose (see centreLine; units of its length). `shadow`: how
   * much of its shape under the water shows (0..1).
   */
  pose(pose, shadow = 1) {
    const L = this.length;
    const dir = this.dir;
    const half = this.half * (pose.thick ?? 1);
    centreLine(pose, this.line);
    const air = this.air;
    const under = this.under;
    const wy = this.waterY;
    this.crossings.length = 0;
    let prev = null;
    for (let i = 0; i < N; i++) {
      const q = this.line[i];
      const px = this.x0 + dir * q.x * L;
      const py = wy + q.y * L;
      const a = dir > 0 ? q.a : Math.PI - q.a;
      const nx = Math.sin(a) * half;
      const ny = -Math.cos(a) * half;
      const v = i * 4;
      for (const rope of [air, under]) {
        rope.vertices[v] = px + nx;
        rope.vertices[v + 1] = py + ny;
        rope.vertices[v + 2] = px - nx;
        rope.vertices[v + 3] = py - ny;
      }
      // Its shape under the water fades with depth (and never shows on
      // the boat).
      for (let k = 0; k < 2; k++) {
        const vx = under.vertices[v + k * 2];
        const vy = under.vertices[v + k * 2 + 1];
        const deep = clamp01(1 - (vy - wy) / (0.5 * L));
        under.alphas[i * 2 + k] = shadow > 0 && this.isWater(vx, vy) ? SHADOW_ALPHA * shadow * deep : 0;
      }
      const point = this.points[i];
      point.x = px;
      point.y = py;
      if (prev && (prev.y < wy) !== (py < wy)) {
        const f = (wy - prev.y) / (py - prev.y);
        this.crossings.push(prev.x + (px - prev.x) * f);
      }
      prev = point;
    }
    air.dirty = false;
    under.dirty = false;
  }

  /** A point along it (0 tail .. 1 head), on screen. */
  at(u) {
    const f = u * (N - 1);
    const i = Math.min(N - 2, Math.floor(f));
    const t = f - i;
    const a = this.points[i];
    const b = this.points[i + 1];
    return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
  }

  get head() { return this.points[N - 1]; }
  get mouth() { return this.at(this.mouthAt); }
  /** Is anything of it out of the water? */
  get airborne() { return this.points.some((p) => p.y < this.waterY - 2); }

  destroy() {
    this.air.destroy();
    this.under.destroy();
    this.surface.destroy();
  }
}

/**
 * One leap, start to end: the body, its pose over time, the white water
 * where it breaks the surface, the drips, the splashes, and where the
 * fishing line should go.
 */
export class FishLeap {
  /**
   * @param scene
   * @param opts.key, length, dir, x, y, isWater, depth   see FishBody
   * @param opts.species   its id (how it leaps, where its mouth is)
   * @param opts.kind      'photo' for the last leap; else its own way
   * @param opts.ease      the tween ease (the leaps themselves are timed: 'Linear')
   * @param opts.keep      stay at the last pose when done (the photo)
   * @param opts.onSpray   (x, y, strength, depth) white water (in front of it)
   * @param opts.onSplash  (x, y, { big, from, to }) it breaks out of or crashes into the water
   * @param opts.onDrip    (x, y) a drop falling off it
   * @param opts.onPose    (leap) after every new pose
   * @param opts.onDone    (leap) at the end
   */
  constructor(scene, opts) {
    this.scene = scene;
    this.opts = opts;
    const sp = leapSpecies(opts.species);
    this.plan = opts.plan || planLeap(opts.species, opts.kind, opts.length);
    this.body = new FishBody(scene, opts.key, { ...opts, mouth: sp.mouth });
    this.lineWeight = 0;
    this._out = false;
    this._in = false;
    this._sprayIn = 0;
    this._dripIn = 0;
    this._last = 0;
    this.done = false;
    // (Gone with the scene, if that closes first: the water line is not
    // in the scene's display list.)
    this._onShutdown = () => this.destroy();
    scene.events.once('shutdown', this._onShutdown);
    this._step(0);
    this.tween = scene.tweens.addCounter({
      from: 0, to: 1, duration: this.plan.ms, ease: opts.ease || 'Linear',
      onUpdate: (tw) => this._step(tw.getValue()),
      onComplete: () => this._finish(),
    });
  }

  get mouth() { return this.body ? this.body.mouth : null; }

  _step(p) {
    const ms = p * this.plan.ms;
    const dt = Math.max(0, Math.min(64, ms - this._last));
    this._last = ms;
    const body = this.body;
    // (Its shape under the water comes and goes softly.)
    body.pose(this.plan.pose(p, ms), smooth(p / 0.08) * (1 - smooth((p - 0.8) / 0.2)));
    const wy = body.waterY;
    const o = this.opts;

    // Out of the water, and back in.
    const head = body.head;
    const headOut = head.y < wy - 2;
    if (headOut && !this._out) {
      this._out = true;
      if (o.onSplash) o.onSplash(head.x, wy, { big: false });
    } else if (!headOut && this._out && !this._in && p > 0.3) {
      this._in = true;
      this.entryX = head.x;
      const xs = body.points.filter((q) => q.y > wy - body.half * 2).map((q) => q.x);
      if (o.onSplash) o.onSplash(head.x, wy, { big: this.plan.big, from: Math.min(...xs), to: Math.max(...xs) });
    }

    // The line: to its mouth while that is out, then back to where it swims.
    const m = body.mouth;
    if (m.y < wy && !this._in) this.lineWeight = Math.min(1, this.lineWeight + dt / LINE_IN_MS);
    else if (this._in || m.y >= wy) this.lineWeight = Math.max(0, this.lineWeight - dt / LINE_BACK_MS);

    // White water where it cuts the surface, drops falling off it.
    this._sprayIn -= dt;
    if (this._sprayIn <= 0 && body.crossings.length && o.onSpray) {
      this._sprayIn = SPRAY_EVERY_MS;
      for (const x of body.crossings) o.onSpray(x, wy, 0.9, (o.depth ?? 23) + 1);
    }
    this._dripIn -= dt;
    if (this._dripIn <= 0 && o.onDrip && body.airborne) {
      this._dripIn = DRIP_EVERY_MS;
      const q = body.at(Math.random() ** 1.6);     // mostly from the tail end
      if (q.y < wy - 6) o.onDrip(q.x + Phaser.Math.Between(-4, 4), q.y);
    }
    if (o.onPose) o.onPose(this);
  }

  _finish() {
    this.done = true;
    this.tween = null;
    if (!this.opts.keep) this.destroy();
    if (this.opts.onDone) this.opts.onDone(this);
  }

  destroy() {
    if (this.tween) {
      this.tween.remove();
      this.tween = null;
    }
    if (this.body) {
      this.body.destroy();
      this.body = null;
    }
    if (this._onShutdown) {
      this.scene.events.off('shutdown', this._onShutdown);
      this._onShutdown = null;
    }
  }
}
