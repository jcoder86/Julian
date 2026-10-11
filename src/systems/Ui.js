import Phaser from 'phaser';

/**
 * The look of the game's menus: carved wood, rope and chunky lettering,
 * after the title sign. Shared by every scene that shows text or a button,
 * so they all change together.
 *
 * The pictures (assets/clean/ui-*.png) are cut by scripts/make_ui.py and
 * scripts/make_characters.py; BootScene loads them under the keys below.
 */

// A friendly rounded face. "Arial Rounded MT Bold" ships with iOS / iPadOS
// and macOS, which is where the game is played; elsewhere the next one
// that exists is used.
export const UI_FONT =
  '"Arial Rounded MT Bold", "Baloo 2", "Fredoka", "Nunito", "Trebuchet MS", "Segoe UI", sans-serif';

export const UI = Object.freeze({
  START: 'ui-start',             // the START sign: plain wood left, lettering right
  // Blank boards cut from that sign, in three shapes:
  BOARD_CARD: 'ui-board-card',   // a species in the collection
  BOARD_PANEL: 'ui-board-panel', // behind a menu's row of choices
  BOARD_LABEL: 'ui-board-label', // under a caught fish
});

/** A team's "go on fishing" button: its angler in a rope frame. */
export function continueKey(teamId) {
  return `ui-continue-${teamId}`;
}

// Colours of the lettering.
const INK = '#3a1d06';           // dark brown outline, as carved
export const COLOR = Object.freeze({
  GOLD: '#ffd23c',               // titles, names of fish
  CREAM: '#fff3d6',              // everything else on wood
  FADED: '#c9a878',              // "nothing here yet"
  GLOW: 0xffd24a,                // highlight behind what is selected
  INSET: 0x2b1505,               // darker slot let into a board
});

/**
 * Text style for lettering on wood (or on a painting).
 * @param {number} size   font size in design px
 * @param {string} color  one of COLOR.*
 */
export function lettering(size, color = COLOR.CREAM) {
  return {
    fontFamily: UI_FONT,
    fontSize: `${size}px`,
    fontStyle: 'bold',
    color,
    stroke: INK,
    strokeThickness: Math.max(3, Math.round(size * 0.16)),
    shadow: { offsetX: 0, offsetY: Math.max(1, Math.round(size * 0.06)), color: '#000000', blur: 4, fill: true, stroke: true },
  };
}

/**
 * A soft glow that breathes: the "tap me" (or "this one") cue. Vector, so
 * it can pulse without the shimmer a scaled picture would get.
 * `shape`: { w, h, radius } for a rounded box, or { r } for a circle.
 */
export function addGlow(scene, x, y, shape, color = COLOR.GLOW) {
  const glow = scene.add.graphics({ x, y });
  // A few stacked, ever larger and fainter shapes read as a soft edge.
  for (let i = 4; i >= 0; i--) {
    const grow = i * 5;
    glow.fillStyle(color, 0.16);
    if (shape.r) glow.fillCircle(0, 0, shape.r + grow);
    else {
      glow.fillRoundedRect(-shape.w / 2 - grow, -shape.h / 2 - grow,
                           shape.w + grow * 2, shape.h + grow * 2, (shape.radius ?? 20) + grow);
    }
  }
  glow.setBlendMode(Phaser.BlendModes.ADD);
  scene.tweens.add({
    targets: glow,
    alpha: { from: 0.35, to: 1 },
    scale: { from: 1, to: 1.05 },
    duration: 1100,
    yoyo: true,
    repeat: -1,
    ease: 'Sine.easeInOut',
  });
  return glow;
}

/**
 * A big, soft, round shine that fades to nothing at its edge (behind a
 * trophy fish). One small picture of a fading disc, made once and
 * stretched to whatever size is asked for.
 */
export function addHalo(scene, x, y, radius, color = COLOR.GLOW) {
  const key = 'ui-halo';
  if (!scene.textures.exists(key)) {
    const size = 256;
    const texture = scene.textures.createCanvas(key, size, size);
    const ctx = texture.getContext();
    const fade = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    fade.addColorStop(0, 'rgba(255,255,255,0.9)');
    fade.addColorStop(0.45, 'rgba(255,255,255,0.45)');
    fade.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = fade;
    ctx.fillRect(0, 0, size, size);
    texture.refresh();
  }
  const halo = scene.add.image(x, y, key);
  halo.setDisplaySize(radius * 2, radius * 2);
  halo.setTint(color);
  halo.setBlendMode(Phaser.BlendModes.ADD);
  const base = halo.scale;
  scene.tweens.add({
    targets: halo,
    alpha: { from: 0.45, to: 0.85 },
    scale: { from: base, to: base * 1.12 },
    duration: 1100,
    yoyo: true,
    repeat: -1,
    ease: 'Sine.easeInOut',
  });
  return halo;
}

