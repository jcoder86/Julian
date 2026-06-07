// All placeholder visuals live here. Swapping placeholders for real sprites
// is a one-file change: replace each factory's body to spawn an Image/Sprite
// instead of the primitive shapes.

const COLORS = Object.freeze({
  julianBody:   0xc2a878,  // khaki tunic
  julianHead:   0xffe0b2,  // skin
  julianHair:   0x6b4226,  // brown hair cap
  rod:          0x6d3a13,  // dark brown rod
  rodLine:      0xffffff,  // line color
  bobberRed:    0xe53935,  // top half
  bobberWhite:  0xffffff,  // bottom half
  collectionBg: 0xff9a3c,  // collection-button orange
  collectionRing: 0xffffff,
  backButton:   0xeeeeee,
  silhouette:   0x4a4a4a,
});

/**
 * Returns a Phaser Container holding Julian's placeholder visual.
 */
export function createJulianPlaceholder(scene, x, y) {
  const c = scene.add.container(x, y);

  // Body (rounded-ish using a thick rect).
  const body = scene.add.rectangle(0, 18, 36, 50, COLORS.julianBody);
  body.setStrokeStyle(2, 0x000000, 0.2);

  // Head.
  const head = scene.add.circle(0, -22, 16, COLORS.julianHead);
  head.setStrokeStyle(2, 0x000000, 0.2);

  // Hair cap -- arc using a smaller darker circle clipped to top half.
  const hair = scene.add.circle(0, -28, 16, COLORS.julianHair);
  hair.setScale(1, 0.55);

  // Tiny dot eyes so he looks alive.
  const leftEye = scene.add.circle(-5, -20, 1.5, 0x222222);
  const rightEye = scene.add.circle(5, -20, 1.5, 0x222222);

  c.add([body, hair, head, leftEye, rightEye]);
  c.setDepth(10);
  return c;
}

/**
 * Static rod sprite at Julian's hands. The visible "line" is drawn each
 * frame by the FishingScene because it tracks the bobber.
 */
export function createRodPlaceholder(scene, x, y) {
  // Diagonal brown line representing the rod itself.
  const rod = scene.add.line(x, y, 0, 0, 70, -40, COLORS.rod, 1);
  rod.setLineWidth(4);
  rod.setOrigin(0, 0);
  rod.setDepth(11);
  return rod;
}

/**
 * Bobber: a tiny red+white circle. Returned as a container so the scene
 * can tween position/scale uniformly.
 */
export function createBobberPlaceholder(scene, x, y) {
  const c = scene.add.container(x, y);
  const top = scene.add.circle(0, -4, 8, COLORS.bobberRed);
  const bottom = scene.add.circle(0, 4, 8, COLORS.bobberWhite);
  top.setStrokeStyle(1.5, 0x000000, 0.4);
  bottom.setStrokeStyle(1.5, 0x000000, 0.4);
  c.add([bottom, top]);
  c.setDepth(20);
  return c;
}

/**
 * Fish placeholder: a colored ellipse + triangle tail + eye, sized per fish data.
 * Returns a container so we can attach extra elements later (eyes, tail)
 * without changing call sites.
 */
export function createFishPlaceholder(scene, fish, x = 0, y = 0) {
  const c = scene.add.container(x, y);

  // Body.
  const body = scene.add.ellipse(0, 0, fish.size, fish.size * 0.65, fish.color);
  body.setStrokeStyle(2, 0x000000, 0.3);

  // Tail -- a triangle at the back-left.
  const tailW = fish.size * 0.35;
  const tail = scene.add.triangle(
    -fish.size / 2 - tailW / 2, 0,
    0, -tailW * 0.7,
    0, tailW * 0.7,
    tailW, 0,
    fish.color
  );
  tail.setStrokeStyle(2, 0x000000, 0.3);

  // Eye.
  const eye = scene.add.circle(fish.size * 0.25, -fish.size * 0.08, 3, 0x111111);

  c.add([tail, body, eye]);
  return c;
}

/**
 * Same shape as createFishPlaceholder but rendered in a uniform dark gray.
 * Used in the collection scene for fish the player hasn't caught yet.
 */
export function createFishSilhouette(scene, fish, x = 0, y = 0) {
  const c = scene.add.container(x, y);

  const body = scene.add.ellipse(0, 0, fish.size, fish.size * 0.65, COLORS.silhouette);
  const tailW = fish.size * 0.35;
  const tail = scene.add.triangle(
    -fish.size / 2 - tailW / 2, 0,
    0, -tailW * 0.7,
    0, tailW * 0.7,
    tailW, 0,
    COLORS.silhouette
  );

  c.add([tail, body]);
  return c;
}

/**
 * Top-right corner button that opens the collection scene.
 * Returned object exposes a hit area; FishingScene wires up the click handler.
 */
export function createCollectionButton(scene, x, y) {
  const c = scene.add.container(x, y);

  const bg = scene.add.circle(0, 0, 30, COLORS.collectionBg);
  bg.setStrokeStyle(3, COLORS.collectionRing, 1);

  // A miniature fish icon inside the button.
  const icon = scene.add.ellipse(-3, 0, 28, 18, 0xffffff);
  const tail = scene.add.triangle(15, 0, 0, -8, 0, 8, 10, 0, 0xffffff);

  c.add([bg, icon, tail]);
  c.setDepth(50);
  c.setSize(60, 60);
  c.setInteractive({ useHandCursor: true });
  return c;
}

/**
 * Back arrow button for the collection scene.
 */
export function createBackButton(scene, x, y) {
  const c = scene.add.container(x, y);

  const bg = scene.add.circle(0, 0, 28, COLORS.backButton);
  bg.setStrokeStyle(3, 0x222222, 0.6);

  // Left-pointing arrow built from a triangle + a rectangular shaft.
  const arrowTip = scene.add.triangle(-6, 0, 0, -10, 0, 10, -10, 0, 0x222222);
  const arrowShaft = scene.add.rectangle(2, 0, 14, 5, 0x222222);

  c.add([bg, arrowTip, arrowShaft]);
  c.setDepth(50);
  c.setSize(60, 60);
  c.setInteractive({ useHandCursor: true });
  return c;
}
