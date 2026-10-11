import Phaser from 'phaser';

/**
 * The figures on the jetty: the boy with the rod and his buddy.
 *
 * Each boy is a set of painted POSES (ready, wind-up, cast, waiting, bite,
 * reeling, cheering ...). The scene tells the crew what is going on --
 * `mood('wait')`, `cast()`, `mood('bite')` -- and the crew picks the poses,
 * cross-fades between them, adds the small movements that make a still
 * painting feel alive (breathing, a hop of joy) and keeps `tip`, the end
 * of the fishing rod, up to date: that is where the scene ties the line.
 *
 * The poses of one boy were lined up on his seat when they were cut out
 * (scripts/make_characters.py), so a change of pose reads as the boy
 * moving. The dog is not posed but filmed: he plays a loop of frames.
 *
 * All sizes in assets/clean/characters.json are in picture pixels relative
 * to the figure's anchor (the bottom-left corner of the seat, or the ground
 * between the feet); a figure is scaled so that its `bodyHeight` becomes
 * the height the team asks for.
 */

// How long the rod stays swung back before it whips forward. The scene
// lets the float (or lure) go at the end of it.
export const CAST_WINDUP_MS = 230;
const CAST_FOLLOW_MS = 420;      // rod stays forward, then back to "waiting"

const FADE_MS = 150;             // an ordinary change of pose
const SNAP_MS = 60;              // a sudden one (cast, bite)
const REEL_BEAT_MS = 360;        // rod up / rod down while fighting a fish
const BREATH_MS = 2100;
const BREATH_GROW = 0.012;       // 1.2 % taller at the top of a breath

export const CHARACTERS_KEY = 'characters';

/** Texture key of a pose picture or a composed film strip. */
export function crewTextureKey(file) {
  return `crew:${file}`;
}

/**
 * A film strip arrives as two pictures -- the colours (JPEG) and the
 * transparency (PNG) -- which together are a fraction of one transparent
 * PNG's size. Put them back together as one texture with a frame per cell.
 */
export function buildClipTexture(scene, clip) {
  const key = crewTextureKey(clip.rgb);
  if (scene.textures.exists(key)) return key;
  const rgbKey = `${key}:rgb`;
  const alphaKey = `${key}:alpha`;
  if (!scene.textures.exists(rgbKey) || !scene.textures.exists(alphaKey)) return null;
  const rgb = scene.textures.get(rgbKey).getSourceImage();
  const canvasTexture = scene.textures.createCanvas(key, rgb.width, rgb.height);
  const ctx = canvasTexture.getContext();
  ctx.drawImage(rgb, 0, 0);
  ctx.globalCompositeOperation = 'destination-in';
  ctx.drawImage(scene.textures.get(alphaKey).getSourceImage(), 0, 0);
  ctx.globalCompositeOperation = 'source-over';
  canvasTexture.refresh();
  for (let i = 0; i < clip.count; i++) {
    canvasTexture.add(i, 0, (i % clip.cols) * clip.fw, Math.floor(i / clip.cols) * clip.fh,
                      clip.fw, clip.fh);
  }
  scene.textures.remove(rgbKey);
  scene.textures.remove(alphaKey);
  return key;
}

