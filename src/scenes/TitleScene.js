import Phaser from 'phaser';
import {
  WORLD_WIDTH, WORLD_HEIGHT, WORLD_LEFT, WORLD_TOP,
} from '../constants.js';
import { bindLayout } from '../systems/Layout.js';
import { SaveSystem } from '../systems/SaveSystem.js';
import { AudioManager, MUSIC } from '../systems/AudioManager.js';
import { TEAMS } from '../data/teams.js';
import { lettering, addGlow, pressable } from '../systems/Ui.js';

// When a screen wider than 4:3 has to crop the painting top and bottom,
// keep the top: that is where the logo and Julian's face are. 0 = keep the
// very top, 0.5 = crop evenly. Used for BOTH the camera and the DOM
// background's object-position so the two always show the same slice.
const VIEW_ALIGN_Y = 0.1;

// "Who is playing?" -- a block under the painted logo, its middle under the
// logo's middle:
//
//        ( oo )            ( oo )      the teams, each two faces in one frame:
//     Julian & Dirk     James & Boaz   big, and what you tap
//                 (o) Gast             the visitor: grey and smaller
//
// All sizes in design px; the block's origin is the middle of its top edge.
const TEAM_FACES_H = 236;          // a team's picture is round: its two faces in one frame
const TEAM_GAP = 44;               // between the teams
const TEAM_TOP = 0;                // top of the faces
const NAME_DROP = 26;              // from the faces' lower edge to the name's middle
const VISITOR_FACE_H = 100;
const VISITOR_TOP = TEAM_TOP + TEAM_FACES_H + NAME_DROP + 36;
const BLOCK_H = VISITOR_TOP + VISITOR_FACE_H + 8;
// Where the block sits. The logo is part of the painting, so its place is
// given in design coordinates: the block hangs centred under the logo's
// middle, just below it -- but never over the children (left of
// BLOCK_LEFT_LIMIT) and never off the screen.
const BLOCK_CENTER_X = 915;
const BLOCK_TOP = 282;
const BLOCK_LEFT_LIMIT = 640;
const BLOCK_MARGIN = 22;
// The visitor's name, in the grey of his picture.
const VISITOR_INK = '#d8d8d8';

/** Texture key of a team's badge: its faces (scripts/make_characters.py). */
export function teamBadgeKey(teamId) {
  return `team-${teamId}`;
}

/**
 * Title screen with the painted friends as its background.
 *
 * Under the logo every team (data/teams.js) has its own big round picture
 * -- the two who fish together, side by side -- and a child taps his own
 * face.
 * A team is also a save profile: its catches are its own. The grey one is
 * the visitor: for trying out, nothing of it is kept.
 */
export class TitleScene extends Phaser.Scene {
  constructor() { super('TitleScene'); }

