import Phaser from 'phaser';

/**
 * What a place sounds like, besides the music: birdsong at the moat, waves
 * at the pier, and now and then something passing -- a fish jumping, church
 * bells far off, gulls, a ship's horn. A map says what it has in its
 * `ambience` (src/data/maps.js):
 *
 *   bed      one sound that goes round and round under everything
 *   passing  sounds that come by at random moments
 *
 * The files are assets/audio/ambience/<name>.mp3 (scripts/make_ambience.py).
 * A sound that is not there is simply not heard.
 *
 * The bed is not played with a plain loop: each round starts a moment
 * before the previous one ends and the two are faded into each other. An
 * mp3 has a sliver of silence at its ends (and iOS does not always hide
 * it), which in a plain loop would tick every twenty seconds.
 *
 * It keeps time by the game's own clock, not the scene's: the fishing scene
 * sleeps while a caught fish is shown, and the birds should sing on.
 */

// How long two rounds of the bed overlap (and how long the bed takes to
// come in at the start), in seconds.
const CROSSFADE_S = 1.8;
// After a long pause (the app was in the background) time must not be
// "caught up" in one step.
const MAX_STEP_S = 0.25;

export function ambienceKey(name) { return `amb-${name}`; }
export function ambiencePath(name) { return `audio/ambience/${name}.mp3`; }

/** The names of all sounds the given maps use, each once (for the loader). */
export function ambienceNames(maps) {
  const names = new Set();
  for (const map of maps) {
    const spec = map.ambience;
    if (!spec) continue;
    if (spec.bed) names.add(spec.bed.name);
    for (const passing of spec.passing || []) names.add(passing.name);
  }
  return [...names];
}

const between = ([low, high]) => low + Math.random() * (high - low);

export class Ambience {
  /**
   * Starts at once. Stops by itself when `scene` shuts down.
   * @param {Phaser.Scene} scene
   * @param {object} spec  a map's `ambience`, or nothing
   */
  constructor(scene, spec) {
    this.scene = scene;
    this.spec = spec || {};
    this._rounds = [];           // the bed: [{ sound, age, length }]
    this._passing = (this.spec.passing || []).map((p) => ({
      spec: p,
      wait: between(p.first || p.every),
    }));
    this._stopped = false;

    this._startRound();
    this._tick = (_time, delta) => this._update(Math.min(delta / 1000, MAX_STEP_S));
    scene.game.events.on(Phaser.Core.Events.STEP, this._tick);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.stop());
  }

  stop() {
    if (this._stopped) return;
    this._stopped = true;
    this.scene.game.events.off(Phaser.Core.Events.STEP, this._tick);
    for (const round of this._rounds) this._end(round);
    this._rounds = [];
  }

  _end(round) {
    try {
      round.sound.stop();
      round.sound.destroy();
    } catch (e) { /* already gone with the scene */ }
  }

  /** One more round of the bed, silent at first: _update fades it in. */
  _startRound() {
    const bed = this.spec.bed;
    if (!bed) return;
    const key = ambienceKey(bed.name);
    if (!this.scene.cache.audio.exists(key)) return;
    try {
      const sound = this.scene.sound.add(key, { volume: 0 });
      sound.play();
      this._rounds.push({ sound, age: 0, length: sound.totalDuration || sound.duration || 0 });
    } catch (e) {
      console.warn(`[Ambience] could not play ${key}`, e);
    }
  }

  _update(dt) {
    if (this._stopped) return;

    // The bed: every round swells in, holds, and ebbs away as the next
    // one swells in over it.
    const bed = this.spec.bed;
    if (bed && this._rounds.length) {
      const newest = this._rounds[this._rounds.length - 1];
      for (const round of this._rounds) {
        round.age += dt;
        const fade = Phaser.Math.Clamp(
          Math.min(round.age, round.length - round.age) / CROSSFADE_S, 0, 1);
        // Equal power: two overlapping rounds together stay as loud as one.
        round.sound.setVolume(bed.volume * Math.sin(fade * Math.PI / 2));
      }
      if (newest.length > CROSSFADE_S * 2 && newest.age >= newest.length - CROSSFADE_S) {
        this._startRound();
      }
      while (this._rounds.length && this._rounds[0].age >= this._rounds[0].length) {
        this._end(this._rounds.shift());
      }
    } else if (bed && !this.scene.sound.locked) {
      // Nothing playing (the file arrived late, or sound was still locked).
      this._startRound();
    }

    // What passes by.
    for (const passing of this._passing) {
      passing.wait -= dt;
      if (passing.wait > 0) continue;
      passing.wait = between(passing.spec.every);
      this._play(passing.spec);
    }
  }

  _play(spec) {
    const key = ambienceKey(spec.name);
    if (this.scene.sound.locked || !this.scene.cache.audio.exists(key)) return;
    // Never quite the same twice: a little louder or softer, more to one
    // side or the other, and (where it suits the sound) a touch higher or
    // lower.
    const vary = spec.vary || 0;
    try {
      this.scene.sound.play(key, {
        volume: between(spec.volume),
        pan: between([-0.6, 0.6]),
        rate: 1 + between([-vary, vary]),
      });
    } catch (e) {
      console.warn(`[Ambience] could not play ${key}`, e);
    }
  }
}