/** One boy: a stack of pose pictures of which one (or, mid-fade, two) shows. */
class Figure {
  constructor(scene, def, height, x, y, depth) {
    this.scene = scene;
    this.def = def;
    this.scale = height / def.bodyHeight;
    this.root = scene.add.container(x, y).setDepth(depth);
    this.images = {};
    this.pose = null;
    // The rod tip, in design px from the anchor; glides to the new pose's
    // tip while the pictures fade.
    this._tip = new Phaser.Math.Vector2();
    this._tipFrom = new Phaser.Math.Vector2();
    this._tipTo = new Phaser.Math.Vector2();
    this._tipT = 1;
    this._tipMs = 1;
    this.tip = new Phaser.Math.Vector2(x, y);

    scene.tweens.add({
      targets: this.root,
      scaleY: { from: 1, to: 1 + BREATH_GROW },
      duration: BREATH_MS,
      delay: Phaser.Math.Between(0, 600),
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  has(pose) {
    const p = this.def.poses[pose];
    return !!p && this.scene.textures.exists(crewTextureKey(p.file));
  }

  _image(pose) {
    if (!this.images[pose]) {
      const p = this.def.poses[pose];
      const img = this.scene.add.image(p.ox * this.scale, p.oy * this.scale, crewTextureKey(p.file));
      img.setOrigin(0, 0).setScale(this.scale).setVisible(false);
      this.root.add(img);
      this.images[pose] = img;
    }
    return this.images[pose];
  }

  setPose(pose, fadeMs = FADE_MS) {
    if (pose === this.pose || !this.has(pose)) return;
    const tweens = this.scene.tweens;
    const next = this._image(pose);
    // Whatever was still fading goes at once.
    for (const [name, img] of Object.entries(this.images)) {
      if (name === pose || name === this.pose) continue;
      tweens.killTweensOf(img);
      img.setVisible(false);
    }
    const prev = this.pose ? this.images[this.pose] : null;
    tweens.killTweensOf(next);
    this.root.bringToTop(next);
    next.setVisible(true);
    if (prev && fadeMs > 0) {
      // The new pose fades in OVER the old one, which only then lets go:
      // at no moment is the boy see-through.
      next.setAlpha(0);
      tweens.add({ targets: next, alpha: 1, duration: fadeMs });
      tweens.killTweensOf(prev);
      prev.setAlpha(1);
      tweens.add({
        targets: prev, alpha: 0, delay: fadeMs * 0.5, duration: fadeMs * 0.5,
        onComplete: () => prev.setVisible(false),
      });
    } else {
      next.setAlpha(1);
      if (prev) { tweens.killTweensOf(prev); prev.setVisible(false); }
    }

    const tip = this.def.poses[pose].tip;
    if (tip) {
      this._tipFrom.copy(this._tip);
      this._tipTo.set(tip[0] * this.scale, tip[1] * this.scale);
      this._tipMs = Math.max(1, fadeMs);
      this._tipT = this.pose && fadeMs > 0 ? 0 : 1;
      if (this._tipT === 1) this._tip.copy(this._tipTo);
    }
    this.pose = pose;
  }

  /** A little jump: up and down again, the anchor stays put. */
  hop(height = 14, ms = 150) {
    if (this._hop) this._hop.stop();
    const baseY = this._baseY ?? (this._baseY = this.root.y);
    this.root.y = baseY;
    this._hop = this.scene.tweens.add({
      targets: this.root, y: baseY - height, duration: ms, yoyo: true, ease: 'Quad.easeOut',
      onComplete: () => { this.root.y = baseY; },
    });
  }

  update(delta) {
    if (this._tipT < 1) {
      this._tipT = Math.min(1, this._tipT + delta / this._tipMs);
      const t = Phaser.Math.Easing.Sine.InOut(this._tipT);
      this._tip.set(Phaser.Math.Linear(this._tipFrom.x, this._tipTo.x, t),
                    Phaser.Math.Linear(this._tipFrom.y, this._tipTo.y, t));
    }
    this.tip.set(this.root.x + this._tip.x * this.root.scaleX,
                 this.root.y + this._tip.y * this.root.scaleY);
  }
}

/** The dog: one looping film strip. */
class ClipFigure {
  constructor(scene, def, height, x, y, depth) {
    this.scene = scene;
    this.sprite = null;
    const clip = def.clips && def.clips.idle;
    const key = clip && buildClipTexture(scene, clip);
    if (!key) return;
    const scale = height / def.bodyHeight;
    const animKey = `${key}:loop`;
    if (!scene.anims.exists(animKey)) {
      scene.anims.create({
        key: animKey,
        frames: Array.from({ length: clip.count }, (_, i) => ({ key, frame: i })),
        frameRate: clip.fps,
        repeat: -1,
      });
    }
    this.sprite = scene.add.sprite(x + clip.ox * scale, y + clip.oy * scale, key, 0);
    this.sprite.setOrigin(0, 0).setScale(scale).setDepth(depth);
    this.sprite.play(animKey);
    this._baseY = this.sprite.y;
  }

  setPose() {}

  hop(height = 10, ms = 130) {
    if (!this.sprite) return;
    if (this._hop) this._hop.stop();
    this.sprite.y = this._baseY;
    this._hop = this.scene.tweens.add({
      targets: this.sprite, y: this._baseY - height, duration: ms, yoyo: true, repeat: 1,
      ease: 'Quad.easeOut',
      onComplete: () => { this.sprite.y = this._baseY; },
    });
  }

  update() {}
}

export class Crew {
  /**
   * @param scene  the fishing scene
   * @param team   an entry of data/teams.js
   * @param seat   {x, y}: design position of the bottom-left corner of the
   *               angler's seat on this map's painting
   */
  constructor(scene, team, seat) {
    this.scene = scene;
    this.team = team;
    const meta = scene.cache.json.get(CHARACTERS_KEY) || {};
    const anglerDef = meta[team.angler.who];
    const buddyDef = team.buddy && meta[team.buddy.who];

    // The buddy stands a little behind the angler (drawn first).
    this.buddy = null;
    if (buddyDef) {
      const bx = seat.x + team.buddy.dx;
      const by = seat.y + team.buddy.dy;
      this.buddy = buddyDef.clips
        ? new ClipFigure(scene, buddyDef, team.buddy.height, bx, by, 9)
        : new Figure(scene, buddyDef, team.buddy.height, bx, by, 9);
    }
    this.angler = anglerDef ? new Figure(scene, anglerDef, team.angler.height, seat.x, seat.y, 10) : null;
    this.seat = seat;

    /** The end of the rod, in design coordinates. Same object all along. */
    this.tip = this.angler ? this.angler.tip : new Phaser.Math.Vector2(seat.x + 60, seat.y - 120);
    this._timers = [];
    this._mood = null;
    this.mood('ready', 0);
    if (this.angler) this.angler.update(0);
  }

  /** Design point just above the angler's head (for the "fish on" sign). */
  headTop() {
    const h = this.team.angler.height;
    return { x: this.seat.x + h * 0.28, y: this.seat.y - h * 1.06 };
  }

  _later(ms, fn) {
    this._timers.push(this.scene.time.delayedCall(ms, fn));
  }

  _clearTimers() {
    for (const t of this._timers) t.remove(false);
    this._timers = [];
  }

  _angler(pose, fade) { if (this.angler) this.angler.setPose(pose, fade); }
  _buddy(pose, fade) { if (this.buddy) this.buddy.setPose(pose, fade); }

  /**
   * What is going on:
   *   'ready'  rod in hand, nothing out yet
   *   'wait'   the line is out
   *   'bite'   a fish is on: now or never
   *   'reel'   fighting it in
   *   'run'    the fish tears off: hold on!
   *   'cheer'  caught!
   */
  mood(mood, fade) {
    if (mood === this._mood) return;
    this._mood = mood;
    this._clearTimers();
    switch (mood) {
      case 'ready':
        this._angler('ready', fade);
        this._buddy('look', fade);
        // Now and then he looks out over the water, then back at us.
        this._idleLoop(['wait', 'ready'], ['watch', 'look'], 5200, 8800);
        break;
      case 'wait':
        this._angler('wait', fade);
        this._buddy('watch', fade);
        // Mostly watching the float; a glance at us once in a while.
        this._idleLoop(['wait2', 'wait'], ['look', 'watch'], 6500, 11000, 2200);
        break;
      case 'bite':
        this._angler('bite', SNAP_MS);
        this._buddy('point', SNAP_MS);
        if (this.angler) this.angler.hop(10, 110);
        if (this.buddy) this.buddy.hop();
        break;
      case 'reel':
        this._buddy('point', FADE_MS);
        this._reelBeat(true);
        break;
      case 'run':
        // Rod high and bent double, leaning back, until the fish lets up.
        this._angler('bite', SNAP_MS);
        this._buddy('point', FADE_MS);
        if (this.buddy) this.buddy.hop(8, 120);
        break;
      case 'cheer':
        this._angler('cheer', SNAP_MS);
        this._buddy('cheer', SNAP_MS);
        if (this.angler) this.angler.hop(16, 170);
        if (this.buddy) this.buddy.hop(22, 190);
        break;
      default:
        break;
    }
  }

  /**
   * Alternate between a mood's main pose and its variation, at an easy,
   * irregular pace. `anglerPoses` / `buddyPoses` = [variation, main];
   * with `holdMs` the variation is only held that long.
   */
  _idleLoop(anglerPoses, buddyPoses, minMs, maxMs, holdMs) {
    const step = (toVariation) => {
      this._later(toVariation || !holdMs ? Phaser.Math.Between(minMs, maxMs) : holdMs, () => {
        this._angler(anglerPoses[toVariation ? 0 : 1]);
        step(!toVariation);
      });
    };
    step(true);
    // The buddy keeps his own time, so the two never move as one.
    const buddyStep = (toVariation) => {
      this._later(Phaser.Math.Between(minMs * 0.7, maxMs * 1.3), () => {
        this._buddy(buddyPoses[toVariation ? 0 : 1]);
        buddyStep(!toVariation);
      });
    };
    buddyStep(true);
  }

  _reelBeat(up) {
    this._angler(up ? 'reel' : 'reel2', REEL_BEAT_MS * 0.45);
    this._later(REEL_BEAT_MS, () => this._reelBeat(!up));
  }

  /**
   * The cast: swing back, whip forward, settle. The scene releases the
   * float CAST_WINDUP_MS after calling this, when the rod whips forward.
   */
  cast() {
    this._mood = 'cast';
    this._clearTimers();
    this._angler('castback', SNAP_MS);
    this._buddy('watch', FADE_MS);
    this._later(CAST_WINDUP_MS, () => {
      this._angler('castfwd', SNAP_MS);
      this._later(CAST_FOLLOW_MS, () => { if (this._mood === 'cast') this.mood('wait'); });
    });
  }

  update(delta) {
    if (this.angler) this.angler.update(delta);
  }
}
