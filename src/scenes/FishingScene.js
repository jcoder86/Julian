import Phaser from 'phaser';
import {
  GAME_WIDTH, GAME_HEIGHT,
  WORLD_WIDTH, WORLD_HEIGHT, WORLD_LEFT, WORLD_TOP, WORLD_RIGHT, WORLD_BOTTOM,
} from '../constants.js';
import { bindLayout } from '../systems/Layout.js';
import { AudioManager, SFX, MUSIC } from '../systems/AudioManager.js';
import { SaveSystem } from '../systems/SaveSystem.js';
import { weightedPick, legacyShape, fishTextureKey, FISH_BY_ID } from '../data/fish.js';
import { DEFAULT_BAIT_ID, baitSimpleTextureKey } from '../data/baits.js';
import { DEFAULT_FLOAT_ID, floatFullTextureKey, floatTipTextureKey } from '../data/floats.js';
import { TEX } from './BootScene.js';
import {
  createBobberPlaceholder,
} from '../placeholders.js';
import { ReelOverlay } from '../systems/ReelOverlay.js';

// =============================================================================
// Tunable visual constants -- dial these in once the real assets are rendered.
// =============================================================================

/**
 * Fraction of canvas height occupied by the Julian sprite.
 * The sprite is rendered preserving its source aspect ratio.
 *
 * Was 0.62 -- shrunk to 0.37 (~40% smaller) per player feedback:
 * the larger Julian dominated the scene and the toddler found the
 * 3-frame idle cycle distracting.
 */
export const SPRITE_SCALE = 0.37;

/**
 * Julian idle: currently STATIC -- a single still pose. The 3-frame
 * animation made the toddler "nerveus". Keep the constant here so the
 * code path is easy to flip back on if we want a much slower / subtler
 * cycle later.
 */
export const JULIAN_IDLE_ANIMATED = false;
export const JULIAN_IDLE_FRAMERATE = 2;   // unused while animated=false

// "Breathing" idle tween. Currently OFF -- on a monolithic sprite the
// combined scale+y motion reads as the whole figure hovering, not as a
// chest rising. Proper breathing requires a cutout-puppet rig where
// ONLY the upper body scales while the feet stay rooted. Constants kept
// here for the moment we add layered Julian/Dirk parts.
const BREATHING_ENABLED      = false;
const BREATH_DURATION_MS     = 1800;
const BREATH_SCALE_GROWTH    = 0.008;
const BREATH_Y_LIFT_PX       = 1.5;
const DIRK_BREATH_DURATION_MS  = 1400;
const DIRK_BREATH_SCALE_GROWTH = 0.012;
const DIRK_BREATH_Y_LIFT_PX    = 1.2;

/**
 * Where the player can click to cast. The waterline is the actual painted
 * boundary between trees/shore and water -- auto-detected from
 * backdrop.png by scripts/detect_waterline.py and baked in as 64 sample
 * points. waterTopAt(x) does linear interpolation between samples.
 *
 * Re-run the script when the backdrop changes, then paste the new
 * output into WATERLINE_RAW. Press 'W' in-game to see the curve as a
 * debug overlay.
 */
// Auto-detected from assets/raw/backdrop.png. The detector resized the 4:3
// painting to 1280x720, so x runs across the painting's full width but y
// is in a squashed 720-high space -- NOT design coordinates. Converted
// below.
const WATERLINE_RAW = [
  [   0, 346], [  20, 347], [  40, 438], [  60, 450], [  81, 455],
  [ 101, 457], [ 121, 454], [ 142, 442], [ 162, 438], [ 182, 415],
  [ 203, 379], [ 223, 378], [ 243, 408], [ 264, 381], [ 284, 374],
  [ 304, 374], [ 325, 361], [ 345, 344], [ 365, 308], [ 386, 302],
  [ 406, 335], [ 426, 294], [ 446, 294], [ 467, 319], [ 487, 296],
  [ 507, 292], [ 528, 301], [ 548, 292], [ 568, 290], [ 589, 315],
  [ 609, 298], [ 629, 290], [ 650, 284], [ 670, 285], [ 690, 295],
  [ 711, 289], [ 731, 286], [ 751, 296], [ 772, 293], [ 792, 285],
  [ 812, 285], [ 833, 293], [ 853, 284], [ 873, 283], [ 893, 282],
  [ 914, 292], [ 934, 290], [ 954, 290], [ 975, 276], [ 995, 287],
  [1015, 292], [1036, 292], [1056, 302], [1076, 295], [1097, 327],
  [1117, 326], [1137, 288], [1158, 282], [1178, 286], [1198, 276],
  [1219, 276], [1239, 284], [1259, 267], [1280, 264],
];

// The same curve in design coordinates: the painting is WORLD_HEIGHT tall
// and starts at WORLD_TOP. With this the cast area follows the painted
// water's edge exactly, on every screen shape.
export const WATERLINE_SAMPLES = WATERLINE_RAW.map(
  ([x, y]) => [x, WORLD_TOP + y * (WORLD_HEIGHT / 720)]
);

export function waterTopAt(x) {
  if (x <= WATERLINE_SAMPLES[0][0]) return WATERLINE_SAMPLES[0][1];
  const last = WATERLINE_SAMPLES.length - 1;
  if (x >= WATERLINE_SAMPLES[last][0]) return WATERLINE_SAMPLES[last][1];
  // Binary search for the bracketing pair.
  let lo = 0, hi = last;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (WATERLINE_SAMPLES[mid][0] <= x) lo = mid; else hi = mid;
  }
  const [x0, y0] = WATERLINE_SAMPLES[lo];
  const [x1, y1] = WATERLINE_SAMPLES[hi];
  const t = (x - x0) / (x1 - x0);
  return y0 + (y1 - y0) * t;
}

// Bounding rectangle of the water (kept for the click-area). Real hit-test
// lives in _isInsideWater() using the per-x sampled curve.
const _minY = Math.min(...WATERLINE_SAMPLES.map(p => p[1]));
export const WATER_BOUNDS = Object.freeze({
  x: WORLD_LEFT, y: _minY, width: WORLD_WIDTH, height: WORLD_BOTTOM - _minY,
});

/**
 * Cloud parallax stack -- DOM <div>s behind the (transparent) canvas, in
 * front of the backdrop video. Kept in the DOM because the browser scales
 * and scrolls the big cloud PNGs far more smoothly than a canvas sprite
 * would at ~1px/sec.
 *
 * They are positioned from the scene layout, in the SAME coordinates as
 * everything else: the band starts at the top of the visible sky and ends
 * at a fixed line in the painting, just above the mountains.
 *
 * Heights are design px. On a 4:3 screen the whole sky is visible and a
 * layer is exactly this tall (192 = 20% of the world height). On wider
 * screens the top of the painting is cropped away, so the band shrinks
 * with the remaining sky -- but never below CLOUD_MIN_SCALE, where it is
 * allowed to drift over the mountain tops instead.
 */
export const CLOUD_BACK_HEIGHT    = 192;   // distant layer; taller starts overlapping the tree-line
export const CLOUD_BACK_SPEED     = 1.25;  // design px/sec horizontal drift (slow = far away)
export const CLOUD_BACK_ALPHA     = 0.55;  // atmospheric fading, slightly translucent

export const CLOUD_FRONT_HEIGHT   = 172.8; // near layer (larger, more present)
export const CLOUD_FRONT_SPEED    = 3.75;  // ~3x back = visible parallax depth
export const CLOUD_FRONT_ALPHA    = 0.85;

export const CLOUD_MIN_SCALE      = 0.5;

/**
 * Sky mask: an alpha image of where the backdrop painting is sky
 * (generated from backdrop.mp4 by scripts/make_sky_mask.py). Applied to
 * the cloud strips as a CSS mask, so clouds pass BEHIND the tree tops and
 * mountain ridges instead of in front of them -- which matters most on
 * wide screens, where little sky is left and the strip overlaps the
 * terrain. The image covers the top SKY_MASK_FRACTION of the painting,
 * full width. If it fails to load the clouds simply stay unmasked.
 */
const SKY_MASK_SRC      = 'clean/sky-mask.png';
const SKY_MASK_FRACTION = 320 / 720;

/**
 * Foreground sway -- programmatic wind for the static foreground PNG
 * (e.g. an overhanging tree branch). The whole layer rotates gently
 * around its centre; for a painterly children's-game look this reads
 * as wind motion even though the entire image rotates rigidly.
 *
 * If you later swap foreground.png for an alpha video (foreground.webm
 * with painterly leaf detail), set FOREGROUND_SWAY_AMPLITUDE to 0 to
 * disable the programmatic sway and let the video do the motion.
 */
export const FOREGROUND_SWAY_AMPLITUDE = 1.2;       // degrees peak-to-zero
export const FOREGROUND_SWAY_PERIOD_MS = 3500;      // full back-and-forth cycle

/**
 * Julian sprite position: where to anchor his bottom-left, in design
 * coordinates. Dirk slides relative to this point (see DIRK_OFFSET below).
 *
 * Design coordinates are locked to the painting (design x 0..1280 is the
 * painting's full width, design y -120..840 its full height), so this
 * spot on the dock is the same on every screen shape.
 */
// After the Phase 7 shrink the sprite's footprint is much smaller, so we
// nudge the anchor a bit toward the centre and lift it upward so Julian
// sits higher on the dock rather than at the bottom of the frame.
export const JULIAN_ANCHOR_X = 260;
export const JULIAN_ANCHOR_Y = GAME_HEIGHT - 80;

/**
 * Where Dirk sits relative to Julian's bottom-left anchor.
 * Dirk renders behind Julian if his depth is lower (see _buildCharacters).
 * Positive X is right; positive Y is down.
 */
export const DIRK_OFFSET_X = -120;           // Dirk LEFT of Julian's anchor (tightened with smaller sprites)
export const DIRK_OFFSET_Y = -5;

/**
 * Dirk sprite size as a fraction of canvas height.
 * Dirk is shorter than Julian; was 0.32 -- shrunk to ~0.19 to match the
 * 40% reduction applied to Julian.
 */
export const DIRK_SCALE = 0.19;


/**
 * Rod-tip position relative to Julian's sprite TOP-LEFT, expressed in
 * DISPLAYED (post-scale) pixels.
 *
 * To dial in: press 'C' to toggle calibration mode, then Shift+Click on
 * the rod tip in the sprite. The browser console logs the exact offset to
 * paste back here.
 */
