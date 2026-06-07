// Thin localStorage wrapper. Keys are namespaced under julians_game_ so we can
// coexist with other apps on the same origin.

const KEY_PREFIX = 'julians_game_';
const FISH_COUNTS_KEY = 'fishCounts';

function namespaced(key) {
  return KEY_PREFIX + key;
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
};
