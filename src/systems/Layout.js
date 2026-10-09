import Phaser from 'phaser';
import {
  GAME_WIDTH, GAME_HEIGHT,
  WORLD_WIDTH, WORLD_HEIGHT, WORLD_LEFT, WORLD_TOP,
} from '../constants.js';

/**
 * Responsive layout.
 *
 * The Phaser canvas is world-sized (1280x960, 4:3 like every painting in
 * the game) and scaled with Scale.ENVELOP, so it always COVERS the screen:
 *
 *   - 4:3 iPad        -> the whole world is visible, nothing cropped
 *   - wider screens   -> top/bottom of the world is cropped (phones, desktop)
 *   - narrower screens-> left/right of the world is cropped
 *
 * Scenes keep working in design-frame coordinates (1280x720, see
 * constants.js). This module positions each scene's camera so the right
 * slice of the world is on screen, and reports which part of design space
 * is actually visible so UI can be anchored to the real screen edges
 * instead of to a fixed frame.
 *
 * Because backdrop, sprites, clouds and UI now all derive from this one
 * transform, they can no longer drift apart on screens that aren't 4:3.
 *
 * Two modes:
 *   'world' -- zoom 1, the scene is locked to the painting. `alignX/alignY`
 *              (0..1) choose which slice survives a crop; `keepTop` /
 *              `keepBottom` are design-y values that must stay on screen.
 *   'frame' -- for menus: the camera zooms out just enough that a
 *              `fitWidth` x `fitHeight` box centred on the design frame is
 *              fully visible, whatever the aspect ratio.
 */

const CANVAS_CX = WORLD_WIDTH / 2;
const CANVAS_CY = WORLD_HEIGHT / 2;

// Height of the iPadOS status bar that overlays a home-screen web app.
const IPAD_STATUS_BAR_PX = 20;

let insetProbe = null;

/**
 * Device safe-area insets (notch, home indicator, iPad status bar in
 * standalone mode) in CSS px. Read through a hidden probe element because
 * env() values aren't reachable from JS directly.
 */
function readSafeAreaInsets() {
  if (typeof document === 'undefined' || !document.body) {
    return { top: 0, right: 0, bottom: 0, left: 0 };
  }
  if (!insetProbe) {
    insetProbe = document.createElement('div');
    insetProbe.style.cssText =
      'position:fixed;top:0;left:0;width:0;height:0;visibility:hidden;pointer-events:none;' +
      'padding-top:env(safe-area-inset-top,0px);padding-right:env(safe-area-inset-right,0px);' +
      'padding-bottom:env(safe-area-inset-bottom,0px);padding-left:env(safe-area-inset-left,0px);';
    document.body.appendChild(insetProbe);
  }
  const cs = getComputedStyle(insetProbe);
  const insets = {
    top:    parseFloat(cs.paddingTop)    || 0,
    right:  parseFloat(cs.paddingRight)  || 0,
    bottom: parseFloat(cs.paddingBottom) || 0,
    left:   parseFloat(cs.paddingLeft)   || 0,
  };

  // An iPad home-screen app draws the status bar (clock, battery) on top
  // of the page, in landscape too. That strip is normally reported as the
  // top inset; guarantee it, so corner UI can never end up underneath the
  // battery icon. (navigator.standalone only exists on iOS / iPadOS; the
  // size check leaves phones alone -- they hide the bar in landscape.)
  const standalone = typeof navigator !== 'undefined' && navigator.standalone === true;
  if (standalone && Math.min(window.innerWidth, window.innerHeight) >= 700) {
    insets.top = Math.max(insets.top, IPAD_STATUS_BAR_PX);
  }
  return insets;
}

/**
 * Measure the canvas against its container and derive the camera transform.
 * Returns null while the page has no size yet (hidden tab, mid-rotation).
 */