// === Rod-long overlay calibration (Phase 22) ===
// Julian's sprite no longer contains a rod. The rod is overlaid as a
// separate sprite (rod-long.png, 1024x1024) whose pivot we anchor on
// Julian's right hand. Tunables are in SOURCE pixels of each PNG so they
// stay consistent regardless of display scale.
//
// Hand position on Julian in source coords (1254x1254). Phase 24:
// auto-detected via skin-tone centroid of the lap region. Same point
// works for both julian-idle1 and julian-fishing (their hand bboxes
// match to within ~11 src px).
// Earlier guess-calibrations (565,538) and (605,498) were both ABOVE
// the actual hand -- they happened to look ok because the rod-long
// origin offset was loose.
export const JULIAN_HAND_SRC_X = 570;   // tiny nudge right (+15 src ≈ 3 display px)
export const JULIAN_HAND_SRC_Y = 470;   // shifted further up (-35 src ≈ 7 display px)

// Grip point on rod-long.png (1024x1024 source). The grip is roughly at
// the centre of the handle, just above the reel housing.
export const ROD_GRIP_SRC_X = 235;
export const ROD_GRIP_SRC_Y = 740;
// Rod tip on rod-long.png source coords (far end of the rod).
// Auto-detected: rightmost opaque x = 996, avg y of rightmost 8 cols = 55.
export const ROD_LONG_TIP_SRC_X = 996;
export const ROD_LONG_TIP_SRC_Y = 55;
// Display size: rod displayed-height as fraction of Julian's displayed
// height. The painted rod in the source is roughly 1.6x Julian's body
// height, but for visual balance we render it slightly smaller.
export const ROD_LONG_SCALE_VS_JULIAN = 1.4;
// Resting rotation of the rod (degrees). The painted rod-long.png already
// points up-and-right at about -40° from horizontal in its source image.
// Adding +20 here rotates it ~20° clockwise from that, giving a more
// natural "rod pointing slightly upward over the water" pose.
export const ROD_LONG_REST_ANGLE_DEG = 20;

// Cast/strike rod kinematics (degrees + ms). Sign convention: positive
// angle delta = CLOCKWISE rotation in Phaser, which on our rod (painted
// pointing up-and-right) moves the tip DOWN-RIGHT (toward the water =
// "forward"). Negative angle delta moves the tip UP-LEFT (toward Julian's
// shoulder = "back"). Windup pulls back, throw whips forward.
export const ROD_CAST_WINDUP_DEG  = -35;    // pull rod BACK over shoulder
export const ROD_CAST_WINDUP_MS   = 120;
export const ROD_CAST_THROW_DEG   = 25;     // whip rod FORWARD past rest
export const ROD_CAST_THROW_MS    = 280;
export const ROD_CAST_RECOVER_MS  = 350;
export const ROD_STRIKE_BACK_DEG  = -22;    // sharp UPWARD-BACK jerk on strike
export const ROD_STRIKE_BACK_MS   = 110;
export const ROD_STRIKE_RECOVER_MS = 300;

// Dirk idle/sleep toggle (Phase 22).
export const DIRK_SLEEP_TOGGLE_MS = 30000;   // wisselt elke 30 seconden

// =============================================================================
// Internal constants -- gameplay, not layout.
// =============================================================================

// Bite cycle timing (ms).
const BITE_DELAY_MIN = 3000;
const BITE_DELAY_MAX = 15000;
const NIBBLE_MIN = 1000;
const NIBBLE_MAX = 2000;
// Bobber-under-water grace window (player can still tap to catch).
// Bumped +20% on top of the original 800/1500 so 4-year-old reaction
// times have a bit more slack.
const DIVE_MIN = 960;
const DIVE_MAX = 1800;

// Bite variations: each bite cycle randomly picks one. The relative weights
// control how often each shows up. Tweak after first playtest.
//   normal -- the original: 1-2s nibble, then a straight-down dive.
//   quick  -- very brief nibble (~0.3s), then straight-down dive. Tests reflexes.
//   drift  -- normal nibble, then a slow DIAGONAL dive (left or right).
//   fake   -- 1.5-2.5s nibble, NEVER dives. Bobber returns to idle bob.
//             Click-during-nibble still counts as a miss.
const BITE_VARIATIONS = ['normal', 'quick', 'drift', 'fake'];
const BITE_WEIGHTS    = [40, 20, 25, 15];
function pickBiteVariation(rng = Math.random) {
  const total = BITE_WEIGHTS.reduce((a, b) => a + b, 0);
  let roll = rng() * total;
  for (let i = 0; i < BITE_VARIATIONS.length; i++) {
    roll -= BITE_WEIGHTS[i];
    if (roll <= 0) return BITE_VARIATIONS[i];
  }
  return BITE_VARIATIONS[0];
}

// Per-variation timing overrides.
const QUICK_NIBBLE_MIN = 200;
const QUICK_NIBBLE_MAX = 500;
const FAKE_NIBBLE_MIN  = 1500;
const FAKE_NIBBLE_MAX  = 2500;
// Drift variation: dive includes a horizontal shift over a longer duration.
const DRIFT_DIVE_DURATION_MS = 700;     // was 220 for straight dive
const DRIFT_OFFSET_MIN       = 30;
const DRIFT_OFFSET_MAX       = 70;

// Idle bob.
const BOB_AMPLITUDE = 4;
const BOB_PERIOD_MS = 1500;

// Cast arc.
const CAST_DURATION_MS = 600;
const CAST_ARC_HEIGHT = 220;

// Catch leap (bobber jumps out of the water just before the catch display).
const CATCH_LEAP_MS = 450;

// Fishing line style. A monofilament line in real life is nearly
// invisible against a busy water-and-sky background, but for this game
// we want kid-friendly clarity: thin white with mild transparency reads
// as "fishing line" the way kids draw it. Shape is a catenary-style sag
// so the line droops naturally under gravity between rod tip and float.
const LINE_COLOR = 0xffffff;
const LINE_WIDTH = 1.2;            // 40% thinner than previous 2px
const LINE_ALPHA = 0.85;
// Quadratic-bezier segments used to draw the curve in update().
const LINE_BEZIER_SEGMENTS = 24;

// Bobber depth-scaling. The float is rendered smaller when dropped near
// the horizon and full-size when dropped at the player's feet. Linear
// interpolation between the two extremes -- t=0 at BOBBER_DEPTH_FAR_Y,
// t=1 at BOBBER_DEPTH_NEAR_Y (design y; the far shore sits at ~265).
// FAR was 0.45 -- shrunk to 0.22 so a cast at the painted horizon really
// reads as "miles away".
const BOBBER_SCALE_FAR  = 0.22;   // furthest dropped (top of water)
const BOBBER_SCALE_NEAR = 1.0;    // closest dropped (bottom of water)
const BOBBER_DEPTH_FAR_Y  = 264;
const BOBBER_DEPTH_NEAR_Y = GAME_HEIGHT;

// Which slice of the painting must survive when a wide screen crops it
// top and bottom: Julian and Dirk sit on the dock with their feet at
// design y ~626, so keep a strip of planks below them on screen.
const VIEW_KEEP_BOTTOM = 668;
// On screens narrower than 4:3 the sides are cropped instead; lean left
// so the dock (and Dirk, at x ~175) stays in view.
const VIEW_ALIGN_X = 0.3;

// HUD icon stack (top-right) -- design px.
const HUD_ICON_SIZE   = 110;
const HUD_ICON_MARGIN = 14;
const HUD_ICON_STEP   = HUD_ICON_SIZE + HUD_ICON_MARGIN;
const HUD_ICON_COUNT  = 3;

// Reel widget (bottom-right): distance of its centre from the screen
// corner, and the radius its pulsing glow can reach.
const REEL_OFFSET_X    = 200;
const REEL_OFFSET_Y    = 130;
const REEL_GLOW_RADIUS = 170;

// State machine. Mirrors the spec phases.
const STATE = Object.freeze({
  READY: 'ready',
  CASTING: 'casting',
  IDLE: 'idle',
  NIBBLE: 'nibble',
  DIVE: 'dive',
  REELING: 'reeling',    // Phase 7: strong fish, reel widget is active
  CATCHING: 'catching',
});

// All fish use the reel widget now. Common little ones need just one
// turn (a flick of the wrist); rare giants take ~9 turns. Kept as a
// function so future "tap-only" carve-outs can be re-introduced here.
function requiresReel(_pick) { return true; }

// Turns of the reel needed to land a fish, combining the fish's cm length
// with how rare its species is. Two small fish of the same length still
// differ in turn count when one species is rarer than the other -- e.g.
// a small carp (speciesWeight 35) takes more turns than a small bream
// (speciesWeight 75) at the same length.
//
// Formula: ceil(0.5 + cm/25 + (100 - speciesWeight)/30), clamped to
// [1, cap]. The cap is DEFAULT_MAX_REEL_TURNS unless the species sets its
// own `maxReelTurns` in data/fish.js -- only the catfish does (12), so the
// lake's one true monster is a longer fight than anything else.
// Sample turns:
//   roach  small   9cm  (w100) -> 1   (very fast flick)
//   bream  small  12cm  (w 75) -> 2
//   carp   small  20cm  (w 35) -> 4   <-- > bream small, as requested
//   carp   medium 55cm  (w 35) -> 6
//   pike   large 125cm  (w 20) -> 9   (default cap)
//   trout  large  55cm  (w  6) -> 6
//   catfish small   40cm (w 3) -> 6   (rarest fish: never a quick flick)
//   catfish medium 100cm (w 3) -> 8
//   catfish large  175cm (w 3) -> 11
//   catfish large  200cm (w 3) -> 12  (its own cap)
const DEFAULT_MAX_REEL_TURNS = 9;
function reelTurnsFor(pick) {
  const species = FISH_BY_ID[pick.species];
  const cm = pick.lengthCm ?? 30;
  const weight = species?.speciesWeight ?? 50;
  const cap = species?.maxReelTurns ?? DEFAULT_MAX_REEL_TURNS;
  const cmTurns     = cm / 25;
  const rarityTurns = (100 - weight) / 30;
  return Math.max(1, Math.min(cap, Math.ceil(0.5 + cmTurns + rarityTurns)));
}

export class FishingScene extends Phaser.Scene {
  constructor() {
    super('FishingScene');
  }

