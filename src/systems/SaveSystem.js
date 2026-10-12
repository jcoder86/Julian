// Thin localStorage wrapper. Keys are namespaced under julians_game_ so we can
// coexist with other apps on the same origin.

import { speciesForMap } from '../data/fish.js';
import { JAMES_CATCHES } from '../data/jamesCatches.js';
import { isVisitorProfile } from '../data/teams.js';

const KEY_PREFIX = 'julians_game_';

// Active profile. Defaults to 'julian' (his keys keep their original
// shape for backwards compat). 'guest' profile keys get a `guest_`
// infix so try-it-out players don't overwrite Julian's catches.
let _activeProfile = 'julian';
const FISH_COUNTS_KEY = 'fishCounts';
const SELECTED_BAIT_KEY = 'selectedBait';
const SELECTED_FLOAT_KEY = 'selectedFloat';
const LAST_CATCH_KEY = 'lastCatch';     // { species, size, lengthCm }
// Trophy table: per species, per size, the LARGEST cm ever landed.
//   { roach: { small: 9, medium: 22 }, pike: { large: 121 } }
// Persists across plays; the trophy collection renders it as a row of
// "best of" sprites with the cm engraved.
const BEST_CATCHES_KEY = 'bestCatches';
// Running total of catches per (species,size) for the trophy "x N caught"
// badge. Sums to fishCounts[species] across the size dimension.
const CATCH_COUNTS_BY_SIZE_KEY = 'catchCountsBySize';
// Which map (data/maps.js) the player was on last.
const CURRENT_MAP_KEY = 'currentMap';

function selectedBaitKey(mapId) {
  return mapId === 'lake' ? SELECTED_BAIT_KEY : `${SELECTED_BAIT_KEY}_${mapId}`;
}

function namespaced(key) {
  // julian profile -> original key shape (no infix), preserves any data
  // saved before profiles existed.
  // any other profile -> KEY_PREFIX + profile + '_' + key
  if (_activeProfile === 'julian') return KEY_PREFIX + key;
  return KEY_PREFIX + _activeProfile + '_' + key;
}

// The visitor (the grey "Gast" button, data/teams.js) is for trying the game
// out: nothing he catches is kept. His "storage" is this Map -- gone when
// the page closes, and emptied every time a visitor starts.
const _visitorStore = new Map();

// localStorage is available in any modern browser, but we still guard against
// hostile environments (private-mode quotas, embedded webviews) by catching.
function safeGet(key) {
  if (isVisitorProfile(_activeProfile)) {
    return _visitorStore.has(key) ? _visitorStore.get(key) : null;
  }
  try {
    return window.localStorage.getItem(namespaced(key));
  } catch (e) {
    console.warn('[SaveSystem] read failed', e);
    return null;
  }
}

function safeSet(key, value) {
  if (isVisitorProfile(_activeProfile)) {
    _visitorStore.set(key, value);
    return;
  }
  try {
    window.localStorage.setItem(namespaced(key), value);
  } catch (e) {
    console.warn('[SaveSystem] write failed', e);
  }
}

// ---------------------------------------------------------------------------
// Save-data compatibility -- read this before changing anything above.
// ---------------------------------------------------------------------------
// Players' catches live ONLY in their browser, under the keys above. A new
// version of the game is loaded on top of whatever an older version wrote,
// so:
//
//   * never rename or re-purpose an existing key, and never change the
//     shape of what is stored under it -- only ADD keys or fields;
//   * never rename a species, bait or float id (data/*.js): saved catches
//     are filed under those ids;
//   * this module never deletes anything. There is deliberately no
//     removeItem here, and no start-up "migration" that rewrites old data.
//     (One existed once: it wiped every catch except pike, on request, and
//     stayed armed on every device that had not run it yet. It is gone.)
//     The single exception is adoptJamesCatches() below -- read how it is
//     fenced in before ever writing a second one.
//
// scripts/test-save-compat.js loads saves written by the released game
// (Julian's and the guest profile's) and checks every one of these
// promises; `npm run build` runs it first, so a change that would lose
// player data cannot be built or deployed.

