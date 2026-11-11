import Phaser from 'phaser';

/**
 * The volcano on the big ocean's island (`volcano` in data/maps.js): now
 * and then -- every few minutes -- a modest eruption, and afterwards,
 * slowly, everything as it was.
 *
 *   warming   a few wisps of steam, a glow in the crater
 *   erupting  an ash plume rises and drifts off with the wind, glowing
 *             lumps are thrown up and fall back on the slopes, lava creeps
 *             down the gullies (each eruption a different way down)
 *   waning    the plume thins, the lava stops
 *   cooling   the lava cools from its tips back to the crater -- yellow,
 *             orange, red, dark -- the dark crust steams, then fades into
 *             the green bit by bit, tips first; the plume drifts away
 *
 * Nothing jumps back: every step fades into the next. Drawn by the game
 * over the painting (the island stands still in it): particles for smoke
 * and lumps, lines for the lava. Time runs on the scene's own clock, so an
 * eruption waits while the weighing station is shown.
 */

const W = 7;            // s warming
const E = 20;           // s erupting
const N = 15;           // s waning
const C = 70;           // s cooling and fading back
const DEPTH = 2;        // over the painting, under everything else
const STEP_PX = 1.5;    // the lava's lines are drawn from points this far apart
const CRUST = 0x2b211c; // cooled lava
const ASH = [0x5f5650, 0x8f8984, 0xc7c3bf];
const STEAM = [0xf4f4f2, 0xe2e4e6];

const clamp01 = (v) => Math.max(0, Math.min(1, v));
const lerp = (a, b, t) => a + (b - a) * t;
const mix = (c1, c2, t) => {
  const r = lerp((c1 >> 16) & 255, (c2 >> 16) & 255, t);
  const g = lerp((c1 >> 8) & 255, (c2 >> 8) & 255, t);
  const b = lerp(c1 & 255, c2 & 255, t);
  return (Math.round(r) << 16) | (Math.round(g) << 8) | Math.round(b);
};
/** Lava's colour at heat h (1 white-hot yellow .. 0 dull red). */
function lavaColour(h) {
  if (h > 0.66) return mix(0xff7a1a, 0xffd65e, (h - 0.66) / 0.34);
  if (h > 0.33) return mix(0xd43a14, 0xff7a1a, (h - 0.33) / 0.33);
  return mix(0x7a160a, 0xd43a14, h / 0.33);
}

export class Volcano {
  /**
   * @param scene
   * @param spec  { crater: {x, y}, flows: [[x, y], ...][] (design px, from
   *              the crater down a gully), firstS: [min, max], everyS:
   *              [min, max] (s between eruptions) }
   */
  constructor(scene, spec) {
    this.scene = scene;
    this.spec = spec;
    this.timeScale = 1;          // (tests)
    this.t = null;               // s since this eruption began; null: quiet
    this.wait = Phaser.Math.FloatBetween(...(spec.firstS || [40, 80]));
    makeTextures(scene);
    const { x, y } = spec.crater;
    this.lavaCrust = scene.add.graphics().setDepth(DEPTH);
    this.lavaGlow = scene.add.graphics().setDepth(DEPTH + 0.1).setBlendMode(Phaser.BlendModes.ADD);
    this.glow = scene.add.image(x, y + 1, 'volcano-glow').setDepth(DEPTH + 0.2)
      .setBlendMode(Phaser.BlendModes.ADD).setTint(0xe8380c).setAlpha(0).setScale(0.42, 0.3);
    // (Emitters at 0, 0: a particle's place is counted from its emitter's.)
    this.ash = scene.add.particles(0, 0, 'volcano-puff', {
      emitting: false,
      lifespan: { min: 7000, max: 10000 },
      speedX: { min: -2, max: 6 },
      speedY: { min: -26, max: -14 },
      accelerationX: 2.6,
      scale: { start: 0.12, end: 1.15, ease: 'Sine.easeOut' },
      alpha: { values: [0, 0.78, 0.55, 0], interpolation: 'linear' },
      color: ASH,
      rotate: { min: -40, max: 40 },
    }).setDepth(DEPTH + 0.3);
    this.steam = scene.add.particles(0, 0, 'volcano-puff', {
      emitting: false,
      lifespan: { min: 3000, max: 4500 },
      speedX: { min: -1, max: 4 },
      speedY: { min: -12, max: -6 },
      accelerationX: 1.5,
      scale: { start: 0.06, end: 0.42, ease: 'Sine.easeOut' },
      alpha: { values: [0, 0.5, 0], interpolation: 'linear' },
      color: STEAM,
      rotate: { min: -40, max: 40 },
    }).setDepth(DEPTH + 0.25);
    this.lumps = scene.add.particles(0, 0, 'volcano-ember', {
      emitting: false,
      lifespan: { min: 900, max: 1500 },
      speed: { min: 16, max: 38 },
      angle: { min: 245, max: 295 },
      gravityY: 42,
      scale: { start: 0.42, end: 0.12 },
      alpha: { values: [1, 0.9, 0], interpolation: 'linear' },
      color: [0xfff0a0, 0xff7a1a, 0x9a1e0a],
      blendMode: Phaser.BlendModes.ADD,
    }).setDepth(DEPTH + 0.35);
    this._acc = { ash: 0, steam: 0, lumps: 0, crustSteam: 0 };
    this.flows = [];
  }