  create() {
    this.audio = new AudioManager(this);
    this.state = STATE.READY;

    // Start the ambient background loop. Idempotent across scene wakes --
    // playMusic stops any existing loop before starting the new one, so
    // re-entering the fishing scene from a child scene does not stack.
    this.audio.playMusic(MUSIC.AMBIENT);

    // Timers and tweens we may need to cancel mid-flight.
    this.biteTimer = null;
    this.phaseTimer = null;
    this.bobTween = null;
    this.nibbleTween = null;
    this.activeCastTween = null;

    // Runtime hand-position offset (in Julian's SOURCE pixels). Shift+Click
    // during calibration moves this; we then derive the rod-long anchor
    // from it. Paste logged values into JULIAN_HAND_SRC_X/Y to persist.
    this._julianHandSrcX = JULIAN_HAND_SRC_X;
    this._julianHandSrcY = JULIAN_HAND_SRC_Y;
    this._calibrationActive = false;

    this._buildBackdrop();
    this._buildClouds();
    this._buildForeground();
    this._buildCharacters();
    this._buildBobber();
    this._buildFishOnIndicator();
    this._buildCollectionButton();
    this._buildCalibrationOverlay();

    // Dynamic line from rod tip to bobber, redrawn each frame in update().
    // Depth 8 puts the line BEHIND Julian (depth 10) and Dirk (depth 9),
    // above the foreground branch (3) and the water background (0). When
    // Julian fishes to the left, the line passes diagonally across his
    // body -- without this, the line drew on top and broke depth-reading
    // (line "in front of" Julian's torso looks wrong). The rod itself
    // stays on top (depth 11) so the line tucks neatly behind it.
    this.lineGfx = this.add.graphics();
    this.lineGfx.setDepth(8);

    // Camera + everything that is anchored to the screen rather than to
    // the painting (HUD, reel) or lives in the DOM (video, clouds). Runs
    // now and again on every resize / rotation.
    bindLayout(
      this,
      { alignX: VIEW_ALIGN_X, keepBottom: VIEW_KEEP_BOTTOM },
      (layout) => this._applyLayout(layout),
    );

    // Single global input handler -- state machine decides what to do.
    this.input.on('pointerdown', this._onPointerDown, this);

    // Coming back from the collection scene resets to ready-to-cast.
    this.events.on(Phaser.Scenes.Events.WAKE, () => this._enterReady());
  }

  /**
   * Re-anchor everything that follows the screen rather than the painting.
   * Called by bindLayout() on create and on every resize / rotation.
   */
  _applyLayout(layout) {
    this._layoutBackdropVideo(layout);
    this._layoutClouds(layout);
    this._layoutHud(layout);
    if (this.reelOverlay) {
      const pos = this._reelPosition();
      this.reelOverlay.setPosition(pos.x, pos.y);
    }
    if (this.calibrationHint) {
      this.calibrationHint.setPosition(layout.safe.left + 10, layout.safe.bottom - 28);
    }
  }

  update(_time, delta) {
    // DOM cloud parallax: each layer just scrolls its background. Position
    // and size are set from the layout (see _layoutClouds), so there is no
    // per-frame DOM measuring.
    if (this.cloudDomLayers && this.cloudDomLayers.length) {
      const dt = delta / 1000;
      for (const layer of this.cloudDomLayers) {
        layer.pos -= layer.cssSpeed * dt;
        layer.el.style.backgroundPositionX = `${layer.pos}px`;
      }
    }

    // Recompute rod tip every frame so the fishing line follows the
    // rotating rod-long sprite (cast / strike animations).
    if (this.rodLongSprite) this._recomputeRodTip();

    // REELING: drag the (hidden) bobber from where the fish was hooked
    // toward the water directly UNDER the rod tip. The line then hangs
    // straight down from the rod into the water (no horizontal sag,
    // since dx -> 0) -- exactly "the fish is reeled in, dangling
    // beneath the rod" at full progress. endY is well below the water
    // surface so the underwater dip reads clearly on a busy backdrop.
    if (this.state === STATE.REELING && this.reelOverlay && this.reelEnd && this.bobber) {
      const p = Phaser.Math.Clamp(
        this.reelOverlay.accumulatedRadians / this.reelOverlay.requiredRadians, 0, 1);
      const endX = this.rodTip.x;
      const endY = waterTopAt(endX) + 40;
      this.bobber.x = Phaser.Math.Linear(this.reelEnd.startX, endX, p);
      this.bobber.y = Phaser.Math.Linear(this.reelEnd.startY, endY, p);
    }

    this.lineGfx.clear();
    if (this.bobber && this.state !== STATE.READY && this.state !== STATE.CATCHING) {
      this._drawFishingLine(this.rodTip.x, this.rodTip.y, this.bobber.x, this.bobber.y);
    }
  }

  /**
   * Draw the fishing line from rod tip to bobber as a catenary-style sag
   * curve. The line dips DOWN under gravity between the two endpoints --
   * a quadratic bezier with the control point pushed below the midpoint
   * approximates a real fishing line's slack between rod and float.
   *
   * Sag amount is proportional to the horizontal span and damped for
   * near-vertical lines (which would be taut, not draped). Together this
   * gives "lifelike physics" without simulating a full catenary.
   */
  _drawFishingLine(sx, sy, ex, ey) {
    const dx = ex - sx;
    const dy = ey - sy;
    // Sag is biggest for a horizontal line and tapers to ~0 as the line
    // becomes vertical. We use the "horizontalness" (|dx| / dist) so the
    // multiplier is 1 when fully horizontal and 0 when fully vertical.
    const dist = Math.max(1, Math.sqrt(dx * dx + dy * dy));
    const horizontalness = Math.abs(dx) / dist;
    // Sag in screen pixels. Tweak SAG_FRACTION to taste.
    const SAG_FRACTION = 0.14;
    const sag = Math.max(10, dist * SAG_FRACTION) * horizontalness;

    // Control point: midpoint between endpoints, displaced DOWN by `sag`
    // pixels. The greater the sag, the deeper the U-shape.
    const cpX = (sx + ex) / 2;
    const cpY = (sy + ey) / 2 + sag;

    this.lineGfx.lineStyle(LINE_WIDTH, LINE_COLOR, LINE_ALPHA);
    this.lineGfx.beginPath();
    this.lineGfx.moveTo(sx, sy);
    for (let i = 1; i <= LINE_BEZIER_SEGMENTS; i++) {
      const t = i / LINE_BEZIER_SEGMENTS;
      const inv = 1 - t;
      // Quadratic bezier formula -- one control point in the middle.
      const x = inv * inv * sx + 2 * inv * t * cpX + t * t * ex;
      const y = inv * inv * sy + 2 * inv * t * cpY + t * t * ey;
      this.lineGfx.lineTo(x, y);
    }
    this.lineGfx.strokePath();
  }

  /**
   * Map a design-y on the water to a relative bobber scale.
   * y near the water-horizon returns BOBBER_SCALE_FAR; y at the player's
   * feet returns BOBBER_SCALE_NEAR. Values outside the band clamp to the
   * nearer extreme.
   */
  _bobberDepthScale(y) {
    const t = Phaser.Math.Clamp(
      (y - BOBBER_DEPTH_FAR_Y) / (BOBBER_DEPTH_NEAR_Y - BOBBER_DEPTH_FAR_Y),
      0, 1
    );
    return Phaser.Math.Linear(BOBBER_SCALE_FAR, BOBBER_SCALE_NEAR, t);
  }

  // ---------------------------------------------------------------------------
  // Setup helpers
  // ---------------------------------------------------------------------------

  _buildBackdrop() {
    // Backdrop strategy:
    //   1. Always render the static PNG immediately as a "first paint"
    //      so the user sees the scene right away.
    //   2. In parallel, try to attach an HTML5 <video> element behind the
    //      Phaser canvas. Native browser scaling via object-fit: cover --
    //      no fighting with Phaser's Video GameObject sizing quirks.
    //   3. On video-ready, hide the PNG and let video show through the
    //      now-transparent canvas. On video error, keep the PNG.
    if (this.textures.exists(TEX.BACKDROP)) {
      this._buildImageBackdrop();
    } else {
      this.backdropImage = this.add.rectangle(
        WORLD_LEFT + WORLD_WIDTH / 2, WORLD_TOP + WORLD_HEIGHT / 2,
        WORLD_WIDTH, WORLD_HEIGHT,
        0x205070
      ).setDepth(0);
    }

    this._tryAttachDomVideoBackdrop();

    // Transparent water-hit target. Bound to WATER_BOUNDS so taps on shore
    // are not interpreted as casts. Sits below the sprite/UI so those still
    // win pointer events.
    this.waterHit = this.add.rectangle(
      WATER_BOUNDS.x + WATER_BOUNDS.width / 2,
      WATER_BOUNDS.y + WATER_BOUNDS.height / 2,
      WATER_BOUNDS.width,
      WATER_BOUNDS.height,
      0x000000,
      0
    );
    this.waterHit.setDepth(1);
    this.waterHit.setInteractive();
  }

  _buildImageBackdrop() {
    // The painting IS the world: stretch it over exactly the world rect so
    // it lines up with the video that replaces it once loaded.
    const bg = this.add.image(
      WORLD_LEFT + WORLD_WIDTH / 2, WORLD_TOP + WORLD_HEIGHT / 2, TEX.BACKDROP
    );
    bg.setOrigin(0.5);
    bg.setDisplaySize(WORLD_WIDTH, WORLD_HEIGHT);
    bg.setDepth(0);
    this.backdropImage = bg;
  }

