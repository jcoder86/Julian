// Bait and lure definitions -- "what is on the end of the line".
//
// Order in BAITS determines display order in the selection menu. Each map
// has its own set (`map`), and ids are unique across maps so a fish's
// `baits` list (data/fish.js) also pins it to one map.
//
// `kind` decides how you fish with it:
//   "bait" -- hangs under the float: cast, wait for the float to go under,
//             tap to strike, reel in.
//   "lure" -- no float: cast, then reel the lure back yourself; a fish may
//             grab it on the way in. Tap to strike, keep reeling.
//
// Texture keys: clean/bait_<id>_full.png (selection menu) and
// clean/bait_<id>_simple.png (HUD icon; for a lure also the sprite on the
// end of the line).

export const BAITS = [
  // Lake
  { id: "brood",    map: "lake", kind: "bait", displayName: "Brood",    nlName: "Brood" },
  { id: "mais",     map: "lake", kind: "bait", displayName: "Mais",     nlName: "Mais" },
  { id: "maden",    map: "lake", kind: "bait", displayName: "Maden",    nlName: "Maden" },
  { id: "wormen",   map: "lake", kind: "bait", displayName: "Wormen",   nlName: "Wormen" },
  { id: "vis",      map: "lake", kind: "bait", displayName: "Vis",      nlName: "Vis" },

  // Sea
  { id: "zeepier",  map: "sea",  kind: "bait", displayName: "Zeepier",  nlName: "Zeepier" },
  { id: "aasvisje", map: "sea",  kind: "bait", displayName: "Aasvisje", nlName: "Aasvisje" },
  { id: "veren",    map: "sea",  kind: "lure", displayName: "Veertjes", nlName: "Veertjes" },
  { id: "blinker",  map: "sea",  kind: "lure", displayName: "Blinker",  nlName: "Blinker" },
  { id: "pilker",   map: "sea",  kind: "lure", displayName: "Pilker",   nlName: "Pilker" },
];

export const BAITS_BY_ID = Object.fromEntries(BAITS.map(b => [b.id, b]));

/** The baits and lures available on one map, in menu order. */
export function baitsForMap(mapId) {
  return BAITS.filter(b => b.map === mapId);
}

/** True when this id is a lure (fished actively, without a float). */
export function isLure(baitId) {
  return BAITS_BY_ID[baitId]?.kind === "lure";
}

/** Texture key for selection-menu (full) bait sprite. */
export function baitFullTextureKey(baitId) {
  return `bait_${baitId}_full`;
}

/** Texture key for in-icon (simple) bait sprite. */
export function baitSimpleTextureKey(baitId) {
  return `bait_${baitId}_simple`;
}

// The lake's default. Each map names its own in data/maps.js (defaultBait).
export const DEFAULT_BAIT_ID = "wormen";