// ---------------------------------------------------------------------------
// James's collection for James & Boaz (requested 2026-10-11)
// ---------------------------------------------------------------------------
// James caught 176 fish on the 'guest' profile of one tablet. The team
// James & Boaz plays on that profile, but everywhere else it started with
// an empty collection -- plus, on the device the request came from, a
// stray sea fish from trying the team out. So, once per device, at start-up:
//
//   * if James & Boaz have NO fish of the first map there, they get James's
//     collection of 11 October 2026 (data/jamesCatches.js);
//   * and, at that same moment only, their sea catches are taken out, so
//     the team starts the sea with an empty book.
//
// Fenced in on every side, because taking catches away is exactly what
// went wrong before:
//   * only the 'guest' profile is read or written. Julian's is not opened;
//   * a device where James & Boaz already have lake fish (James's own) is
//     left exactly as it is, sea catches included;
//   * the sea is only emptied until SEA_CLEAR_UNTIL. A device that first
//     runs this later still gets James's fish, but keeps its sea catches:
//     by then they are somebody's real ones;
//   * what is taken out is not thrown away: it is kept in the note this
//     leaves behind (key jamesCatchesAdopted), from which it can be put back;
//   * if storage cannot be read cleanly, nothing happens at all (and it
//     tries again at the next start) -- an unreadable save must never be
//     mistaken for an empty one.
const JAMES_PROFILE = 'guest';
const JAMES_ADOPTED_KEY = 'jamesCatchesAdopted';
const SEA_CLEAR_UNTIL = Date.UTC(2026, 9, 15);   // through 14 October 2026

/** What is stored under `key`, or undefined. Throws if it cannot be read. */
function readStrict(key) {
  const raw = window.localStorage.getItem(namespaced(key));
  return raw == null ? undefined : JSON.parse(raw);
}

/** Runs with the James & Boaz profile active. */
function adoptJamesCatches(now) {
  if (readStrict(JAMES_ADOPTED_KEY) !== undefined) return;

  const tables = {
    [FISH_COUNTS_KEY]: readStrict(FISH_COUNTS_KEY) || {},
    [CATCH_COUNTS_BY_SIZE_KEY]: readStrict(CATCH_COUNTS_BY_SIZE_KEY) || {},
    [BEST_CATCHES_KEY]: readStrict(BEST_CATCHES_KEY) || {},
  };
  const lastCatch = readStrict(LAST_CATCH_KEY);
  const note = { at: new Date(now).toISOString(), loaded: false };

  const lake = speciesForMap('lake').map((species) => species.id);
  if (lake.some((id) => tables[FISH_COUNTS_KEY][id] > 0)) {
    // They have their own lake fish here: nothing to add, nothing to touch.
    SaveSystem.save(JAMES_ADOPTED_KEY, note);
    return;
  }

  let keepLastCatch = !!lastCatch;
  if (now < SEA_CLEAR_UNTIL) {
    const removed = {};
    for (const id of speciesForMap('sea').map((species) => species.id)) {
      for (const [key, table] of Object.entries(tables)) {
        if (!(id in table)) continue;
        removed[key] = removed[key] || {};
        removed[key][id] = table[id];
        delete table[id];
      }
      if (lastCatch && lastCatch.species === id) {
        removed[LAST_CATCH_KEY] = lastCatch;
        keepLastCatch = false;
      }
    }
    if (Object.keys(removed).length) note.removedSea = removed;
  }

  note.loaded = true;
  // The note first: it holds what was taken out.
  SaveSystem.save(JAMES_ADOPTED_KEY, note);
  SaveSystem.save(FISH_COUNTS_KEY, { ...tables[FISH_COUNTS_KEY], ...JAMES_CATCHES.fishCounts });
  SaveSystem.save(CATCH_COUNTS_BY_SIZE_KEY,
                  { ...tables[CATCH_COUNTS_BY_SIZE_KEY], ...JAMES_CATCHES.catchCountsBySize });
  SaveSystem.save(BEST_CATCHES_KEY, { ...tables[BEST_CATCHES_KEY], ...JAMES_CATCHES.bestCatches });
  if (!keepLastCatch) SaveSystem.save(LAST_CATCH_KEY, JAMES_CATCHES.lastCatch);
}

