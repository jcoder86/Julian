import Phaser from 'phaser';
import {
  GAME_HEIGHT,
  WORLD_WIDTH, WORLD_HEIGHT, WORLD_LEFT, WORLD_TOP,
} from '../constants.js';
import { bindLayout } from '../systems/Layout.js';
import { SaveSystem } from '../systems/SaveSystem.js';
import { AudioManager, MUSIC } from '../systems/AudioManager.js';
import { TEAMS } from '../data/teams.js';
import { UI, COLOR, lettering, addGlow, pressable } from '../systems/Ui.js';

// When a screen wider than 4:3 has to crop the painting top and bottom,
// keep the top: that is where the logo and Julian's face are. 0 = keep the
// very top, 0.5 = crop evenly. Used for BOTH the camera and the DOM
// background's object-position so the two always show the same slice.
const VIEW_ALIGN_Y = 0.1;

// Button block (design px): one START sign per team, stacked. The first
// sign's centre is the container origin.
const START_W = 400;
const START_H = 92;                // the sign's picture is 800 x 184
const START_MARGIN_RIGHT = 36;
const START_Y = Math.round(GAME_HEIGHT * 0.63);
const START_STEP = 156;            // from one sign's centre to the next
// The team's two faces sit on the plain left end of the sign and stick out
// a little beyond it.
const BADGE_HEIGHT = 108;
const BADGE_CENTER_X = -START_W / 2 + 60;
// Room the block needs between the first sign's centre and the bottom of
// the screen.
const START_MIN_BOTTOM_GAP = START_STEP * (TEAMS.length - 1) + 100;

/** Texture key of a team's badge: its two faces (scripts/make_characters.py). */
export function teamBadgeKey(teamId) {
  return `team-${teamId}`;
}

/**
 * Title screen with the painted friends as its background.
 *
 * One START button per team (data/teams.js), each showing the faces of
 * the two who fish together -- a child taps his own face. A team is also
 * a save profile: its catches are its own.
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

    // Camera + screen-anchored pieces (background box, button block).
    bindLayout(this, { alignY: VIEW_ALIGN_Y }, (layout) => this._applyLayout(layout));

    // === Invisible tap-to-start overlay ===
    // Show ONLY the painted scene at first. The START buttons are
    // deliberately hidden until any tap lands on the page. That tap
    // serves two purposes:
    //   1. It unlocks WebAudio on iOS Safari so the title theme starts.
    //   2. It reveals the buttons, so a child doesn't waste their first
    //      tap on a visible button that wouldn't have triggered audio
    //      anyway (we want the audio to be heard, not skipped past).
    // We use a world-sized invisible Phaser zone (the visible screen is
    // always a slice of the world) so we don't need an extra DOM listener;
    // pointerdown on a Phaser Zone has the same gesture-credibility for
    // iOS' audio unlock as any other tap.
    //
    // Back from the map screen there is nothing left to unlock: the buttons
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

    // One container for the whole button block so a resize / rotation
    // only has to move a single object.
    const ui = this.add.container(0, 0);
    ui.setDepth(10);
    TEAMS.forEach((team, i) => this._buildTeamButton(ui, team, i * START_STEP));
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

    // Buttons: pinned to the right edge of the screen (inside the safe
    // area). Vertically they keep their spot in the design frame, unless
    // the screen is too short for that -- then they move up to stay fully
    // visible.
    if (this._startUi) {
      const safe = layout.safe;
      this._startUi.setPosition(
        safe.right - START_MARGIN_RIGHT - START_W / 2,
        Math.min(START_Y, safe.bottom - START_MIN_BOTTOM_GAP),
      );
    }
  }

  _buildTeamButton(ui, team, y) {
    // The glow is not part of the button: it breathes, the button only
    // dips when pressed.
    ui.add(addGlow(this, 0, y, { w: START_W - 10, h: START_H - 10, radius: 34 }));

    const button = this.add.container(0, y);
    ui.add(button);

    if (this.textures.exists(UI.START)) {
      const sign = this.add.image(0, 0, UI.START);
      sign.setScale(START_W / sign.width);
      button.add(sign);
    } else {
      // No picture: a plain board with the word on it.
      button.add(this.add.rectangle(0, 0, START_W, START_H, 0x8a4f1d).setStrokeStyle(4, 0x3a1d06));
      button.add(this.add.text(START_W * 0.2, 0, 'START', lettering(46, COLOR.GOLD)).setOrigin(0.5));
    }

    // The two who fish together: a child taps his own face.
    if (this.textures.exists(teamBadgeKey(team.id))) {
      const badge = this.add.image(BADGE_CENTER_X, 0, teamBadgeKey(team.id));
      badge.setScale(BADGE_HEIGHT / badge.height);
      button.add(badge);
    }

    // Their names, for whoever can read.
    button.add(this.add.text(0, START_H / 2 + 22, team.label, lettering(25)).setOrigin(0.5));

    // One tap target for the whole of it, faces and names included.
    button.setSize(START_W + 100, START_H + 56);
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
