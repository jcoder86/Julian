import Phaser from 'phaser';

/**
 * A hooked fish, from the strike until it lies at the landing spot.
 *
 * The reel decides how far the fish has come: 0 = where it was hooked,
 * 1 = landed. The fish decides the rest:
 *
 *   * it SWIMS while it is drawn in -- a tiddler hardly at all, a big fish
 *     all over the place: it picks a spot in the water around the way in,
 *     to one side or the other, or back out, and swims there in a curve
 *     (it has weight: it overshoots, swings round, and picks the next);
 *   * a big fish now and then makes a RUN: for a second or so it tears
 *     off -- sideways and away -- and takes back some of the line already
 *     won. Cranking through a run helps only a little. The bigger the fish,
 *     the more runs; each starts with a boil at the surface.
 *
 * Runs are planned when the fight starts, at set points along the way, so
 * their number is certain: a fight can be made longer by a big fish, but
 * never endless. They take back "a bit" -- all runs together at most
 * three tenths of the fight -- because the angler is four years old. (A
 * run also costs the second it lasts; the biggest fish, with four runs,
 * take about one and a half times as long to land as they would without.)
 *
 * `x`, `y` is where the line enters the water; the scene ties the line to
 * it. The fish itself stays out of sight (what was caught is a surprise),
 * but the water gives it away: rings spread from where the line cuts
 * through, faster and bigger during a run, and where it cuts through fast
 * it leaves a wake.
 */

// How big a fish is for its behaviour: 0 (up to POWER_FROM_CM) .. 1.
const POWER_FROM_CM = 25;
const POWER_FULL_CM = 180;

// Runs: one per CM_PER_RUN of fish, at most MAX_RUNS.
const CM_PER_RUN = 45;
const MAX_RUNS = 4;
// Each run takes back this share of the whole fight (small .. big fish)...
const RUN_TAKE_MIN = 0.05;
const RUN_TAKE_MAX = 0.09;
// ...but all runs together never more than this.
const RUN_TAKE_TOTAL = 0.3;
const RUN_MS_MIN = 700;
const RUN_MS_MAX = 1100;
// What cranking is still worth while the fish runs.
const RUN_CRANK_GAIN = 0.25;
// Runs happen between these points of the fight, and not right after one another.
const RUN_FROM = 0.18;
const RUN_UNTIL = 0.8;
const RUN_REST_MS = 900;

// Swimming: how far to the side of the way in (design px at full scale,
// small .. big fish), and how far back out it may swim; how often it picks
// a new spot (ms, small .. big fish -- a big one is restless). It steers to
// its spot like something heavy: pulled toward it (SPRING, per s^2) while
// its own speed dies away (DAMPING, per s), so it swings round in curves.
const SWIM_SIDE_MIN = 6;
const SWIM_SIDE_MAX = 330;
const SWIM_BACK_MAX = 170;
const SWIM_TURN_MS = [[1500, 2600], [700, 1500]];
const SWIM_TURN_MS_RUNNING = [300, 600];
const SWIM_SPRING = 7;
const SWIM_DAMPING = 3.2;
const SWIM_SPRING_RUNNING = 16;
// Sideways on the water is into the distance on the screen: flattened.
const SWIM_DEPTH_SHARE = 0.45;
// Faster than this (design px/s at full scale) the line leaves a wake.
const WAKE_SPEED = 70;
const WAKE_MS = 70;

const RING_MS = 520;           // one ring this often...
const RING_MS_RUNNING = 170;   // ...and during a run
const RING_DEPTH = 19;         // just under whatever is on the end of the line

export class FishFight {
  /**
   * @param scene
   * @param opts.pick        { species, size, lengthCm }
   * @param opts.reel        the ReelOverlay being cranked
   * @param opts.start       {x, y} where the fish was hooked
   * @param opts.home        {x, y} the landing spot
   * @param opts.depthScale  (y) => how big things look at that distance (0..1)
   * @param opts.isWater     (x, y) => can a fish be there?
   * @param opts.onRun       (running: boolean) => void
   */
  constructor(scene, { pick, reel, start, home, depthScale, isWater, onRun }) {
    this.scene = scene;
    this.reel = reel;
    this.start = { x: start.x, y: start.y };
    this.home = { x: home.x, y: home.y };
    this.depthScale = depthScale;
    this.isWater = isWater;
    this.onRun = onRun;
    this.x = start.x;
    this.y = start.y;
    this.running = false;

    const cm = pick.lengthCm ?? 30;
    this.power = Phaser.Math.Clamp((cm - POWER_FROM_CM) / (POWER_FULL_CM - POWER_FROM_CM), 0, 1);

    // The runs: where along the fight each one starts.
    const count = Phaser.Math.Clamp(Math.floor(cm / CM_PER_RUN), 0, MAX_RUNS);
    this._take = count
      ? Math.min(Phaser.Math.Linear(RUN_TAKE_MIN, RUN_TAKE_MAX, this.power), RUN_TAKE_TOTAL / count)
      : 0;
    this._runs = [];
    for (let i = 0; i < count; i++) {
      const jitter = Phaser.Math.FloatBetween(-0.25, 0.25);
      this._runs.push(RUN_FROM + ((i + 0.5 + jitter) / count) * (RUN_UNTIL - RUN_FROM));
    }
    this._nextRun = 0;
    this._runLeft = 0;       // ms of the current run still to go
    this._runMs = 0;
    this._rest = 0;          // ms before another run may start

    // Swimming: where it is and where it goes, as (side, back) of the way
    // in, in design px at full scale; and how fast it moves now.
    this._pos = { side: 0, back: 0 };
    this._vel = { side: 0, back: 0 };
    this._goal = { side: 0, back: 0 };
    this._turnIn = 0;        // ms until it picks a new place to swim to
    this._ringIn = RING_MS;
    this._wakeIn = 0;
  }