function computeLayout(scene, opts) {
  const canvas = scene.game.canvas;
  const container = canvas.parentElement || document.body;
  const c = canvas.getBoundingClientRect();
  const p = container.getBoundingClientRect();
  if (!(c.width > 0 && c.height > 0 && p.width > 0 && p.height > 0)) return null;

  // CSS px per canvas px, and the window of the canvas that is actually on
  // screen (in canvas px). Measured rather than derived from the scale
  // mode so we match exactly what Phaser put in the DOM, rounding included.
  const cssPerCanvas = c.width / WORLD_WIDTH;
  const winLeft   = (p.left - c.left) / cssPerCanvas;
  const winTop    = (p.top  - c.top)  / cssPerCanvas;
  const winWidth  = p.width  / cssPerCanvas;
  const winHeight = p.height / cssPerCanvas;

  let zoom = 1;
  let viewLeft;
  let viewTop;

  if (opts.mode === 'frame') {
    const fitW = opts.fitWidth  ?? GAME_WIDTH;
    const fitH = opts.fitHeight ?? GAME_HEIGHT;
    zoom = Math.min(1, winWidth / fitW, winHeight / fitH);
    viewLeft = GAME_WIDTH  / 2 - winWidth  / zoom / 2;
    viewTop  = GAME_HEIGHT / 2 - winHeight / zoom / 2;
  } else {
    const slackX = Math.max(0, WORLD_WIDTH  - winWidth);
    const slackY = Math.max(0, WORLD_HEIGHT - winHeight);
    viewLeft = WORLD_LEFT + slackX * (opts.alignX ?? 0.5);
    viewTop  = WORLD_TOP  + slackY * (opts.alignY ?? 0.5);
    if (opts.keepBottom != null) viewTop = Math.max(viewTop, opts.keepBottom - winHeight);
    if (opts.keepTop    != null) viewTop = Math.min(viewTop, opts.keepTop);
    viewLeft = Phaser.Math.Clamp(viewLeft, WORLD_LEFT, WORLD_LEFT + slackX);
    viewTop  = Phaser.Math.Clamp(viewTop,  WORLD_TOP,  WORLD_TOP  + slackY);
  }

  // Phaser cameras zoom around their centre:
  //   canvas = (design - scroll - centre) * zoom + centre
  // Solve for the scroll that puts (viewLeft, viewTop) at the window's
  // top-left corner.
  const scrollX = viewLeft - CANVAS_CX - (winLeft - CANVAS_CX) / zoom;
  const scrollY = viewTop  - CANVAS_CY - (winTop  - CANVAS_CY) / zoom;

  const scale = cssPerCanvas * zoom;             // CSS px per design px
  const view = new Phaser.Geom.Rectangle(viewLeft, viewTop, winWidth / zoom, winHeight / zoom);

  const inset = readSafeAreaInsets();
  const safe = new Phaser.Geom.Rectangle(
    view.x + inset.left / scale,
    view.y + inset.top / scale,
    Math.max(1, view.width  - (inset.left + inset.right) / scale),
    Math.max(1, view.height - (inset.top + inset.bottom) / scale),
  );

  return {
    /** Visible part of design space. */
    view,
    /** `view` minus notch / home indicator / status bar. Put UI in here. */
    safe,
    /** CSS px per design px. */
    scale,
    zoom,
    scrollX,
    scrollY,
    /** The game container's rect in viewport CSS px (for fixed DOM layers). */
    container: { left: p.left, top: p.top, width: p.width, height: p.height },
    /**
     * Convert a design-space rectangle to CSS px relative to the game
     * container's top-left -- for DOM layers that must line up with what
     * the canvas draws (backdrop video, clouds).
     */
    cssRect(x, y, width, height) {
      return {
        left:   (x - viewLeft) * scale,
        top:    (y - viewTop)  * scale,
        width:  width  * scale,
        height: height * scale,
      };
    },
  };
}

/**
 * Position `scene`'s main camera for the current screen and call
 * `onLayout(layout)` -- now, and again whenever the screen changes size
 * or orientation. The latest layout is also kept on `scene.layout`.
 *
 * Safe to call from create() every time a scene (re)starts: listeners are
 * removed on shutdown.
 */
export function bindLayout(scene, opts = {}, onLayout = null) {
  const apply = () => {
    const layout = computeLayout(scene, opts);
    if (!layout) return;
    const cam = scene.cameras.main;
    cam.setZoom(layout.zoom);
    cam.setScroll(layout.scrollX, layout.scrollY);
    scene.layout = layout;
    if (onLayout) onLayout(layout);
  };

  apply();
  scene.scale.on(Phaser.Scale.Events.RESIZE, apply);
  // A scene that slept through a rotation still gets the RESIZE event, but
  // re-applying on wake is cheap insurance.
  scene.events.on(Phaser.Scenes.Events.WAKE, apply);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
    scene.scale.off(Phaser.Scale.Events.RESIZE, apply);
    scene.events.off(Phaser.Scenes.Events.WAKE, apply);
  });

  return apply;
}
