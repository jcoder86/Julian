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
//             grab it on the way in, and is hooked at once: keep reeling.
//             A lure is too big a mouthful for a small fish (see
//             smallestCatchOn below).
//
// A lure's `swim` says how it moves when reeled in (systems/LureSwim.js):
//   depth   how deep it runs while cranked (m)
//   sink    how fast it sinks when the cranking stops (m/s)
//   sway    how far it wags from side to side (design px at full size)
//   roll    how far it rolls over as it does (degrees)
//   beat    how many wags a second at a normal crank
//   jig     a pilker is jerked up and down: by this much (m)
//   flash   metal: it flashes in the light as it rolls
//   floats  a dry fly: it stays on the surface
// and `lengthCm` how long it really is, hooks and all: it is drawn to the
// same scale as everything on the water (PX_PER_CM in constants.js).
//
// Texture keys: clean/bait_<id>_full.png (selection menu) and
// clean/bait_<id>_simple.png (HUD icon; for a lure also the sprite on the
// end of the line).

const FRESH = ["lake", "france"];
const SEA = ["sea"];
const GREECE = ["greece"];

export const BAITS = [
  // Fresh water
  // (Bread is also THE bait for mullet and white bream on the Greek coast.)
  { id: "brood",    maps: [...FRESH, ...GREECE], kind: "bait", displayName: "Brood", nlName: "Brood" },
  // The Greek coast, under the float: a little shrimp, a strip of squid.
  { id: "garnaal",  maps: GREECE, kind: "bait", displayName: "Garnaal",  nlName: "Garnaal" },
  { id: "inktvis",  maps: GREECE, kind: "bait", displayName: "Inktvis",  nlName: "Inktvis" },
  { id: "mais",     maps: FRESH, kind: "bait", displayName: "Mais",     nlName: "Mais" },
  { id: "maden",    maps: FRESH, kind: "bait", displayName: "Maden",    nlName: "Maden" },
  { id: "wormen",   maps: FRESH, kind: "bait", displayName: "Wormen",   nlName: "Wormen" },
  { id: "vis",      maps: FRESH, kind: "bait", displayName: "Vis",      nlName: "Vis" },
  // Fresh-water lures, for the hunters only: the spinner flashes for
  // anything that chases; the rubber shad is hopped along the bottom of the
  // moat for zander, pike and catfish; the fly is for the trout family (and
  // the chub) of the French lake.
  // A spinner runs fairly high, its blade whirring and flashing; a shad
  // wags its rubber tail down deep and drops to the bottom when left; a dry
  // fly floats and is skittered over the surface.
  { id: "spinner",  maps: FRESH, kind: "lure", displayName: "Spinner",  nlName: "Spinner", lengthCm: 8,
    swim: { depth: 0.7, sink: 0.25, sway: 2, roll: 9, beat: 8, flash: true } },
  { id: "shad",     maps: ["lake", ...GREECE], kind: "lure", displayName: "Shad", nlName: "Shad", lengthCm: 10,
    swim: { depth: 1.3, sink: 0.7, sway: 6, roll: 14, beat: 3 } },
  { id: "vlieg",    maps: ["france"], kind: "lure", displayName: "Kunstvlieg", nlName: "Kunstvlieg", lengthCm: 3,
    swim: { depth: 0, sink: 0, sway: 3, roll: 6, beat: 2, floats: true } },

  // Sea
  { id: "zeepier",  maps: SEA,   kind: "bait", displayName: "Zeepier",  nlName: "Zeepier" },
  { id: "aasvisje", maps: SEA,   kind: "bait", displayName: "Aasvisje", nlName: "Aasvisje" },
  // Feathers flutter at mid-water; a spoon wobbles wide and flashes; a
  // pilker is a heavy jig: deep, jerked up and down, quick to the bottom.
  { id: "veren",    maps: [...SEA, ...GREECE], kind: "lure", displayName: "Veertjes", nlName: "Veertjes", lengthCm: 6,
    swim: { depth: 0.9, sink: 0.35, sway: 3, roll: 8, beat: 4 } },
  { id: "blinker",  maps: SEA,   kind: "lure", displayName: "Blinker",  nlName: "Blinker", lengthCm: 7,
    swim: { depth: 0.9, sink: 0.4, sway: 7, roll: 24, beat: 3.5, flash: true } },
  { id: "pilker",   maps: SEA,   kind: "lure", displayName: "Pilker",   nlName: "Pilker", lengthCm: 12,
    swim: { depth: 1.6, sink: 0.9, sway: 2, roll: 10, beat: 1.4, jig: 0.6, flash: true } },

  // The Greek coast's own lures (also the shad and the feathers above): a
  // minnow plug that wobbles wide just under the surface and hangs where it
  // is when left; a casting jig, slim and heavy, jerked deep and fast.
  { id: "plug",     maps: GREECE, kind: "lure", displayName: "Plug",     nlName: "Plug", lengthCm: 11,
    swim: { depth: 0.5, sink: 0.08, sway: 6, roll: 22, beat: 4, flash: true } },
  { id: "werpjig",  maps: GREECE, kind: "lure", displayName: "Werpjig",  nlName: "Werpjig", lengthCm: 9,
    swim: { depth: 1.5, sink: 1.0, sway: 2, roll: 14, beat: 1.8, jig: 0.5, flash: true } },
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

// A lure is ten to fifteen centimetres of metal, rubber or feathers itself:
// a fish of that size cannot take it. So what is hooked on a lure is never
// the "small" one of its kind, and never shorter than this many cm.
const LURE_SMALLEST_CATCH = { size: "medium", cm: 20 };

/**
 * The smallest fish this bait can hook, as { size, cm } -- or null: anything
 * goes. (What that does to the odds: catchableSizes in data/fish.js.)
 */
export function smallestCatchOn(baitId) {
  return isLure(baitId) ? LURE_SMALLEST_CATCH : null;
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
