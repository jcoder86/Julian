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

  setSelectedBait(baitId) { this.save(SELECTED_BAIT_KEY, baitId); },
  getSelectedBait()       { return this.load(SELECTED_BAIT_KEY); },

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
