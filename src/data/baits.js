// Bait and lure definitions -- "what is on the end of the line".
//
// Order in BAITS determines display order in the selection menu. `maps`
// says where a bait is fished: the fresh-water baits and the spinner serve
// the moat and the French lake alike, each of the two has one lure of its
// own, and the sea has its own set. (Which FISH take a bait is in
// data/fish.js, and which fish live where too.)
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

const FRESH = ["lake", "france"];
const SEA = ["sea"];

export const BAITS = [
  // Fresh water
  { id: "brood",    maps: FRESH, kind: "bait", displayName: "Brood",    nlName: "Brood" },
  { id: "mais",     maps: FRESH, kind: "bait", displayName: "Mais",     nlName: "Mais" },
  { id: "maden",    maps: FRESH, kind: "bait", displayName: "Maden",    nlName: "Maden" },
  { id: "wormen",   maps: FRESH, kind: "bait", displayName: "Wormen",   nlName: "Wormen" },
  { id: "vis",      maps: FRESH, kind: "bait", displayName: "Vis",      nlName: "Vis" },
  // Fresh-water lures, for the hunters only: the spinner flashes for
  // anything that chases; the rubber shad is hopped along the bottom of the
  // moat for zander, pike and catfish; the fly is for the trout family (and
  // the chub) of the French lake.
  { id: "spinner",  maps: FRESH, kind: "lure", displayName: "Spinner",  nlName: "Spinner" },
  { id: "shad",     maps: ["lake"],   kind: "lure", displayName: "Shad",       nlName: "Shad" },
  { id: "vlieg",    maps: ["france"], kind: "lure", displayName: "Kunstvlieg", nlName: "Kunstvlieg" },

  // Sea
  { id: "zeepier",  maps: SEA,   kind: "bait", displayName: "Zeepier",  nlName: "Zeepier" },
  { id: "aasvisje", maps: SEA,   kind: "bait", displayName: "Aasvisje", nlName: "Aasvisje" },
  { id: "veren",    maps: SEA,   kind: "lure", displayName: "Veertjes", nlName: "Veertjes" },
  { id: "blinker",  maps: SEA,   kind: "lure", displayName: "Blinker",  nlName: "Blinker" },
  { id: "pilker",   maps: SEA,   kind: "lure", displayName: "Pilker",   nlName: "Pilker" },
];

export const BAITS_BY_ID = Object.fromEntries(BAITS.map(b => [b.id, b]));

/** The baits and lures available on one map, in menu order. */
export function baitsForMap(mapId) {
  return BAITS.filter(b => b.maps.includes(mapId));
}

/** Can this bait be fished on this map? (False for an unknown id.) */
export function baitOnMap(baitId, mapId) {
  return !!BAITS_BY_ID[baitId]?.maps.includes(mapId);
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