  /** How many runs this fish has in it (for tests and tuning). */
  get runCount() {
    return this._runs.length;
  }

  update(delta) {
    const reel = this.reel;
    if (!reel) return;
    const dt = Math.min(delta, 64);
    const p = reel.progress;

    // --- runs ---------------------------------------------------------------
    if (this.running) {
      // Fastest in the middle of the run.
      const before = this._runLeft / this._runMs;
      this._runLeft = Math.max(0, this._runLeft - dt);
      const after = this._runLeft / this._runMs;
      const ease = (t) => (1 - Math.cos(Math.PI * t)) / 2;
      reel.takeLine((ease(before) - ease(after)) * this._take);
      if (this._runLeft === 0) this._setRunning(false);
    } else {
      this._rest = Math.max(0, this._rest - dt);
      if (this._nextRun < this._runs.length && p >= this._runs[this._nextRun] && this._rest === 0) {
        this._nextRun++;
        this._runMs = Phaser.Math.Between(RUN_MS_MIN, RUN_MS_MAX);
        this._runLeft = this._runMs;
        this._setRunning(true);
      }
    }

    // --- swimming -------------------------------------------------------------
    const big = this.power;
    this._turnIn -= dt;
    if (this._turnIn <= 0) this._pickSpot();
    const spring = this.running ? SWIM_SPRING_RUNNING : SWIM_SPRING;
    const t = dt / 1000;
    for (const k of ['side', 'back']) {
      const pull = spring * (this._goal[k] - this._pos[k]) - SWIM_DAMPING * this._vel[k];
      this._vel[k] += pull * t;
      this._pos[k] += this._vel[k] * t;
    }

    // --- where the line enters the water -----------------------------------------
    const now = reel.progress;
    const bx = Phaser.Math.Linear(this.start.x, this.home.x, now);
    const by = Phaser.Math.Linear(this.start.y, this.home.y, now);
    let dx = this.home.x - this.start.x;
    let dy = this.home.y - this.start.y;
    const d = Math.hypot(dx, dy);
    if (d < 1) { dx = 0; dy = -1; } else { dx /= d; dy /= d; }
    // The closer it comes, the less line it has to swim about with.
    const room = Math.pow(1 - now, 0.45) * this.depthScale(by);
    const side = this._pos.side * room;
    const back = this._pos.back * room;
    let x = bx - dy * side - dx * back;
    let y = by + dx * side * SWIM_DEPTH_SHARE - dy * back;
    // It stays in the water: where its swim would take it onto the bank or
    // under the jetty, it turns back.
    if (!this.isWater(x, y)) {
      x = this.x;
      y = this.y;
      this._goal.side = -this._goal.side * 0.6;
      this._goal.back *= 0.3;
      this._vel.side *= -0.3;
      this._vel.back *= -0.3;
      if (!this.isWater(x, y)) {
        x = bx;
        y = by;
      }
    }
    const speed = Math.hypot(x - this.x, y - this.y) / Math.max(t, 0.001);
    const heading = Math.atan2(y - this.y, x - this.x);
    this.x = x;
    this.y = y;

    // A wake behind it where it cuts through fast.
    this._wakeIn -= dt;
    const scale = this.depthScale(y);
    if (speed > WAKE_SPEED * scale && this._wakeIn <= 0 && big > 0.15) {
      this._wakeIn = WAKE_MS;
      this._wake(x, y, heading, scale, Math.min(1, speed / (WAKE_SPEED * scale * 3)));
    }

    // --- rings on the water ---------------------------------------------------------
    this._ringIn -= dt;
    if (this._ringIn <= 0) {
      this._ringIn = this.running ? RING_MS_RUNNING : RING_MS;
      this._ring();
    }
  }