export const SaveSystem = {
  /**
   * Switch the active profile. All subsequent reads/writes use the new
   * namespace. 'julian' = Julian's main save; any other string = isolated
   * profile ('guest' is James & Boaz). The visitor's profile is not stored
   * at all.
   */
  setProfile(name) {
    _activeProfile = name || 'julian';
    // A visitor always starts with an empty book.
    if (isVisitorProfile(_activeProfile)) _visitorStore.clear();
  },

  /** Returns the currently active profile name. */
  getProfile() {
    return _activeProfile;
  },

  /**
   * Give James & Boaz James's collection, once per device -- see the long
   * comment above. Call at start-up, before a profile is chosen.
   */
  adoptJamesCatches(now = Date.now()) {
    const active = _activeProfile;
    _activeProfile = JAMES_PROFILE;
    try {
      adoptJamesCatches(now);
    } catch (e) {
      console.warn('[SaveSystem] the save could not be read: not adding James\u2019s catches now', e);
    } finally {
      _activeProfile = active;
    }
  },

  save(key, value) {
    safeSet(key, JSON.stringify(value));
  },

  load(key) {
    const raw = safeGet(key);
    if (raw == null) return null;
    try {
      return JSON.parse(raw);
    } catch (e) {
      console.warn('[SaveSystem] could not parse', key, e);
      return null;
    }
  },

  /**
   * Bumps the caught-count for a given fish id and returns the new count.
   * `fishId` is typically the species id ("roach", "carp", ...) -- the
   * collection scene tallies caught fish per species.
   */
  incrementFishCount(fishId) {
    const counts = this.getFishCounts();
    counts[fishId] = (counts[fishId] || 0) + 1;
    this.save(FISH_COUNTS_KEY, counts);
    return counts[fishId];
  },

  /**
   * Returns a map of { fishId: count }. Missing fish are simply absent
   * from the map; callers should treat absent as 0.
   */
  getFishCounts() {
    return this.load(FISH_COUNTS_KEY) || {};
  },

  // ---------- Bait + Float selection ----------------------------------------

  // The bait / lure choice is remembered per map: the lake keeps the
  // original key (so existing saves carry over), every other map gets its
  // own `selectedBait_<mapId>`.
  setSelectedBait(baitId, mapId = 'lake') { this.save(selectedBaitKey(mapId), baitId); },
  getSelectedBait(mapId = 'lake')         { return this.load(selectedBaitKey(mapId)); },

  // ---------- Current map ---------------------------------------------------

  /** Remember which map the player fished on last. */
  setCurrentMap(mapId) { this.save(CURRENT_MAP_KEY, mapId); },
  getCurrentMap()      { return this.load(CURRENT_MAP_KEY); },

  setSelectedFloat(floatId) { this.save(SELECTED_FLOAT_KEY, floatId); },
  getSelectedFloat()        { return this.load(SELECTED_FLOAT_KEY); },

  // ---------- Last catch ----------------------------------------------------

  /**
   * Record the most-recently caught fish. The HUD "icon-fish" button reads
   * this to render which species + size is shown in the icon, and the
   * catch-display scene reads the length to render "XX CM" below the fish.
   *
   * @param {{ species: string, size: string, lengthCm?: number }} fish
   */
  setLastCatch(fish) {
    this.save(LAST_CATCH_KEY, {
      species: fish.species,
      size: fish.size,
      lengthCm: fish.lengthCm,
    });
  },

  /** Returns { species, size, lengthCm? } or null if nothing has been caught yet. */
  getLastCatch() {
    return this.load(LAST_CATCH_KEY);
  },

  // ---------- Trophy table --------------------------------------------------

  /**
   * Atomically record a full catch: bumps fishCounts[species], increments
   * catchCountsBySize[species][size], updates bestCatches[species][size]
   * when the new length is bigger, and sets lastCatch. Single entry point
   * for FishingScene._performCatchLeap so save state can never drift.
   */
  recordCatch({ species, size, lengthCm }) {
    this.incrementFishCount(species);

    const sizeCounts = this.load(CATCH_COUNTS_BY_SIZE_KEY) || {};
    sizeCounts[species] = sizeCounts[species] || {};
    sizeCounts[species][size] = (sizeCounts[species][size] || 0) + 1;
    this.save(CATCH_COUNTS_BY_SIZE_KEY, sizeCounts);

    if (typeof lengthCm === 'number') {
      const best = this.load(BEST_CATCHES_KEY) || {};
      best[species] = best[species] || {};
      if (!best[species][size] || lengthCm > best[species][size]) {
        best[species][size] = lengthCm;
        this.save(BEST_CATCHES_KEY, best);
      }
    }

    this.setLastCatch({ species, size, lengthCm });
  },

  /**
   * Returns the trophy table: { species: { size: bestCm } }. Missing
   * entries simply mean the player hasn't landed that combination yet.
   */
  getBestCatches() {
    return this.load(BEST_CATCHES_KEY) || {};
  },

  /**
   * Returns per-species catch counts broken out by size:
   *   { species: { small: n, medium: n, large: n } }
   * Sums to fishCounts[species].
   */
  getCatchCountsBySize() {
    return this.load(CATCH_COUNTS_BY_SIZE_KEY) || {};
  },
};