/**
 * Make something feel like a button: it dips when pressed, and `onTap`
 * runs a moment later, when the dip has been seen.
 */
export function pressable(scene, target, onTap, hit = target) {
  const base = target.scale;
  hit.setInteractive({ useHandCursor: true });
  hit.on('pointerdown', (_pointer, _x, _y, event) => {
    if (event && event.stopPropagation) event.stopPropagation();
    scene.tweens.add({ targets: target, scale: base * 0.94, duration: 70, yoyo: true });
    scene.time.delayedCall(110, onTap);
  });
}

/** A darker slot let into a board: a rounded, see-through brown box. */
export function addInset(scene, x, y, w, h, alpha = 0.5) {
  const g = scene.add.graphics({ x, y });
  g.fillStyle(COLOR.INSET, alpha);
  g.fillRoundedRect(-w / 2, -h / 2, w, h, Math.min(12, h / 2));
  g.lineStyle(2, 0x1a0c02, Math.min(1, alpha + 0.2));
  g.strokeRoundedRect(-w / 2, -h / 2, w, h, Math.min(12, h / 2));
  return g;
}

// ---------------------------------------------------------------------------
// A menu: a row of things to choose from, on a wooden board
// ---------------------------------------------------------------------------

export const MENU_W = 1000;      // the board's picture is 1500 x 594
export const MENU_H = 396;
const MENU_PAD_X = 68;           // the rope and the nails at the board's ends
const MENU_PAD_Y = 40;
const SLOT_GAP = 10;
// Each choice lies in a slot of deep water blue: bread, maggots, worms and
// every float stand out against it.
const SLOT_COLOR = 0x17425e;
const SLOT_COLOR_SELECTED = 0x23678f;

/**
 * Dim the screen and show a board with one slot per choice.
 * @param choices   [{ texture, label, selected, onPick }]
 * @param onCancel  a tap beside the board
 */
export function addChoiceMenu(scene, cx, cy, choices, onCancel) {
  const scrim = scene.add.rectangle(cx, cy, 6000, 6000, 0x000000, 0.5);
  scrim.setInteractive();
  scrim.on('pointerdown', onCancel);

  const board = scene.textures.exists(UI.BOARD_PANEL)
    ? scene.add.image(cx, cy, UI.BOARD_PANEL).setDisplaySize(MENU_W, MENU_H)
    : scene.add.rectangle(cx, cy, MENU_W, MENU_H, 0x8a4f1d).setStrokeStyle(4, 0x3a1d06);
  board.setInteractive();        // a tap on the wood is not a tap beside the board

  const slotW = (MENU_W - MENU_PAD_X * 2 - SLOT_GAP * (choices.length - 1)) / choices.length;
  const slotH = MENU_H - MENU_PAD_Y * 2;
  choices.forEach((choice, i) => {
    const x = cx - MENU_W / 2 + MENU_PAD_X + slotW / 2 + i * (slotW + SLOT_GAP);
    if (choice.selected) addGlow(scene, x, cy, { w: slotW - 4, h: slotH - 4, radius: 18 });

    const slot = scene.add.container(x, cy);
    const box = scene.add.graphics();
    box.fillStyle(choice.selected ? SLOT_COLOR_SELECTED : SLOT_COLOR, 0.95);
    box.fillRoundedRect(-slotW / 2, -slotH / 2, slotW, slotH, 16);
    box.lineStyle(choice.selected ? 5 : 3, choice.selected ? COLOR.GLOW : 0x1a0c02, 1);
    box.strokeRoundedRect(-slotW / 2, -slotH / 2, slotW, slotH, 16);
    slot.add(box);

    if (scene.textures.exists(choice.texture)) {
      const picture = scene.add.image(0, -16, choice.texture);
      picture.setScale(Math.min((slotW * 0.78) / picture.width, (slotH * 0.70) / picture.height));
      slot.add(picture);
    }
    slot.add(scene.add.text(0, slotH / 2 - 25, choice.label, lettering(19)).setOrigin(0.5));

    slot.setSize(slotW, slotH);
    pressable(scene, slot, choice.onPick);
  });
}