  /**
   * Where to swim next: mostly over to the other side, sometimes back out;
   * on a run, far to one side and away.
   */
  _pickSpot() {
    const big = this.power;
    const reach = Phaser.Math.Linear(SWIM_SIDE_MIN, SWIM_SIDE_MAX, big);
    const other = this._goal.side > 0 ? -1 : 1;
    if (this.running) {
      this._goal.side = other * reach * Phaser.Math.FloatBetween(0.8, 1.2);
      this._goal.back = SWIM_BACK_MAX * big * Phaser.Math.FloatBetween(0.6, 1.1);
      this._turnIn = Phaser.Math.Between(...SWIM_TURN_MS_RUNNING);
      return;
    }
    // Now and then it stays on its side and only comes closer or goes back.
    const sideways = Math.random() < 0.75 ? other : -other;
    this._goal.side = sideways * reach * Phaser.Math.FloatBetween(0.35, 1);
    this._goal.back = SWIM_BACK_MAX * big * Phaser.Math.FloatBetween(-0.4, 0.7);
    const [lo, hi] = [0, 1].map((i) => Phaser.Math.Linear(SWIM_TURN_MS[0][i], SWIM_TURN_MS[1][i], big));
    this._turnIn = Phaser.Math.Between(Math.round(lo), Math.round(hi));
  }

  _setRunning(running) {
    this.running = running;
    this.reel.resistance = running ? RUN_CRANK_GAIN : 1;
    this.reel.setStrained(running);
    if (running) {
      this._turnIn = 0;                    // it bolts: off to the side at once
      this._boil();
    } else {
      this._rest = RUN_REST_MS;
    }
    if (this.onRun) this.onRun(running);
  }

  _ring() {
    const scale = this.depthScale(this.y);
    const width = (22 + 58 * this.power) * scale * (this.running ? 1.5 : 1);
    const ring = this.scene.add.ellipse(this.x, this.y, width, width * 0.36);
    ring.setStrokeStyle(Math.max(1.5, 3 * scale), 0xffffff, 1);
    ring.setDepth(RING_DEPTH);
    this.scene.tweens.add({
      targets: ring,
      scale: { from: 0.35, to: 1.3 },
      alpha: { from: this.running ? 0.9 : 0.6, to: 0 },
      duration: 900,
      ease: 'Sine.easeOut',
      onComplete: () => ring.destroy(),
    });
  }

  /** A V of ripples left behind where the line cuts through the water. */
  _wake(x, y, heading, scale, strength) {
    const k = scale ** 0.6;
    for (const side of [-1, 1]) {
      const angle = heading + Math.PI + side * 0.42;
      const len = (26 + 44 * strength) * k;
      const sx = x + Math.cos(angle) * len * 0.35;
      const sy = y + Math.sin(angle) * len * 0.35 * SWIM_DEPTH_SHARE;
      const streak = this.scene.add.ellipse(sx, sy, len, 3.6 * k).setDepth(RING_DEPTH);
      streak.setFillStyle(0xffffff, 0.5 * strength + 0.35);
      streak.setRotation(Math.atan2(Math.sin(angle) * SWIM_DEPTH_SHARE, Math.cos(angle)));
      this.scene.tweens.add({
        targets: streak,
        x: sx + Math.cos(angle) * len * 0.5,
        y: sy + Math.sin(angle) * len * 0.5 * SWIM_DEPTH_SHARE,
        alpha: 0,
        scaleX: 1.6,
        duration: 520,
        ease: 'Quad.easeOut',
        onComplete: () => streak.destroy(),
      });
    }
  }

  /** It turns at the surface: the water boils, and splashes. */
  _boil() {
    const scale = this.depthScale(this.y);
    const k = scale ** 0.6;
    for (let i = 0; i < 3; i++) {
      this.scene.time.delayedCall(i * 80, () => {
        const width = (40 + 70 * this.power) * k;
        const ring = this.scene.add.ellipse(this.x, this.y, width, width * 0.36).setDepth(RING_DEPTH);
        ring.setStrokeStyle(Math.max(2, 3.4 * k), 0xffffff, 1);
        ring.setFillStyle();
        this.scene.tweens.add({
          targets: ring,
          scale: { from: 0.3, to: 1.5 },
          alpha: { from: 0.95, to: 0 },
          duration: 800,
          ease: 'Sine.easeOut',
          onComplete: () => ring.destroy(),
        });
      });
    }
    const drops = 5 + Math.round(6 * this.power);
    for (let i = 0; i < drops; i++) {
      const drop = this.scene.add.circle(this.x, this.y, (2 + Math.random() * 2.5) * k, 0xffffff, 0.95)
        .setDepth(RING_DEPTH + 2);
      this.scene.tweens.add({
        targets: drop,
        x: this.x + (Math.random() - 0.5) * 70 * k,
        y: { from: this.y, to: this.y - (20 + Math.random() * 40) * k, yoyo: true },
        alpha: { from: 0.95, to: 0.2 },
        duration: 300 + Math.random() * 160,
        ease: 'Quad.easeOut',
        onComplete: () => drop.destroy(),
      });
    }
  }

  destroy() {
    if (this.reel) {
      this.reel.resistance = 1;
      this.reel.setStrained(false);
    }
    this.reel = null;
  }
}
