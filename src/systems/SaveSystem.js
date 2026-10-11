// Thin localStorage wrapper. Keys are namespaced under julians_game_ so we can
// coexist with other apps on the same origin.

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

// localStorage is available in any modern browser, but we still guard against
// hostile environments (private-mode quotas, embedded webviews) by catching.
function safeGet(key) {
  try {
    return window.localStorage.getItem(namespaced(key));
  } catch (e) {
    console.warn('[SaveSystem] read failed', e);
    return null;
  }
}

function safeSet(key, value) {
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
//
// scripts/test-save-compat.js loads saves written by the released game
// (Julian's and the guest profile's) and checks every one of these
// promises; `npm run build` runs it first, so a change that would lose
// player data cannot be built or deployed.

export const SaveSystem = {
  /**
   * Switch the active profile. All subsequent reads/writes use the new
   * namespace. 'julian' = Julian's main save; any other string = isolated
   * profile (typically 'guest').
   */
  setProfile(name) {
    _activeProfile = name || 'julian';
  },

  /** Returns the currently active profile name. */
  getProfile() {
    return _activeProfile;
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