  _tryAttachDomVideoBackdrop() {
    // Don't add a duplicate if scene was woken up.
    if (this.backdropVideoEl) return;

    const videoEl = document.createElement('video');
    videoEl.src = 'raw/backdrop.mp4';
    videoEl.muted = true;
    videoEl.loop = true;
    videoEl.playsInline = true;       // iOS friendly
    videoEl.preload = 'auto';
    videoEl.crossOrigin = 'anonymous';

    videoEl.addEventListener('loadeddata', () => {
      // backdrop.mp4 is a 16:9 file holding the 4:3 painting with black
      // bars baked in left and right. We give the <video> the painting's
      // own 4:3 box (the world rect, see _layoutBackdropVideo) and let
      // object-fit: cover fill it by height -- which crops exactly those
      // bars away. The painting then sits pixel-for-pixel under the canvas
      // on every screen shape, so nothing drawn in the canvas can end up
      // "beside" it.
      videoEl.style.position = 'fixed';
      videoEl.style.objectFit = 'cover';
      // Backdrop sits DEEPEST. Cloud DOM layers (z-index -1) drift in front
      // of it but still behind the Phaser canvas.
      videoEl.style.zIndex = '-2';
      videoEl.style.pointerEvents = 'none';
      document.body.appendChild(videoEl);
      this.backdropVideoEl = videoEl;
      this._layoutBackdropVideo(this.layout);

      // Hide the still-image fallback now that the video is showing.
      if (this.backdropImage) {
        this.backdropImage.setVisible(false);
      }

      videoEl.play().catch((err) => {
        console.warn('[FishingScene] backdrop video autoplay blocked:', err);
      });

      console.log(
        `[FishingScene] DOM video backdrop attached: ${videoEl.videoWidth}x${videoEl.videoHeight}`
      );
    }, { once: true });

    videoEl.addEventListener('error', () => {
      console.log('[FishingScene] no backdrop.mp4 found, keeping static PNG');
      videoEl.remove();
    }, { once: true });

    // Kick off the load (some browsers don't start without it).
    videoEl.load();

    // Clean up the DOM video on scene shutdown.
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      if (this.backdropVideoEl) {
        this.backdropVideoEl.pause();
        this.backdropVideoEl.remove();
        this.backdropVideoEl = null;
      }
    });
  }

  /**
   * Pin the backdrop <video> to the world rect, in viewport CSS px.
   */
  _layoutBackdropVideo(layout) {
    const el = this.backdropVideoEl;
    if (!el || !layout) return;
    const r = layout.cssRect(WORLD_LEFT, WORLD_TOP, WORLD_WIDTH, WORLD_HEIGHT);
    el.style.left   = `${layout.container.left + r.left}px`;
    el.style.top    = `${layout.container.top + r.top}px`;
    el.style.width  = `${r.width}px`;
    el.style.height = `${r.height}px`;
  }

  _buildForeground() {
    // Optional layer for near-camera elements that should stay IN FRONT of
    // the drifting clouds -- typically an overhanging tree branch from the
    // backdrop, extracted to a transparent PNG of the same canvas-aspect
    // dimensions. Render order: backdrop -> clouds -> foreground -> chars.
    if (!this.textures.exists(TEX.FOREGROUND)) return;

    const fg = this.add.image(GAME_WIDTH / 2, GAME_HEIGHT / 2, TEX.FOREGROUND);
    fg.setOrigin(0.5);
    // Cover-scale to match the backdrop so the foreground silhouette stays
    // pixel-aligned with the painted version baked into the backdrop.
    const scale = Math.max(GAME_WIDTH / fg.width, GAME_HEIGHT / fg.height);
    fg.setScale(scale);
    fg.setDepth(3);
    this.foreground = fg;

    // Wind sway. Tiny back-and-forth rotation around the layer's centre.
    // Skipping when amplitude is 0 keeps the static branch crisp (useful
    // once we swap to an alpha video that already animates).
    if (FOREGROUND_SWAY_AMPLITUDE > 0) {
      this.tweens.add({
        targets: fg,
        angle: { from: -FOREGROUND_SWAY_AMPLITUDE, to: FOREGROUND_SWAY_AMPLITUDE },
        duration: FOREGROUND_SWAY_PERIOD_MS / 2,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    }
  }

  _buildClouds() {
    // Clouds live in the DOM (inside #game, behind the canvas). Geometry
    // comes from the scene layout -- see _layoutClouds.
    this._spawnDomClouds();

    // Clean up DOM layers when the scene shuts down or sleeps.
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this._removeDomClouds());
    this.events.on(Phaser.Scenes.Events.SLEEP, () => this._removeDomClouds());
    this.events.on(Phaser.Scenes.Events.WAKE, () => {
      if (this.cloudDomLayers.length === 0) this._spawnDomClouds();
    });
  }

  _spawnDomClouds() {
    this.cloudDomLayers = [];

    // Cleanup any stale cloud DIVs from previous mounts (HMR / scene wake).
    for (const stale of document.querySelectorAll('.julian-cloud')) {
      stale.remove();
    }

    this._addDomCloudLayer({
      src:    'clean/clouds-back.png',
      height: CLOUD_BACK_HEIGHT,
      alpha:  CLOUD_BACK_ALPHA,
      speed:  CLOUD_BACK_SPEED,
    });
    this._addDomCloudLayer({
      src:    'clean/clouds-front.png',
      height: CLOUD_FRONT_HEIGHT,
      alpha:  CLOUD_FRONT_ALPHA,
      speed:  CLOUD_FRONT_SPEED,
    });

    this._applySkyMask();
    this._layoutClouds(this.layout);
  }

  /**
   * Mask the cloud strips with the sky mask -- but only once the image is
   * known to have loaded. A CSS mask whose image fails to load hides the
   * element completely, and unmasked clouds beat no clouds.
   */
  _applySkyMask() {
    const apply = () => {
      this._skyMaskReady = true;
      for (const layer of this.cloudDomLayers || []) {
        const st = layer.el.style;
        st.webkitMaskImage = `url(${SKY_MASK_SRC})`;
        st.maskImage = `url(${SKY_MASK_SRC})`;
        st.webkitMaskRepeat = 'no-repeat';
        st.maskRepeat = 'no-repeat';
      }
      this._layoutClouds(this.layout);
    };
    if (this._skyMaskReady) { apply(); return; }
    if (this._skyMaskProbe) return;            // still loading
    const probe = new Image();
    probe.onload = apply;
    probe.onerror = () => console.log('[FishingScene] no sky mask, clouds stay unmasked');
    probe.src = SKY_MASK_SRC;
    this._skyMaskProbe = probe;
  }

  _addDomCloudLayer({ src, height, alpha, speed }) {
    // Attach to #game (Phaser's parent div) with position: absolute, NOT to
    // body with position: fixed -- #game clips them to the screen and gives
    // them the same origin the layout's CSS rects are measured from.
    const parent = document.getElementById('game') || document.body;
    if (getComputedStyle(parent).position === 'static') {
      parent.style.position = 'relative';
    }

    const div = document.createElement('div');
    div.className = 'julian-cloud';            // tag for cleanup
    div.style.position = 'absolute';
    // The painting always covers the full screen width, so the strip
    // simply spans the container; top + height come from _layoutClouds.
    div.style.left = '0';
    div.style.width = '100%';
    div.style.backgroundImage = `url(${src})`;
    div.style.backgroundRepeat = 'repeat-x';
    div.style.backgroundSize = 'auto 100%';
    div.style.opacity = String(alpha);
    div.style.zIndex = '-1';                   // above video (-2), below canvas (0)
    div.style.pointerEvents = 'none';
    parent.appendChild(div);

    this.cloudDomLayers.push({ el: div, pos: 0, height, speed, cssSpeed: 0 });
  }

  /**
   * Fit each cloud strip into the visible sky. The band's lower edge is a
   * fixed line in the painting (just above the mountains); its upper edge
   * is the top of the screen. Wider screens show less sky, so the band --
   * and the clouds in it -- shrink with it, down to CLOUD_MIN_SCALE.
   */
  _layoutClouds(layout) {
    if (!layout || !this.cloudDomLayers) return;
    const bandTop = Math.max(WORLD_TOP, layout.view.top);
    // Where the sky mask sits on screen: glued to the painting.
    const mask = layout.cssRect(
      WORLD_LEFT, WORLD_TOP, WORLD_WIDTH, WORLD_HEIGHT * SKY_MASK_FRACTION
    );
    for (const layer of this.cloudDomLayers) {
      const skyBottom = WORLD_TOP + layer.height;
      const height = Math.max(skyBottom - bandTop, layer.height * CLOUD_MIN_SCALE);
      const r = layout.cssRect(layout.view.left, bandTop, layout.view.width, height);
      const previousHeight = layer.cssHeight;
      const st = layer.el.style;
      st.top = `${r.top}px`;
      st.height = `${r.height}px`;
      if (this._skyMaskReady) {
        // Mask coordinates are relative to the strip's own box.
        const size = `${mask.width}px ${mask.height}px`;
        const position = `${mask.left - r.left}px ${mask.top - r.top}px`;
        st.webkitMaskSize = size;
        st.maskSize = size;
        st.webkitMaskPosition = position;
        st.maskPosition = position;
      }
      // The tile is sized by the strip's height, so a resize rescales the
      // pattern: rescale the scroll offset with it to avoid a visible jump.
      if (previousHeight > 0) layer.pos *= r.height / previousHeight;
      layer.cssHeight = r.height;
      layer.cssSpeed = layer.speed * layout.scale * (height / layer.height);
    }
  }

  _removeDomClouds() {
    for (const layer of this.cloudDomLayers || []) {
      layer.el.remove();
    }
    this.cloudDomLayers = [];
  }

  _buildCharacters() {
    // Preference order:
    //   1. Julian idle animation (julian-idle1/2/3) + dirk-idle  ← preferred
    //   2. Legacy separate julian_fishing + dirk_sitting (no animation)
    //   3. Legacy combined julian_dirk_fishing (transitional fallback)
    //   4. Flat placeholder rectangle (very first run, no assets)
    //
    // Each branch ends up populating `this.julianSprite` with whichever
    // object owns the rod tip (the rod is attached to Julian, never Dirk).
    const julianDisplayHeight = GAME_HEIGHT * SPRITE_SCALE;
    const dirkDisplayHeight = GAME_HEIGHT * DIRK_SCALE;

    const hasIdleFrames =
      this.textures.exists(TEX.JULIAN_IDLE_1) &&
      this.textures.exists(TEX.DIRK_IDLE);

    if (hasIdleFrames) {
      // Dirk first (lower depth) so Julian overlaps where they meet.
      this.dirkSprite = this.add.image(
        JULIAN_ANCHOR_X + DIRK_OFFSET_X,
        JULIAN_ANCHOR_Y + DIRK_OFFSET_Y,
        TEX.DIRK_IDLE
      );
      this.dirkSprite.setOrigin(0, 1);
      this._scaleToHeight(this.dirkSprite, dirkDisplayHeight);
      this.dirkSprite.setDepth(9);

      // Julian: optionally cycle the 3 idle frames. Currently disabled --
      // the toddler player found the cycle visually busy. We render the
      // first frame as a static Image instead.
      if (JULIAN_IDLE_ANIMATED &&
          this.textures.exists(TEX.JULIAN_IDLE_2) &&
          this.textures.exists(TEX.JULIAN_IDLE_3)) {
        if (!this.anims.exists('julian-idle')) {
          this.anims.create({
            key: 'julian-idle',
            frames: [
              { key: TEX.JULIAN_IDLE_1 },
              { key: TEX.JULIAN_IDLE_2 },
              { key: TEX.JULIAN_IDLE_3 },
              { key: TEX.JULIAN_IDLE_2 },   // ping-pong -- avoids hard 3->1 jump
            ],
            frameRate: JULIAN_IDLE_FRAMERATE,
            repeat: -1,
          });
        }
        this.julianSprite = this.add.sprite(
          JULIAN_ANCHOR_X, JULIAN_ANCHOR_Y, TEX.JULIAN_IDLE_1
        );
        this.julianSprite.play('julian-idle');
      } else {
        // Static image -- much calmer for a 4-year-old viewer.
        this.julianSprite = this.add.image(
          JULIAN_ANCHOR_X, JULIAN_ANCHOR_Y, TEX.JULIAN_IDLE_1
        );
      }
      this.julianSprite.setOrigin(0, 1);
      this._scaleToHeight(this.julianSprite, julianDisplayHeight);
      this.julianSprite.setDepth(10);

      // Rod overlay (Phase 22) -- a separate sprite anchored on Julian's
      // hand so we can rotate it for cast/strike animations without
      // re-rendering Julian.
      if (this.textures.exists(TEX.ROD_LONG)) {
        this._buildRodLong();
      }

      // Dirk idle/sleep toggle: alternate dirk-idle and dirk-idle-sleep
      // every DIRK_SLEEP_TOGGLE_MS so he subtly drifts in and out of nap.
      if (this.textures.exists(TEX.DIRK_IDLE_SLEEP)) {
        this._scheduleDirkSleepToggle();
      }

    } else if (
      this.textures.exists(TEX.JULIAN_FISHING) &&
      this.textures.exists(TEX.DIRK_SITTING)
    ) {
      // Legacy: static separate sprites.
      this.dirkSprite = this.add.image(
        JULIAN_ANCHOR_X + DIRK_OFFSET_X,
        JULIAN_ANCHOR_Y + DIRK_OFFSET_Y,
        TEX.DIRK_SITTING
      );
      this.dirkSprite.setOrigin(0, 1);
      this._scaleToHeight(this.dirkSprite, dirkDisplayHeight);
      this.dirkSprite.setDepth(9);

      this.julianSprite = this.add.image(
        JULIAN_ANCHOR_X, JULIAN_ANCHOR_Y, TEX.JULIAN_FISHING
      );
      this.julianSprite.setOrigin(0, 1);
      this._scaleToHeight(this.julianSprite, julianDisplayHeight);
      this.julianSprite.setDepth(10);

    } else if (this.textures.exists(TEX.JULIAN_DIRK_FISHING)) {
      console.warn(
        '[FishingScene] using combined julian_dirk_fishing sprite. ' +
        'Drop julian-idle1/2/3.png + dirk-idle.png to enable idle animation.'
      );
      this.julianSprite = this.add.image(
        JULIAN_ANCHOR_X, JULIAN_ANCHOR_Y, TEX.JULIAN_DIRK_FISHING
      );
      this.julianSprite.setOrigin(0, 1);
      this._scaleToHeight(this.julianSprite, julianDisplayHeight);
      this.julianSprite.setDepth(10);

    } else {
      this.julianSprite = this.add.rectangle(
        JULIAN_ANCHOR_X, JULIAN_ANCHOR_Y,
        julianDisplayHeight, julianDisplayHeight,
        0x888888, 0.4
      );
      this.julianSprite.setOrigin(0, 1);
      this.julianSprite.setStrokeStyle(2, 0xffffff, 0.6);
      this.julianSprite.setDepth(10);
    }

    this._recomputeRodTip();

    // "Breathing" idle tween. Wrapped behind isImage check because the
    // placeholder-rectangle fallback path doesn't need (or want) it.
    this._startBreathingTweens();
  }

  /**
   * Continuous, very subtle idle motion on Julian + Dirk to give the
   * scene a sense of life without the discrete-frame "nervous" cycle.
   * Tweens scale and y around the current values; resurfaces every
   * BREATH_DURATION_MS for Julian and DIRK_BREATH_DURATION_MS for Dirk.
   */
  _startBreathingTweens() {
    if (!BREATHING_ENABLED) return;
    if (this.julianSprite && this.julianSprite.scale) {
      const baseJX = this.julianSprite.scale;
      const baseJY = this.julianSprite.y;
      this.tweens.add({
        targets: this.julianSprite,
        scale:   { from: baseJX, to: baseJX * (1 + BREATH_SCALE_GROWTH) },
        y:       { from: baseJY, to: baseJY - BREATH_Y_LIFT_PX },
        duration: BREATH_DURATION_MS,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    }
    if (this.dirkSprite && this.dirkSprite.scale) {
      const baseDX = this.dirkSprite.scale;
      const baseDY = this.dirkSprite.y;
      this.tweens.add({
        targets: this.dirkSprite,
        scale:   { from: baseDX, to: baseDX * (1 + DIRK_BREATH_SCALE_GROWTH) },
        y:       { from: baseDY, to: baseDY - DIRK_BREATH_Y_LIFT_PX },
        duration: DIRK_BREATH_DURATION_MS,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
        // Offset start so Dirk and Julian don't pulse in unison.
        delay: 350,
      });
    }
  }

  /**
   * Scale a Phaser image so its displayed height matches `targetH`, while
   * preserving the source aspect ratio. Returns the final display width.
   */
  _scaleToHeight(image, targetH) {
    const scale = targetH / image.height;
    image.setScale(scale);
    return image.displayWidth;
  }

  /**
   * Place rod-long.png on Julian's hand. The rod's origin is set to its
   * grip point on the source image so rotating it tilts around the hand.
   */
  _buildRodLong() {
    const handScene = this._julianHandSceneCoord();
    const rod = this.add.image(handScene.x, handScene.y, TEX.ROD_LONG);
    rod.setOrigin(ROD_GRIP_SRC_X / rod.width, ROD_GRIP_SRC_Y / rod.height);
    rod.setScale(this.julianSprite.scale * ROD_LONG_SCALE_VS_JULIAN);
    rod.setAngle(ROD_LONG_REST_ANGLE_DEG);
    rod.setDepth(11);   // above Julian (10) so the rod-grip overlaps his hand
    this.rodLongSprite = rod;
  }

  /**
   * Compute the canvas position of Julian's right hand from his current
   * sprite transform + the source-pixel hand coordinates.
   */
  _julianHandSceneCoord() {
    const scale = this.julianSprite.scale;
    const topLeftX = this.julianSprite.x;
    const topLeftY = this.julianSprite.y - this.julianSprite.displayHeight;
    return {
      x: topLeftX + this._julianHandSrcX * scale,
      y: topLeftY + this._julianHandSrcY * scale,
    };
  }

  /**
   * Recompute rod tip world position. Phase 22: derived from rod-long's
   * sprite transform (position + rotation + scale) and the source-pixel
   * grip-to-tip vector. Falls back to a static hand offset when the
   * rod sprite isn't present.
   */
  _recomputeRodTip() {
    if (!this.rodTip) this.rodTip = new Phaser.Math.Vector2();

    if (this.rodLongSprite) {
      const rod = this.rodLongSprite;
      // Vector from grip to tip in source-pixel coords, then scaled.
      const dx = (ROD_LONG_TIP_SRC_X - ROD_GRIP_SRC_X) * rod.scale;
      const dy = (ROD_LONG_TIP_SRC_Y - ROD_GRIP_SRC_Y) * rod.scale;
      const cos = Math.cos(rod.rotation);
      const sin = Math.sin(rod.rotation);
      this.rodTip.set(
        rod.x + dx * cos - dy * sin,
        rod.y + dx * sin + dy * cos,
      );
    } else {
      // No rod sprite yet -- fall back to the hand position so the line
      // at least starts somewhere sensible.
      const hand = this._julianHandSceneCoord();
      this.rodTip.set(hand.x, hand.y);
    }

    if (this.calibrationDot) {
      this.calibrationDot.setPosition(this.rodTip.x, this.rodTip.y);
    }
  }

  /**
   * Cast rod animation -- chain: windup back, snap forward, settle to rest.
   * Cancels any in-flight rod tween so repeated casts feel responsive.
   */
  _playCastRodAnimation() {
    if (!this.rodLongSprite) return;
    if (this._rodTween) { this._rodTween.stop(); this._rodTween = null; }
    const restAngle = ROD_LONG_REST_ANGLE_DEG;
    this._rodTween = this.tweens.chain({
      targets: this.rodLongSprite,
      tweens: [
        { angle: restAngle + ROD_CAST_WINDUP_DEG, duration: ROD_CAST_WINDUP_MS, ease: 'Sine.easeOut' },
        { angle: restAngle + ROD_CAST_THROW_DEG,  duration: ROD_CAST_THROW_MS,  ease: 'Quad.easeIn' },
        { angle: restAngle,                       duration: ROD_CAST_RECOVER_MS, ease: 'Sine.easeOut' },
      ],
    });
  }

  /**
   * Strike rod animation -- sharp pull back then settle. Played on
   * _catchFish (the moment the player taps during the dive).
   */
  _playStrikeRodAnimation() {
    if (!this.rodLongSprite) return;
    if (this._rodTween) { this._rodTween.stop(); this._rodTween = null; }
    const restAngle = ROD_LONG_REST_ANGLE_DEG;
    this._rodTween = this.tweens.chain({
      targets: this.rodLongSprite,
      tweens: [
        { angle: restAngle + ROD_STRIKE_BACK_DEG, duration: ROD_STRIKE_BACK_MS, ease: 'Quad.easeOut' },
        { angle: restAngle,                       duration: ROD_STRIKE_RECOVER_MS, ease: 'Sine.easeInOut' },
      ],
    });
  }

  /**
   * Cycle Dirk through 3 poses (idle -> idle2 -> sleep -> idle ...) every
   * DIRK_SLEEP_TOGGLE_MS so he drifts through varied behaviour over time.
   * All 3 source PNGs share aligned content-bottom-y so the texture swap
   * doesn't visibly move him on the dock.
   */
  _scheduleDirkSleepToggle() {
    const sequence = [
      TEX.DIRK_IDLE,
      TEX.DIRK_IDLE_2,
      TEX.DIRK_IDLE_SLEEP,
    ].filter(key => this.textures.exists(key));
    if (sequence.length < 2) return;   // nothing useful to cycle through
    this._dirkPoseIndex = 0;
    const tick = () => {
      if (!this.dirkSprite) return;
      this._dirkPoseIndex = (this._dirkPoseIndex + 1) % sequence.length;
      this.dirkSprite.setTexture(sequence[this._dirkPoseIndex]);
      // setTexture resets displayHeight; re-apply the canonical size.
      const targetH = GAME_HEIGHT * DIRK_SCALE;
      this._scaleToHeight(this.dirkSprite, targetH);
    };
    this._dirkToggleTimer = this.time.addEvent({
      delay: DIRK_SLEEP_TOGGLE_MS,
      loop: true,
      callback: tick,
    });
  }

  _buildBobber() {
    // Bobber uses the SELECTED float's "tip" sprite -- only the above-water
    // portion shows in game (per the design). The container is recreated
    // on WAKE so float-selection changes are picked up immediately.
    this._spawnBobberSprite();
    this.events.on(Phaser.Scenes.Events.WAKE, () => this._spawnBobberSprite());
  }

  _spawnBobberSprite() {
    // Tear down any previous bobber container so we don't leak Game Objects.
    const x = this.bobber ? this.bobber.x : this.rodTip.x;
    const y = this.bobber ? this.bobber.y : this.rodTip.y;
    const wasVisible = this.bobber ? this.bobber.visible : false;
    if (this.bobber) this.bobber.destroy();

    const floatId = SaveSystem.getSelectedFloat() || DEFAULT_FLOAT_ID;
    const tipKey = floatTipTextureKey(floatId);

    if (this.textures.exists(tipKey)) {
      // Use the chosen float's tip sprite.
      const c = this.add.container(x, y);
      const tip = this.add.image(0, 0, tipKey);
      // Scale so the tip is roughly the same visual size as the placeholder
      // (~30px tall on canvas).
      const targetH = 32;
      tip.setScale(targetH / tip.height);
      // Anchor the BOTTOM of the tip on the water-surface y -- that's the
      // visual point where the float meets the water.
      tip.setOrigin(0.5, 1);
      tip.y = 0;          // container origin = water line
      c.add(tip);
      c.setDepth(20);
      this.bobber = c;
    } else {
      // Fallback to the placeholder if the tip texture isn't loaded.
      this.bobber = createBobberPlaceholder(this, x, y);
    }
    this.bobber.setVisible(wasVisible);
    this.bobberHomeY = y;
  }

  /**
   * "Fish on!" indicator -- a small sprite that pops above Julian's head
   * the moment the bobber goes under. Hidden by default; toggled from
   * the state-machine transitions (visible only during DIVE).
   *
   * Sized to ~70% of Julian's display height for clear visibility on an
   * iPad. Depth 14 keeps it above Julian (10) and the rod (11) but below
   * the HUD icons and the catch overlay.
   */
  _buildFishOnIndicator() {
    if (!this.textures.exists(TEX.FISHON) || !this.julianSprite) {
      this.fishOnSprite = null;
      return;
    }
    const julianTopY = this.julianSprite.y - this.julianSprite.displayHeight;
    const cx = this.julianSprite.x + this.julianSprite.displayWidth / 2;
    const cy = julianTopY - 30;
    const spr = this.add.image(cx, cy, TEX.FISHON);
    const targetH = this.julianSprite.displayHeight * 0.55;
    spr.setScale(targetH / spr.height);
    spr.setOrigin(0.5, 1);
    spr.setDepth(14);
    spr.setVisible(false);
    this.fishOnSprite = spr;

    // Gentle bob so it reads as "attention-getter" without being chaotic.
    this.tweens.add({
      targets: spr,
      y: { from: cy, to: cy - 8 },
      duration: 380,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  _showFishOn() {
    if (this.fishOnSprite) this.fishOnSprite.setVisible(true);
  }

  _hideFishOn() {
    if (this.fishOnSprite) this.fishOnSprite.setVisible(false);
  }

  _buildCollectionButton() {
    // HUD: three stacked icons on the right edge.
    //   top:    fish   -- shows last-caught fish, tap to open collection
    //   middle: float  -- shows current float, tap to choose another (Phase 4)
    //   bottom: bait   -- shows current bait,  tap to choose another (Phase 4)
    this.hudIcons = {};
    this.hudIcons.fish  = this._buildHudIcon({
      key:   TEX.ICON_FISH,
      slot:  0,
      onTap: () => {
        this._cancelAllPhaseLogic();
        this.scene.sleep();
        this.scene.run('FishingCollectionScene');
      },
    });
    this.hudIcons.float = this._buildHudIcon({
      key:   TEX.ICON_FLOAT,
      slot:  1,
      onTap: () => this._openModal('FloatSelectionScene'),
    });
    this.hudIcons.bait  = this._buildHudIcon({
      key:   TEX.ICON_BAIT,
      slot:  2,
      onTap: () => this._openModal('BaitSelectionScene'),
    });

    // Initial render of the inner overlays.
    this._refreshHud();

    // Refresh when waking from a sub-scene -- selection or collection may
    // have updated the selected bait/float or last caught fish.
    this.events.on(Phaser.Scenes.Events.WAKE, () => this._refreshHud());
  }

  _buildHudIcon({ key, slot, onTap }) {
    // Sizes live in the HUD_ICON_* constants. The position is assigned by
    // _layoutHud(), which pins the stack to the real top-right corner of
    // the screen.
    const ICON_SIZE = HUD_ICON_SIZE;

    const c = this.add.container(0, 0);
    c.setDepth(50);
    c.setSize(ICON_SIZE, ICON_SIZE);
    c.setInteractive({ useHandCursor: true });

    const bg = this.add.image(0, 0, key);
    bg.setDisplaySize(ICON_SIZE, ICON_SIZE);

    // Inner overlay sprite -- the actual fish/float/bait shown inside the
    // button. Re-built each time _refreshHud() runs.
    const overlay = this.add.image(0, 0, key);
    overlay.setVisible(false);

    c.add([bg, overlay]);
    c.on('pointerdown', (_pointer, _x, _y, event) => {
      if (event && event.stopPropagation) event.stopPropagation();
      onTap();
    });

    return { container: c, overlay, sizePx: ICON_SIZE, slot };
  }

  /**
   * Pin the HUD stack to the top-right corner of the visible screen,
   * inside the device's safe area (notch / status bar). On very short
   * screens the whole stack shrinks so it always fits.
   */
  _layoutHud(layout) {
    if (!this.hudIcons || !layout) return;
    const safe = layout.safe;
    const stackHeight = HUD_ICON_COUNT * HUD_ICON_STEP + HUD_ICON_MARGIN;
    const k = Math.min(1, safe.height / stackHeight);
    const x = safe.right - (HUD_ICON_MARGIN + HUD_ICON_SIZE / 2) * k;
    const y0 = safe.top + (HUD_ICON_MARGIN + HUD_ICON_SIZE / 2) * k;
    for (const icon of Object.values(this.hudIcons)) {
      icon.container.setScale(k);
      icon.container.setPosition(x, y0 + icon.slot * HUD_ICON_STEP * k);
    }
    this._hudRect = new Phaser.Geom.Rectangle(
      safe.right - (HUD_ICON_MARGIN + HUD_ICON_SIZE) * k,
      safe.top,
      (HUD_ICON_MARGIN + HUD_ICON_SIZE) * k,
      stackHeight * k,
    );
  }

  /**
   * Where the reel widget goes: the bottom-right corner of the visible
   * screen. On short screens (phones) that corner sits right under the
   * HUD stack, so the reel slides left until its glow clears the icons --
   * a stray tap on the bait icon mid-reel would abort the catch.
   */
  _reelPosition() {
    const safe = this.layout.safe;
    let x = safe.right - REEL_OFFSET_X;
    const y = safe.bottom - REEL_OFFSET_Y;
    const hud = this._hudRect;
    if (hud && y - REEL_GLOW_RADIUS < hud.bottom + 10) {
      x = Math.min(x, hud.left - 20 - REEL_GLOW_RADIUS);
    }
    return { x, y };
  }

  /**
   * Refresh the three HUD icons with the current selection / last catch.
   * Each overlay is scaled to fit roughly inside the inner circle of the
   * icon (about 65% of the icon size).
   */
  _refreshHud() {
    if (!this.hudIcons) return;
    const INNER_RATIO = 0.65;

    // --- Fish icon: last caught fish ---
    const fish = this.hudIcons.fish;
    const lastCatch = SaveSystem.getLastCatch();
    if (lastCatch && this.textures.exists(fishTextureKey(lastCatch.species, lastCatch.size))) {
      const key = fishTextureKey(lastCatch.species, lastCatch.size);
      fish.overlay.setTexture(key);
      this._fitOverlayInside(fish.overlay, fish.sizePx * INNER_RATIO);
      fish.overlay.setVisible(true);
    } else {
      fish.overlay.setVisible(false);
    }

    // --- Float icon: selected float full sprite ---
    const fl = this.hudIcons.float;
    const flId = SaveSystem.getSelectedFloat() || DEFAULT_FLOAT_ID;
    const flKey = floatFullTextureKey(flId);
    if (this.textures.exists(flKey)) {
      fl.overlay.setTexture(flKey);
      this._fitOverlayInside(fl.overlay, fl.sizePx * INNER_RATIO);
      fl.overlay.setVisible(true);
    } else {
      fl.overlay.setVisible(false);
    }

    // --- Bait icon: selected bait simple sprite ---
    const ba = this.hudIcons.bait;
    const baId = SaveSystem.getSelectedBait() || DEFAULT_BAIT_ID;
    const baKey = baitSimpleTextureKey(baId);
    if (this.textures.exists(baKey)) {
      ba.overlay.setTexture(baKey);
      this._fitOverlayInside(ba.overlay, ba.sizePx * INNER_RATIO);
      ba.overlay.setVisible(true);
    } else {
      ba.overlay.setVisible(false);
    }
  }

  _fitOverlayInside(image, targetSize) {
    // Scale uniformly so the LARGER dimension matches `targetSize`. Smaller
    // dim then fits naturally inside the icon's circular inner area.
    const longest = Math.max(image.width, image.height);
    if (longest > 0) image.setScale(targetSize / longest);
  }

  /**
   * Pause this scene and launch a modal selection scene on top.
   * The modal closes itself with scene.wake('FishingScene') which triggers
   * our WAKE listener and refreshes the HUD.
   */
  _openModal(sceneKey) {
    this._cancelAllPhaseLogic();
    this.scene.sleep();
    this.scene.run(sceneKey);
  }

  // ---------------------------------------------------------------------------
  // Calibration overlay
  //
  // Press 'C' to toggle: a red dot marks the current rod tip and a hint text
  // is shown. While active, Shift+Click anywhere updates the rod tip live and
  // logs the (x, y) offset to the browser console -- paste those numbers into
  // ROD_TIP_OFFSET_X/Y above to persist.
  // ---------------------------------------------------------------------------

  _buildCalibrationOverlay() {
    // Red dot, initially hidden, sitting on top of everything.
    this.calibrationDot = this.add.circle(this.rodTip.x, this.rodTip.y, 5, 0xff0040);
    this.calibrationDot.setStrokeStyle(2, 0xffffff, 1);
    this.calibrationDot.setDepth(100);
    this.calibrationDot.setVisible(false);

    // Small bottom-left hint badge.
    this.calibrationHint = this.add.text(
      10, GAME_HEIGHT - 28,
      'CAL: Shift+Click rod tip in sprite to log offsets',
      { fontFamily: 'monospace', fontSize: '14px', color: '#ffffff', backgroundColor: '#000000aa', padding: { x: 6, y: 3 } }
    );
    this.calibrationHint.setDepth(100);
    this.calibrationHint.setVisible(false);

    // Toggle on 'C'. Keyboard plugin is undefined in headless tests.
    this.input.keyboard?.on('keydown-C', () => {
      this._calibrationActive = !this._calibrationActive;
      this.calibrationDot.setVisible(this._calibrationActive);
      this.calibrationHint.setVisible(this._calibrationActive);
      console.log(`[calibration] ${this._calibrationActive ? 'ON' : 'OFF'}`);
    });

    // Water-curve debug overlay: toggle with 'W'. Draws the parabolic
    // waterline as a translucent cyan fill so you can see exactly where
    // casts are allowed and tune WATER_TOP_CENTER / WATER_TOP_EDGE.
    this.waterBoundsDebug = this.add.graphics();
    this.waterBoundsDebug.setDepth(99);
    this.waterBoundsDebug.setVisible(false);
    this._redrawWaterCurve();

    this.input.keyboard?.on('keydown-W', () => {
      this.waterBoundsDebug.setVisible(!this.waterBoundsDebug.visible);
    });
  }

  _redrawWaterCurve() {
    const g = this.waterBoundsDebug;
    if (!g) return;
    g.clear();
    g.fillStyle(0x00ffff, 0.25);
    g.lineStyle(2, 0x00ffff, 0.9);
    const SAMPLES = 64;
    g.beginPath();
    g.moveTo(WORLD_LEFT, WORLD_BOTTOM);
    for (let i = 0; i <= SAMPLES; i++) {
      const x = WORLD_LEFT + (WORLD_WIDTH * i) / SAMPLES;
      g.lineTo(x, waterTopAt(x));
    }
    g.lineTo(WORLD_RIGHT, WORLD_BOTTOM);
    g.closePath();
    g.fillPath();
    g.strokePath();
  }

  /**
   * Tries to interpret a click as a calibration drop.
   * Returns true when the click was consumed by calibration.
   */
  _maybeHandleCalibrationClick(pointer) {
    if (!this._calibrationActive) return false;
    if (!(pointer.event && pointer.event.shiftKey)) return false;

    const topLeftX = this.julianSprite.x;
    const topLeftY = this.julianSprite.y - this.julianSprite.displayHeight;
    const world = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
    const offsetX = Math.round(world.x - topLeftX);
    const offsetY = Math.round(world.y - topLeftY);

    this._rodTipOffsetX = offsetX;
    this._rodTipOffsetY = offsetY;
    this._recomputeRodTip();

    console.log(
      `[calibration] ROD_TIP_OFFSET_X = ${offsetX};  ROD_TIP_OFFSET_Y = ${offsetY};`
    );
    return true;
  }

  // ---------------------------------------------------------------------------
  // Input handling
  // ---------------------------------------------------------------------------

  _onPointerDown(pointer) {
    // Calibration takes precedence -- Shift+Click never casts.
    if (this._maybeHandleCalibrationClick(pointer)) return;

    // pointer.x/y are canvas pixels; the camera decides which part of the
    // world those pixels show, so translate to design coordinates first.
    const { x, y } = this.cameras.main.getWorldPoint(pointer.x, pointer.y);

    switch (this.state) {
      case STATE.READY:
        if (this._isInsideWater(x, y)) this._beginCast(x, y);
        break;

      case STATE.CASTING:
        // Ignore -- bobber already in flight.
        break;

      case STATE.IDLE:
        // Click outside a bite phase pulls the line in so we can re-cast.
        // For a 4-year-old this is more forgiving than "ignored".
        this._enterReady();
        break;

      case STATE.NIBBLE:
        this._missBite();
        break;

      case STATE.DIVE:
        this._catchFish();
        break;

      case STATE.REELING:
        // Reel widget owns input. Don't recast / don't catch from here.
        break;

      case STATE.CATCHING:
        // Animation in progress -- ignore.
        break;
    }
  }

  _isInsideWater(x, y) {
    if (x < WORLD_LEFT || x >= WORLD_RIGHT) return false;
    if (y > WORLD_BOTTOM) return false;
    return y >= waterTopAt(x);
  }

  // ---------------------------------------------------------------------------
  // State transitions
  // ---------------------------------------------------------------------------

  _enterReady() {
    this._hideFishOn();
    this._cancelAllPhaseLogic();
    this.state = STATE.READY;
    // Idle pose (head facing left, looking at us) while the rod is in hand
    // and the line isn't out yet.
    this._setJulianPose(false);
    this.bobber.setVisible(false);
    this.bobber.setScale(1);
    this.bobber.setAlpha(1);
    this.bobber.x = this.rodTip.x;
    this.bobber.y = this.rodTip.y;
    this.bobberBaseScale = 1;
  }

  /**
   * Swap Julian's sprite texture based on whether the line is out:
   *   isLineOut === true  -> fishing pose (head facing right, watching water)
   *   isLineOut === false -> idle pose   (head facing left)
   * Both source images are aligned on the tackle box so the swap reads as
   * a head turn, not a body jump. Falls back gracefully when the fishing
   * sprite isn't loaded.
   */
  _setJulianPose(isLineOut) {
    if (!this.julianSprite) return;
    const fallbackKey = TEX.JULIAN_IDLE_1;
    const wantedKey = isLineOut && this.textures.exists(TEX.JULIAN_FISHING_LIVE)
      ? TEX.JULIAN_FISHING_LIVE
      : fallbackKey;
    if (this.julianSprite.texture.key === wantedKey) return;
    this.julianSprite.setTexture(wantedKey);
    // Re-apply target display height -- setTexture resets to source dims.
    this._scaleToHeight(this.julianSprite, GAME_HEIGHT * SPRITE_SCALE);
  }

  _beginCast(targetX, targetY) {
    this.state = STATE.CASTING;
    this.audio.playSfx(SFX.CAST);
    // Switch to "line is out" pose as soon as the cast starts. The pose
    // stays through idle/nibble/dive/reeling/catching; _enterReady flips
    // back to the calm idle.
    this._setJulianPose(true);

    // Rod animation: windup back, then snap forward, then settle.
    this._playCastRodAnimation();

    // Hide the bobber during the windup. It "appears" at the rod tip the
    // moment the rod transitions from going back to going forward, which
    // is when the line would be released in a real cast.
    this.bobber.setVisible(false);

    // Schedule the actual bobber release + arc to start AFTER the windup
    // finishes -- i.e. as the throw begins.
    this.time.delayedCall(ROD_CAST_WINDUP_MS, () => {
      if (this.state !== STATE.CASTING) return;   // cancelled by reset
      this.bobber.setVisible(true);
      this.bobber.setScale(1);
      this.bobber.setAlpha(1);
      this.bobber.x = this.rodTip.x;
      this.bobber.y = this.rodTip.y;

      const startX = this.rodTip.x;
      const startY = this.rodTip.y;
      const midX = (startX + targetX) / 2;
      const peakY = Math.min(startY, targetY) - CAST_ARC_HEIGHT;
      const targetScale = this._bobberDepthScale(targetY);

      const progress = { t: 0 };
      this.activeCastTween = this.tweens.add({
        targets: progress,
        t: 1,
        duration: CAST_DURATION_MS,
        ease: 'Sine.easeOut',
        onUpdate: () => {
          const t = progress.t;
          const inv = 1 - t;
          const x = inv * inv * startX + 2 * inv * t * midX + t * t * targetX;
          const y = inv * inv * startY + 2 * inv * t * peakY + t * t * targetY;
          this.bobber.x = x;
          this.bobber.y = y;
          this.bobber.setScale(Phaser.Math.Linear(1, targetScale, t));
        },
        onComplete: () => {
          this.activeCastTween = null;
          this._enterIdle(targetX, targetY);
        },
      });
    });
  }

  _enterIdle(x, y, playSplash = true) {
    this.state = STATE.IDLE;
    // "playSplash" here actually means "the bobber just landed" -- the
    // sfx is now PLOP rather than SPLASH. Name kept for parameter
    // compatibility with existing call sites.
    if (playSplash) this.audio.playSfx(SFX.PLOP);

    this.bobber.x = x;
    this.bobber.y = y;
    this.bobberHomeY = y;
    // Lock in the perspective scale for this drop position. Dive/resurface
    // tweens read this so they animate relative to the right baseline.
    this.bobberBaseScale = this._bobberDepthScale(y);
    this.bobber.setScale(this.bobberBaseScale);

    this.bobTween = this.tweens.add({
      targets: this.bobber,
      y: y - BOB_AMPLITUDE,
      duration: BOB_PERIOD_MS / 2,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    const delay = Phaser.Math.Between(BITE_DELAY_MIN, BITE_DELAY_MAX);
    this.biteTimer = this.time.delayedCall(delay, () => this._enterNibble());
  }

  _enterNibble() {
    if (this.state !== STATE.IDLE) return;
    this.state = STATE.NIBBLE;
    this.audio.playSfx(SFX.NIBBLE);

    this._stopBobTween();

    // Pick a bite-variation once per nibble so the resulting dive behaviour
    // can read it. The choice is sticky for this whole bite cycle.
    this.biteVariation = pickBiteVariation();

    // Subtle downward tugs -- the bobber gets pulled down a few pixels and
    // released, with a hold between jerks so the rhythm reads as "fish is
    // testing the bait", not "vibrating". Easing accelerates into the dip
    // and eases out coming back, giving the jerks a slight snap.
    const baseX = this.bobber.x;
    const baseY = this.bobber.y;
    this.nibbleTween = this.tweens.add({
      targets: this.bobber,
      y: baseY + 6,           // small dip
      duration: 110,
      hold: 200,              // pause when down
      repeatDelay: 350,       // pause when back up between tugs
      yoyo: true,
      repeat: -1,
      ease: 'Quad.easeIn',
    });

    // Nibble duration depends on the chosen variation.
    let nibbleMs;
    switch (this.biteVariation) {
      case 'quick': nibbleMs = Phaser.Math.Between(QUICK_NIBBLE_MIN, QUICK_NIBBLE_MAX); break;
      case 'fake':  nibbleMs = Phaser.Math.Between(FAKE_NIBBLE_MIN,  FAKE_NIBBLE_MAX);  break;
      case 'normal':
      case 'drift':
      default:      nibbleMs = Phaser.Math.Between(NIBBLE_MIN, NIBBLE_MAX);
    }

    this.phaseTimer = this.time.delayedCall(nibbleMs, () => {
      if (this.state !== STATE.NIBBLE) return;
      if (this.biteVariation === 'fake') {
        this._endNibbleNoBite(baseX);
      } else {
        this._enterDive(baseX);
      }
    });
  }

  /**
   * 'Fake bite' resolution: nibble ends, fish swims away, bobber returns
   * to idle bobbing. No dive phase, so the player gets no catch chance.
   * Realistic and teaches "not every nibble is a fish".
   */
  _endNibbleNoBite(restX) {
    if (this.state !== STATE.NIBBLE) return;
    if (this.nibbleTween) {
      this.nibbleTween.stop();
      this.nibbleTween = null;
    }
    this.bobber.x = restX;
    // Glide the bobber back up to its idle Y, then resume the idle bob.
    this.tweens.add({
      targets: this.bobber,
      y: this.bobberHomeY,
      duration: 200,
      ease: 'Sine.easeOut',
      onComplete: () => {
        if (this.state !== STATE.NIBBLE) return;
        // Reset state and start the idle bob + wait-for-bite cycle again.
        // No splash sfx -- the fish never actually struck.
        this.state = STATE.IDLE;
        this._enterIdle(this.bobber.x, this.bobberHomeY, /* playSplash */ false);
      },
    });
  }

  _enterDive(restX) {
    if (this.state !== STATE.NIBBLE) return;
    this.state = STATE.DIVE;
    this.audio.playSfx(SFX.DIVE);
    // Strike window opens: show "fish on" indicator above Julian + a
    // single ping, but with a 500ms beat so it doesn't fire on top of
    // the dive splash. State-check guards against a quick strike or
    // resurface before the timer fires. Cleared in _catchFish /
    // _resurfaceAndIdle / _enterReady / _missBite.
    this.time.delayedCall(125, () => {
      if (this.state !== STATE.DIVE) return;
      this._showFishOn();
      this.audio.playSfx(SFX.FISHON);
    });

    if (this.nibbleTween) {
      this.nibbleTween.stop();
      this.nibbleTween = null;
    }
    this.bobber.x = restX;

    // Scale dips a bit below the depth-baseline -- the float is being
    // pulled under, so it should look smaller, but still keyed off the
    // perspective scale rather than absolute 0.85.
    const base = this.bobberBaseScale ?? 1;

    // 'drift' variation: dive is slow and angles to the side. Everything
    // else dives straight down.
    const isDrift = this.biteVariation === 'drift';
    const diveTweenCfg = {
      targets: this.bobber,
      y: this.bobberHomeY + (isDrift ? 22 : 30),
      alpha: 0.35,
      scale: base * 0.85,
      duration: isDrift ? DRIFT_DIVE_DURATION_MS : 220,
      ease: isDrift ? 'Sine.easeInOut' : 'Sine.easeIn',
    };
    if (isDrift) {
      // Pick a side (left/right) and a magnitude so each drift bite reads
      // differently. Update bobberHomeY too so the resurface tween lands
      // back on the post-drift position rather than the original spot.
      const driftSign   = Math.random() < 0.5 ? -1 : 1;
      const driftAmount = Phaser.Math.Between(DRIFT_OFFSET_MIN, DRIFT_OFFSET_MAX);
      diveTweenCfg.x = restX + driftSign * driftAmount;
    }
    this.tweens.add(diveTweenCfg);

    const duration = Phaser.Math.Between(DIVE_MIN, DIVE_MAX);
    this.phaseTimer = this.time.delayedCall(duration, () => {
      if (this.state !== STATE.DIVE) return;
      this._resurfaceAndIdle();
    });
  }

  _resurfaceAndIdle() {
    this._hideFishOn();
    const base = this.bobberBaseScale ?? 1;
    this.tweens.add({
      targets: this.bobber,
      y: this.bobberHomeY,
      alpha: 1,
      scale: base,
      duration: 220,
      ease: 'Sine.easeOut',
      onComplete: () => {
        if (this.state !== STATE.DIVE) return;
        this._enterIdle(this.bobber.x, this.bobberHomeY);
      },
    });
  }

  // ---------------------------------------------------------------------------
  // Outcomes
  // ---------------------------------------------------------------------------

  _missBite() {
    this._hideFishOn();
    this.audio.playSfx(SFX.MISS);
    this._stopPhaseTimer();
    if (this.nibbleTween) {
      this.nibbleTween.stop();
      this.nibbleTween = null;
    }
    this.tweens.add({
      targets: this.bobber,
      alpha: 0.4,
      duration: 120,
      yoyo: true,
      onComplete: () => {
        this.bobber.alpha = 1;
        this._enterReady();
      },
    });
  }

  _catchFish() {
    this._hideFishOn();
    this._stopPhaseTimer();
    this._stopBobTween();

    // Strike! Quick rod-tilt backward to "set the hook".
    this._playStrikeRodAnimation();

    // Pick a fish according to the currently selected bait. legacyShape() keeps
    // the FishingCollectionScene happy; pick {species,size} drives the catch
    // display + SaveSystem.
    const baitId = SaveSystem.getSelectedBait() || DEFAULT_BAIT_ID;
    const pick = weightedPick(baitId) || weightedPick('wormen');

    // Phase 7: predators + any "large" fish demand the reel widget. Smaller
    // peaceful fish use the original single-tap catch as before.
    if (requiresReel(pick)) {
      this._enterReeling(pick);
    } else {
      this._performCatchLeap(pick);
    }
  }

  /**
   * Show the reel widget and wait until the player completes the required
   * number of turns. On success → standard catch leap + display.
   */
  _enterReeling(pick) {
    this.state = STATE.REELING;
    this.audio.playSfx(SFX.NIBBLE);   // little "tension" beep, no dedicated SFX yet

    // Kill any in-flight bobber tween (the DIVE tween is still moving x/y
    // when the player strikes mid-dive). Without this, the dive tween and
    // our update()-driven lerp fight every frame and the bobber jitters
    // wildly across the canvas.
    this.tweens.killTweensOf(this.bobber);

    // Where the fish currently is (underwater, where it got hooked). The
    // endpoint is computed in update() from the live rod tip so the line
    // pulls TOWARD Julian's rod and stops there -- never past him.
    const startX = this.bobber ? this.bobber.x : this.rodTip.x;
    const startY = (this.bobber ? this.bobber.y : this.rodTip.y) + 8;
    this.reelEnd = { startX, startY };

    // The fish is "on the line" -- hide the bobber sprite; only the line
    // is drawn during this phase, pulling toward the pier endpoint.
    if (this.bobber) {
      this.bobber.setVisible(false);
      this.bobber.x = startX;
      this.bobber.y = startY;
    }

    const turns = reelTurnsFor(pick);
    // Position: bottom-right corner of the visible screen, clear of the
    // 3-icon HUD stack. Follows the screen on rotation via _applyLayout.
    const reelPos = this._reelPosition();

    this.reelOverlay = new ReelOverlay(this, {
      x: reelPos.x,
      y: reelPos.y,
      requiredTurns: turns,
      onComplete: () => {
        this.reelOverlay = null;
        // Plant the bobber in the water right under the rod tip so the
        // catch-leap arcs UP from there -- the "fish breaks the surface
        // right under the rod" moment.
        if (this.bobber) {
          this.bobber.setVisible(true);
          this.bobber.x = this.rodTip.x;
          this.bobber.y = waterTopAt(this.rodTip.x) + 40;
        }
        this._performCatchLeap(pick);
        this.reelEnd = null;
      },
    });
  }

  /**
   * Bobber arc toward the rod tip → record the catch → launch the
   * fullscreen catch display. Used both by direct catches (small fish)
   * and by the reel-success path.
   */
  _performCatchLeap(pick) {
    this.state = STATE.CATCHING;
    // Splash fires at the START of the leap -- the fish breaks the water.
    // Applause + voice follow once the catch display opens.
    this.audio.playSfx(SFX.SPLASH);
    SaveSystem.recordCatch(pick);

    const startX = this.bobber.x;
    const startY = this.bobber.y;
    const endX = this.rodTip.x;
    const endY = this.rodTip.y;
    const peakY = Math.min(startY, endY) - 120;

    const progress = { t: 0 };
    this.tweens.add({
      targets: progress,
      t: 1,
      duration: CATCH_LEAP_MS,
      ease: 'Sine.easeOut',
      onUpdate: () => {
        const t = progress.t;
        const inv = 1 - t;
        const x = inv * inv * startX + 2 * inv * t * ((startX + endX) / 2) + t * t * endX;
        const y = inv * inv * startY + 2 * inv * t * peakY + t * t * endY;
        this.bobber.x = x;
        this.bobber.y = y;
      },
      onComplete: () => {
        this.bobber.setVisible(false);
        this.scene.sleep();
        this.scene.run('CatchDisplayScene', {
          species: pick.species,
          size: pick.size,
          lengthCm: pick.lengthCm,
        });
      },
    });
  }

  // ---------------------------------------------------------------------------
  // Cleanup helpers
  // ---------------------------------------------------------------------------

  _stopBobTween() {
    if (this.bobTween) {
      this.bobTween.stop();
      this.bobTween = null;
    }
  }

  _stopPhaseTimer() {
    if (this.phaseTimer) {
      this.phaseTimer.remove(false);
      this.phaseTimer = null;
    }
    if (this.biteTimer) {
      this.biteTimer.remove(false);
      this.biteTimer = null;
    }
  }

  _cancelAllPhaseLogic() {
    this._stopPhaseTimer();
    this._stopBobTween();
    if (this.nibbleTween) {
      this.nibbleTween.stop();
      this.nibbleTween = null;
    }
    if (this.activeCastTween) {
      this.activeCastTween.stop();
      this.activeCastTween = null;
    }
    if (this.reelOverlay) {
      this.reelOverlay.destroy();
      this.reelOverlay = null;
    }
  }
}