  /** @param {{ showButtons?: boolean }} data  set when coming back from the game */
  create(data) {
    this._startUi = null;
    this._entering = false;
    this._tapZone = null;

    // Background as a DOM <img> behind the (transparent) Phaser canvas.
    // The painting is 4:3; object-fit: cover makes it fill any screen, and
    // the browser scales the full-resolution PNG straight to device pixels
    // (sharper than routing it through the canvas).
    this._setupDomBackground();

    // Title-screen music at slightly lower volume than gameplay ambient.
    // Use game.sound (global) and stopByKey to defend against duplicate
    // plays from HMR / scene re-enter: nothing of this key is allowed to
    // be playing before we start a fresh one.
    this.sound.stopByKey(MUSIC.START);
    this.audio = new AudioManager(this);
    // AudioManager defers actual playback to the 'unlocked' event when
    // sound.locked is true (iOS Safari before first tap), so calling
    // this now is safe -- it will start the moment the user taps.
    this.audio.playMusic(MUSIC.START, { volume: 0.20 });

    // Hard guarantee: when this scene shuts down for ANY reason, kill
    // every sound instance for this key so the title theme never leaks
    // into the FishingScene.
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.sound.stopByKey(MUSIC.START);
    });

    // Camera + screen-anchored pieces (background box, the block of teams).
    bindLayout(this, { alignY: VIEW_ALIGN_Y }, (layout) => this._applyLayout(layout));

    // === Invisible tap-to-start overlay ===
    // Show ONLY the painted scene at first. The teams are deliberately
    // hidden until any tap lands on the page. That tap serves two purposes:
    //   1. It unlocks WebAudio on iOS Safari so the title theme starts.
    //   2. It reveals the teams, so a child doesn't waste their first tap
    //      on a visible button that wouldn't have triggered audio anyway
    //      (we want the audio to be heard, not skipped past).
    // We use a world-sized invisible Phaser zone (the visible screen is
    // always a slice of the world) so we don't need an extra DOM listener;
    // pointerdown on a Phaser Zone has the same gesture-credibility for
    // iOS' audio unlock as any other tap.
    //
    // Back from the map screen there is nothing left to unlock: the teams
    // are simply there.
    if (data && data.showButtons) {
      this._revealStartUI();
      return;
    }
    this._tapZone = this.add.zone(WORLD_LEFT, WORLD_TOP, WORLD_WIDTH, WORLD_HEIGHT)
      .setOrigin(0, 0)
      .setInteractive()
      .setDepth(100);
    this._tapZone.once('pointerdown', () => this._revealStartUI());
  }

  _revealStartUI() {
    if (this._tapZone) { this._tapZone.destroy(); this._tapZone = null; }
    if (this._startUi) return;

    // One container for the whole block so a resize / rotation only has to
    // move (and scale) a single object.
    const ui = this.add.container(0, 0);
    ui.setDepth(10);

    const players = TEAMS.filter((team) => !team.visitor);
    const widths = players.map((team) => this._badgeWidth(team, TEAM_FACES_H));
    this._blockWidth = widths.reduce((a, b) => a + b, 0) + TEAM_GAP * (players.length - 1);
    let x = -this._blockWidth / 2;
    players.forEach((team, i) => {
      this._buildTeam(ui, team, x + widths[i] / 2, widths[i]);
      x += widths[i] + TEAM_GAP;
    });
    for (const team of TEAMS.filter((t) => t.visitor)) this._buildVisitor(ui, team);

    this._startUi = ui;
    this._applyLayout(this.layout);
  }

  /**
   * Called on create and on every resize / rotation.
   */
  _applyLayout(layout) {
    if (!layout) return;

    // Background: exactly the game container's box (not 100vw/100vh --
    // on phones those can be larger than the visible area).
    if (this._domBgEl) {
      const c = layout.container;
      this._domBgEl.style.left   = `${c.left}px`;
      this._domBgEl.style.top    = `${c.top}px`;
      this._domBgEl.style.width  = `${c.width}px`;
      this._domBgEl.style.height = `${c.height}px`;
    }

    // The block: centred under the logo. Where the screen is too low or too
    // narrow for it at full size, it shrinks -- and moves up, or sideways
    // into view, as far as it then can.
    if (this._startUi) {
      const safe = layout.safe;
      const left = Math.max(BLOCK_LEFT_LIMIT, safe.left + BLOCK_MARGIN);
      const right = safe.right - BLOCK_MARGIN;
      const roomH = safe.bottom - BLOCK_MARGIN - BLOCK_TOP;
      const scale = Phaser.Math.Clamp(
        Math.min(roomH / BLOCK_H, (right - left) / this._blockWidth), 0.45, 1);
      const half = (this._blockWidth / 2) * scale;
      const top = Math.min(BLOCK_TOP, safe.bottom - BLOCK_MARGIN - BLOCK_H * scale);
      this._startUi.setScale(scale);
      this._startUi.setPosition(
        Phaser.Math.Clamp(BLOCK_CENTER_X, Math.min(left + half, right - half), right - half), top);
    }
  }

  /** How wide a team's picture is when it is `height` high. */
  _badgeWidth(team, height) {
    const key = teamBadgeKey(team.id);
    if (!this.textures.exists(key)) return height * 1.8;
    const picture = this.textures.get(key).getSourceImage();
    return height * picture.width / picture.height;
  }

  /** A team: its two faces, big, with the names under them. The whole of it is the button. */
  _buildTeam(ui, team, x, width) {
    const y = TEAM_TOP + TEAM_FACES_H / 2;
    // The glow is not part of the button: it breathes, the button only
    // dips when pressed.
    ui.add(addGlow(this, x, y, { w: width - 18, h: TEAM_FACES_H - 18, radius: TEAM_FACES_H / 2 }));

    const button = this.add.container(x, y);
    ui.add(button);
    if (this.textures.exists(teamBadgeKey(team.id))) {
      button.add(this.add.image(0, 0, teamBadgeKey(team.id)).setDisplaySize(width, TEAM_FACES_H));
    } else {
      // No picture: a plain board.
      button.add(this.add.rectangle(0, 0, width, TEAM_FACES_H, 0x8a4f1d).setStrokeStyle(4, 0x3a1d06));
    }
    // Their names, for whoever can read.
    button.add(this.add.text(0, TEAM_FACES_H / 2 + NAME_DROP, team.label, lettering(29)).setOrigin(0.5));

    // One tap target for faces and names together.
    button.setSize(width + 16, TEAM_FACES_H + (NAME_DROP + 20) * 2);
    pressable(this, button, () => this._enterGame(team.id));
  }

  /** The visitor: one grey face and "Gast" beside it, smaller than the teams, centred under them. */
  _buildVisitor(ui, team) {
    const faceW = this._badgeWidth(team, VISITOR_FACE_H);
    const label = this.add.text(0, 0, team.label, lettering(27, VISITOR_INK)).setOrigin(0, 0.5);
    const gap = 12;
    const width = faceW + gap + label.width;

    const button = this.add.container(0, VISITOR_TOP + VISITOR_FACE_H / 2);
    ui.add(button);
    if (this.textures.exists(teamBadgeKey(team.id))) {
      button.add(this.add.image(-width / 2 + faceW / 2, 0, teamBadgeKey(team.id))
        .setDisplaySize(faceW, VISITOR_FACE_H));
    }
    label.setX(-width / 2 + faceW + gap);
    button.add(label);

    button.setSize(width + 36, VISITOR_FACE_H + 12);
    pressable(this, button, () => this._enterGame(team.id));
  }

  _enterGame(profile) {
    if (this._entering) return;
    this._entering = true;
    SaveSystem.setProfile(profile);
    this._teardownDomBackground();
    // Stop the title theme so it doesn't overlap with FishingScene ambient.
    if (this.audio) this.audio.stopMusic();
    // Next stop: choose where to fish.
    this.scene.start('MapSelectScene');
  }

  _setupDomBackground() {
    // Use a real <img> tag with object-fit: cover. Mirrors the video
    // element approach in FishingScene which works on iPad Safari. CSS
    // background-image on a div proved unreliable across iPad Safari
    // versions; <img> is uniformly supported.
    const img = document.createElement('img');
    img.className = 'title-bg';
    img.src = '/clean/start-friends.jpg';
    img.alt = '';
    img.style.position = 'fixed';
    // Box = the game container; kept in sync by _applyLayout.
    img.style.top = '0';
    img.style.left = '0';
    img.style.width = '100%';
    img.style.height = '100%';
    img.style.objectFit = 'cover';
    // Same crop rule as the camera (see VIEW_ALIGN_Y).
    img.style.objectPosition = `50% ${VIEW_ALIGN_Y * 100}%`;
    // z-index 0 sits BELOW #game (z-index: 1, set in index.html) but
    // ABOVE html's background paint. Negative z-index proved unreliable
    // on iPad Safari -- the element could end up hidden behind the html
    // background paint regardless of fallback colour.
    img.style.zIndex = '0';
    img.style.pointerEvents = 'none';
    img.style.backgroundColor = '#1c2530';   // visible behind the img while it decodes
    document.body.appendChild(img);
    this._domBgEl = img;

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this._teardownDomBackground());
  }

  _teardownDomBackground() {
    if (this._domBgEl) {
      this._domBgEl.remove();
      this._domBgEl = null;
    }
  }
}