  /** Start one now (it would anyway, sooner or later). */
  erupt() {
    if (this.t != null) return;
    this.t = 0;
    // Each eruption finds its own ways down: some gullies, so far.
    const all = this.spec.flows.map((points) => resample(points));
    Phaser.Utils.Array.Shuffle(all);
    const count = Phaser.Math.Between(Math.min(2, all.length), all.length);
    this.flows = all.slice(0, count).map((path) => {
      const reach = Phaser.Math.FloatBetween(0.4, 0.8);
      const delay = Phaser.Math.FloatBetween(0, 4);
      const length = path[path.length - 1].s * reach;
      return { path, length, delay, speed: length / (E - delay) };
    });
    if (this.scene.events) this.scene.events.emit('volcano-erupts');
  }

  update(delta) {
    const dt = Math.min(delta, 100) / 1000 * this.timeScale;
    if (this.t == null) {
      this.wait -= dt;
      if (this.wait <= 0) this.erupt();
      return;
    }
    this.t += dt;
    const t = this.t;
    const { x, y } = this.spec.crater;

    // The glow in the crater.
    let glow = 0;
    if (t < W) glow = 0.5 * (t / W);
    else if (t < W + E) glow = 0.82 + 0.18 * Math.sin(t * 9) * Math.sin(t * 3.3);
    else if (t < W + E + N) glow = lerp(0.82, 0.15, (t - W - E) / N);
    else glow = 0.15 * clamp01(1 - (t - W - E - N) / 10);
    this.glow.setAlpha(glow * 0.6);

    // Smoke, steam and glowing lumps, as many as the moment wants.
    let ash = 0;
    let steam = 0;
    let lumps = 0;
    if (t < W) steam = 0.8;
    else if (t < W + E) { ash = 5.5; lumps = 4 + 3 * Math.max(0, Math.sin(t * 1.7)); }
    // (Thinning, but as one column: fewer puffs would come apart in beads.)
    else if (t < W + E + N) ash = lerp(5.5, 2.2, (t - W - E) / N);
    else if (t < W + E + N + 20) steam = 0.5;
    this._emit('ash', ash, dt, () => this.ash.emitParticleAt(x + Phaser.Math.Between(-3, 3), y));
    this._emit('steam', steam, dt, () => this.steam.emitParticleAt(x + Phaser.Math.Between(-3, 3), y));
    this._emit('lumps', lumps, dt, () => this.lumps.emitParticleAt(x + Phaser.Math.Between(-2, 2), y));

    this._drawLava(t, dt);

    if (t > W + E + N + C) {
      this.t = null;
      this.flows = [];
      this.lavaCrust.clear();
      this.lavaGlow.clear();
      this.glow.setAlpha(0);
      this.wait = Phaser.Math.FloatBetween(...(this.spec.everyS || [170, 290]));
    }
  }

  _emit(kind, perSecond, dt, fn) {
    this._acc[kind] += perSecond * dt;
    while (this._acc[kind] >= 1) {
      this._acc[kind] -= 1;
      fn();
    }
    if (perSecond <= 0) this._acc[kind] = 0;
  }

