import Phaser from 'phaser';

/**
 * A hooked fish, from the strike until it lies at the landing spot.
 *
 * The reel decides how far the fish has come: 0 = where it was hooked,
 * 1 = landed. The fish decides the rest:
 *
 *   * it SWIMS from side to side while it is drawn in -- a tiddler hardly
 *     at all, a big fish in wide sweeps;
 *   * a big fish now and then makes a RUN: for a second or so it tears
 *     off and takes back some of the line already won. Cranking through a
 *     run helps only a little. The bigger the fish, the more runs.
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
 * through, faster and bigger during a run.
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

// Swimming from side to side: design px at full scale (small .. big fish).
const SWIM_MIN = 5;
const SWIM_MAX = 115;
// Up and down the screen is into the distance: flattened.
const SWIM_DEPTH_SHARE = 0.45;

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

    // Swimming.
    this._side = 0;          // where it is, to the side of the straight way in
    this._sideTarget = 0;
    this._turnIn = 0;        // ms until it picks a new place to swim to
    this._ringIn = RING_MS;
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
    const reach = Phaser.Math.Linear(SWIM_MIN, SWIM_MAX, this.power);
    this._turnIn -= dt;
    if (this._turnIn <= 0) {
      // Mostly to the other side, now and then not quite.
      const other = this._sideTarget > 0 ? -1 : 1;
      this._sideTarget = other * reach * Phaser.Math.FloatBetween(0.4, 1) * (this.running ? 1.25 : 1);
      this._turnIn = this.running
        ? Phaser.Math.Between(350, 700)
        : Phaser.Math.Between(800, 1800) * (1.25 - 0.45 * this.power);
    }
    const quick = this.running ? 3.8 : 2.2;
    this._side += (this._sideTarget - this._side) * (1 - Math.exp(-quick * dt / 1000));

    // --- where the line enters the water -----------------------------------------
    const now = reel.progress;
    const bx = Phaser.Math.Linear(this.start.x, this.home.x, now);
    const by = Phaser.Math.Linear(this.start.y, this.home.y, now);
    let dx = this.home.x - this.start.x;
    let dy = this.home.y - this.start.y;
    const d = Math.hypot(dx, dy);
    if (d < 1) { dx = 0; dy = -1; } else { dx /= d; dy /= d; }
    // The closer it comes, the less line it has to swim about with.
    const room = Math.pow(1 - now, 0.6) * this.depthScale(by);
    let x = bx - dy * this._side * room;
    let y = by + dx * this._side * room * SWIM_DEPTH_SHARE;
    // It stays in the water: where its sweep would take it onto the bank
    // or under the jetty, it turns back early.
    if (!this.isWater(x, y)) {
      x = bx;
      y = by;
      this._sideTarget = -this._sideTarget * 0.6;
      this._side *= 0.5;
    }
    this.x = x;
    this.y = y;

    // --- rings on the water ---------------------------------------------------------
    this._ringIn -= dt;
    if (this._ringIn <= 0) {
      this._ringIn = this.running ? RING_MS_RUNNING : RING_MS;
      this._ring();
    }
  }

  _setRunning(running) {
    this.running = running;
    this.reel.resistance = running ? RUN_CRANK_GAIN : 1;
    this.reel.setStrained(running);
    if (running) {
      this._turnIn = 0;                    // it bolts: off to the side at once
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

  destroy() {
    if (this.reel) {
      this.reel.resistance = 1;
      this.reel.setStrained(false);
    }
    this.reel = null;
  }
}