  /**
   * The lava: crawling down while the volcano is fed, then cooling from its
   * tip back to the crater -- glowing less and less -- and its dark crust
   * fading into the green, tips first.
   */
  _drawLava(t, dt) {
    const crust = this.lavaCrust;
    const glow = this.lavaGlow;
    crust.clear();
    glow.clear();
    const fedUntil = W + E;
    const tau = t - fedUntil;          // s since the lava stopped coming
    let steamy = [];
    for (const flow of this.flows) {
      const since = t - W - flow.delay;
      if (since <= 0) continue;
      const head = Math.min(flow.length, Math.min(since, E - flow.delay) * flow.speed);
      const { path } = flow;
      for (let i = 1; i < path.length && path[i].s <= head; i++) {
        const a = path[i - 1];
        const b = path[i];
        const along = b.s / Math.max(1, flow.length);         // 0 at the crater, 1 at the tip
        let heat = 1;
        let crustAlpha = 0.85;
        if (tau > 0) {
          const coolS = 6 + 26 * (1 - along) ** 0.8;           // the tip cools first
          heat = clamp01(1 - tau / coolS) ** 1.5;
          crustAlpha = 0.85 * clamp01(1 - (tau - coolS - 8) / 30);
          if (heat > 0.03 && heat < 0.6) steamy.push(b);
        } else {
          // Brightest at the creeping front and at the crater, a darker
          // red in between where a skin forms; a flicker all along.
          const front = clamp01(1 - (head - b.s) / 7);
          heat = 0.55 + 0.15 * (1 - along) + 0.25 * front + 0.06 * Math.sin(t * 7 + b.s * 0.9);
        }
        heat *= Math.min(1, b.s / 2 + 0.6);
        const width = 1.3 + 0.7 * along;
        if (crustAlpha > 0.01) {
          crust.lineStyle(width + 0.7, CRUST, crustAlpha);
          crust.lineBetween(a.x, a.y, b.x, b.y);
        }
        if (heat > 0.01) {
          const colour = lavaColour(heat);
          glow.lineStyle(width * 2.8, colour, 0.2 * Math.min(1, heat * 1.3));
          glow.lineBetween(a.x, a.y, b.x, b.y);
          glow.lineStyle(width, colour, Math.min(1, heat * 1.3));
          glow.lineBetween(a.x, a.y, b.x, b.y);
        }
      }
    }
    // Cooling lava steams.
    if (steamy.length) {
      this._emit('crustSteam', 1.4, dt, () => {
        const p = steamy[Math.floor(Math.random() * steamy.length)];
        this.steam.emitParticleAt(p.x, p.y);
      });
    }
  }

  destroy() {
    for (const obj of [this.lavaCrust, this.lavaGlow, this.glow, this.ash, this.steam, this.lumps]) obj.destroy();
  }
}

/**
 * A gully's line as points every STEP_PX, each with its distance from the
 * crater, wandering a little (lava does not run straight).
 */
function resample(points) {
  const out = [];
  let s = 0;
  const phase = Math.random() * 10;
  for (let i = 1; i < points.length; i++) {
    const [x0, y0] = points[i - 1];
    const [x1, y1] = points[i];
    const len = Math.hypot(x1 - x0, y1 - y0);
    const nx = -(y1 - y0) / len;
    const ny = (x1 - x0) / len;
    for (let d = 0; d < len; d += STEP_PX) {
      const f = d / len;
      const wander = Math.sin((s + d) * 0.35 + phase) * 0.7 + Math.sin((s + d) * 0.11 + phase * 2) * 0.9;
      out.push({ x: x0 + (x1 - x0) * f + nx * wander, y: y0 + (y1 - y0) * f + ny * wander, s: s + d });
    }
    s += len;
  }
  const [lx, ly] = points[points.length - 1];
  out.push({ x: lx, y: ly, s });
  return out;
}

/** Soft smoke, a glow, a spark: made once, on canvases. */
function makeTextures(scene) {
  const tex = scene.textures;
  if (!tex.exists('volcano-puff')) {
    const c = tex.createCanvas('volcano-puff', 64, 64);
    const ctx = c.getContext();
    // A billow: soft round lumps around the middle.
    let seed = 7;
    const rnd = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
    for (let i = 0; i < 11; i++) {
      const a = rnd() * Math.PI * 2;
      const d = rnd() * 12;
      const r = 9 + rnd() * 9;
      const cx = 32 + Math.cos(a) * d;
      const cy = 32 + Math.sin(a) * d;
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
      g.addColorStop(0, 'rgba(255,255,255,0.55)');
      g.addColorStop(0.6, 'rgba(255,255,255,0.25)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
    }
    c.refresh();
  }
  if (!tex.exists('volcano-glow')) {
    const c = tex.createCanvas('volcano-glow', 64, 64);
    const ctx = c.getContext();
    const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.35, 'rgba(255,255,255,0.45)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 64, 64);
    c.refresh();
  }
  if (!tex.exists('volcano-ember')) {
    const c = tex.createCanvas('volcano-ember', 16, 16);
    const ctx = c.getContext();
    const g = ctx.createRadialGradient(8, 8, 0, 8, 8, 8);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.45, 'rgba(255,255,255,0.7)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 16, 16);
    c.refresh();
  }
}
