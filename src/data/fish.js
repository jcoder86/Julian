// Fish definitions: 12 species per map x 3 sizes (small/medium/large). Each
// entry encodes its texture key, display name, bait compatibility, and
// rarity weight. Catch logic in FishingScene uses weightedPick(bait, map),
// which takes the species that live on that map and accept the selected
// bait, then rolls weighted random over the allowed (species, size)
// combinations.
//
// Which species live where -- and in what order they are shown in a map's
// collection -- is MAP_SPECIES below. A species can live in more than one
// place (the catfish does); its catches are one and the same wherever it
// was caught.
//
// A species id is for ever: catches are saved under it. The NAME can change
// (the "Karper" became the "Schubkarper" when the mirror carp joined it),
// and so can the map it lives on.

export const FISH_SIZES = ["small", "medium", "large"];

/**
 * One entry per species. `baits` lists which bait IDs this species accepts.
 * `speciesWeight` is the relative rarity of this species (higher = more
 * common). `sizeWeights` is the relative distribution of small/medium/large
 * WITHIN this species when it gets picked. `lengthCm` is the random length
 * range in centimetres for each size bucket, sourced from a Dutch field
 * guide table -- small = "jong/klein", medium = "gemiddeld vangbaar",
 * large = "max NL". Each catch rolls a random integer cm in the bucket's
 * range. Adjust to taste, then run `node scripts/fish-odds.js` to see what
 * it does to the odds. An optional `maxReelTurns` raises the cap on how
 * many reel turns a catch of this species can take (default 9).
 */
export const FISH_SPECIES = [
  // ===========================================================================
  // The moat of Naarden-Vesting
  // ===========================================================================
  // Vredevissen (peaceful fish) -- common, NO fish-bait
  { id: "roach",  nlName: "Blankvoorn",  baits: ["brood", "mais", "maden", "wormen"],         speciesWeight: 100, sizeWeights: [70, 25,  5],
    lengthCm: { small: [ 8, 10], medium: [15, 25], large: [ 35,  45] } },
  { id: "rudd",   nlName: "Ruisvoorn",   baits: ["brood", "mais", "maden", "wormen"],         speciesWeight:  90, sizeWeights: [70, 25,  5],
    lengthCm: { small: [ 8, 12], medium: [15, 25], large: [ 40,  45] } },
  // The round goby: a newcomer from the Black Sea that sits on every stone
  // of Dutch canals and moats by now, and bites at anything small.
  { id: "goby",   nlName: "Zwartbekgrondel", baits: ["brood", "maden", "wormen"],             speciesWeight:  70, sizeWeights: [60, 30, 10],
    lengthCm: { small: [ 5,  8], medium: [10, 14], large: [ 17,  22] } },
  { id: "bream",  nlName: "Brasem",      baits: ["brood", "mais", "maden", "wormen"],         speciesWeight:  75, sizeWeights: [55, 35, 10],
    lengthCm: { small: [10, 15], medium: [30, 45], large: [ 70,  80] } },
  { id: "tench",  nlName: "Zeelt",       baits: ["brood", "mais", "maden", "wormen"],         speciesWeight:  45, sizeWeights: [50, 35, 15],
    lengthCm: { small: [10, 15], medium: [25, 40], large: [ 60,  70] } },
  // "carp" was simply the Karper until the mirror carp arrived; it is the
  // fully scaled one. Same fish, same catches, a more exact name.
  { id: "carp",   nlName: "Schubkarper", baits: ["brood", "mais", "maden", "wormen"],         speciesWeight:  35, sizeWeights: [40, 40, 20],
    lengthCm: { small: [15, 25], medium: [40, 70], large: [100, 120] } },
  { id: "mirrorcarp", nlName: "Spiegelkarper", baits: ["brood", "mais", "maden", "wormen"],   speciesWeight:  25, sizeWeights: [40, 40, 20],
    lengthCm: { small: [15, 25], medium: [40, 70], large: [ 85, 110] } },

  // Mixed predators -- worms or fish bait
  { id: "perch",  nlName: "Baars",       baits: ["maden", "wormen", "vis"],                   speciesWeight:  60, sizeWeights: [60, 30, 10],
    lengthCm: { small: [ 5, 10], medium: [15, 30], large: [ 50,  55] } },
  // The eel hunts along the bottom at dusk: a worm or a dead bait fish.
  { id: "eel",    nlName: "Paling",      baits: ["wormen", "vis"],                            speciesWeight:  22, sizeWeights: [50, 35, 15],
    lengthCm: { small: [20, 35], medium: [45, 70], large: [ 85, 110] } },

  // Pure predators -- ONLY fish bait
  { id: "pike",   nlName: "Snoek",       baits: ["vis"],                                      speciesWeight:  20, sizeWeights: [35, 40, 25],
    lengthCm: { small: [20, 30], medium: [50, 85], large: [120, 130] } },
  { id: "zander", nlName: "Snoekbaars",  baits: ["vis"],                                      speciesWeight:  15, sizeWeights: [35, 40, 25],
    lengthCm: { small: [15, 25], medium: [40, 65], large: [ 90, 100] } },

  // Wels catfish: the rarest fish of the fresh water, and by far the
  // biggest. A bottom-dwelling predator -- it takes a bunch of worms or a
  // bait fish, never bread, corn or maggots. A full-grown one is over two
  // metres, twice Julian's height -- so it may take up to 12 turns of the
  // reel (maxReelTurns; most species stop at the default cap of 9, see
  // reelTurnsFor in FishingScene.js). It lives in the moat AND in the French
  // lake, where it is rarer still (`weightOn`).
  { id: "catfish", nlName: "Meerval",    baits: ["wormen", "vis"],                            speciesWeight:   3, sizeWeights: [50, 35, 15],
    lengthCm: { small: [30, 50], medium: [80, 130], large: [170, 220] }, maxReelTurns: 12,
    weightOn: { france: 1.5 } },

  // ===========================================================================
  // The mountain lake in France
  // ===========================================================================
  // Clear, cold, running water: small fry among the stones, the trout
  // family above them, and two giants that come up from the sea.

  // Small fry -- every other cast with bread or maggots.
  { id: "minnow",  nlName: "Elrits",        baits: ["brood", "maden"],                        speciesWeight: 100, sizeWeights: [65, 28,  7],
    lengthCm: { small: [ 4,  6], medium: [ 7,  9], large: [ 10,  12] } },
  { id: "gudgeon", nlName: "Riviergrondel", baits: ["brood", "maden", "wormen"],              speciesWeight:  90, sizeWeights: [60, 30, 10],
    lengthCm: { small: [ 6,  9], medium: [10, 13], large: [ 15,  18] } },

  // Chub and bass lived in the first lake (the moat's predecessor) and
  // moved here with it. The bass was called Forelbaars there; Grootbekbaars
  // is the same fish.
  { id: "chub",   nlName: "Kopvoorn",    baits: ["brood", "mais", "maden", "wormen"],         speciesWeight:  40, sizeWeights: [60, 30, 10],
    lengthCm: { small: [10, 15], medium: [25, 40], large: [ 55,  60] } },
  { id: "bass",   nlName: "Grootbekbaars", baits: ["wormen", "vis"],                          speciesWeight:   8, sizeWeights: [55, 30, 15],
    lengthCm: { small: [ 8, 12], medium: [25, 40], large: [ 55,  60] } },
  // The barbel roots along the gravel for anything edible.
  { id: "barbel", nlName: "Barbeel",     baits: ["mais", "maden", "wormen"],                  speciesWeight:  30, sizeWeights: [45, 40, 15],
    lengthCm: { small: [15, 25], medium: [35, 55], large: [ 70,  90] } },

  // The trout family. "trout" is the brown trout, and was simply Forel in
  // the first lake; it still takes any bait.
  { id: "grayling", nlName: "Vlagzalm",  baits: ["maden", "wormen"],                          speciesWeight:  28, sizeWeights: [50, 35, 15],
    lengthCm: { small: [15, 22], medium: [28, 38], large: [ 45,  55] } },
  { id: "trout",  nlName: "Bruine forel", baits: ["brood", "mais", "maden", "wormen", "vis"], speciesWeight:   6, sizeWeights: [45, 35, 20],
    lengthCm: { small: [20, 25], medium: [25, 45], large: [ 50,  60] } },
  { id: "rainbowtrout", nlName: "Regenboogforel", baits: ["mais", "maden", "wormen", "vis"],  speciesWeight:  20, sizeWeights: [45, 35, 20],
    lengthCm: { small: [20, 28], medium: [30, 45], large: [ 55,  70] } },
  { id: "char",   nlName: "Beekridder",  baits: ["maden", "wormen", "vis"],                   speciesWeight:  12, sizeWeights: [45, 35, 20],
    lengthCm: { small: [15, 22], medium: [25, 38], large: [ 45,  60] } },

  // Up from the sea to spawn: the salmon, rare; and the sturgeon, the fish
  // of a lifetime. A sturgeon grubs in the bottom -- it wants worms, not a
  // bait fish -- and only a "large" one is over a metre and a half: about
  // 1 worm-bite in 1000 (`node scripts/fish-odds.js`).
  { id: "salmon", nlName: "Zalm",        baits: ["wormen", "vis"],                            speciesWeight:   6, sizeWeights: [40, 40, 20],
    lengthCm: { small: [40, 55], medium: [65, 90], large: [100, 130] }, maxReelTurns: 10 },
  { id: "sturgeon", nlName: "Steur",     baits: ["wormen"],                                   speciesWeight:   2, sizeWeights: [58, 30, 12],
    lengthCm: { small: [60, 90], medium: [110, 150], large: [190, 280] }, maxReelTurns: 13 },

  // ===========================================================================
  // The North Sea
  // ===========================================================================
  // Gear: zeepier and aasvisje are baits fished under a float; veren
  // (feather rig), blinker (spoon) and pilker (heavy jig) are lures you
  // reel in yourself. Roughly ordered from "every cast" to "once in a
  // blue moon".

  // Shoal fish -- the feather rig's bread and butter.
  { id: "herring",  nlName: "Haring",    baits: ["veren"],                                     speciesWeight: 100, sizeWeights: [60, 30, 10],
    lengthCm: { small: [12, 18], medium: [20, 28], large: [ 30,  38] } },
  { id: "whiting",  nlName: "Wijting",   baits: ["zeepier", "aasvisje", "veren"],              speciesWeight:  90, sizeWeights: [60, 30, 10],
    lengthCm: { small: [15, 22], medium: [25, 38], large: [ 45,  60] } },
  { id: "mackerel", nlName: "Makreel",   baits: ["aasvisje", "veren", "blinker", "pilker"],    speciesWeight:  85, sizeWeights: [55, 35, 10],
    lengthCm: { small: [18, 25], medium: [28, 38], large: [ 42,  55] } },

  // Flatfish -- lie on the bottom, only take a lugworm.
  { id: "flounder", nlName: "Bot",       baits: ["zeepier"],                                   speciesWeight:  80, sizeWeights: [55, 35, 10],
    lengthCm: { small: [12, 20], medium: [22, 32], large: [ 38,  50] } },
  { id: "plaice",   nlName: "Schol",     baits: ["zeepier"],                                   speciesWeight:  65, sizeWeights: [50, 35, 15],
    lengthCm: { small: [15, 25], medium: [28, 40], large: [ 50,  70] } },

  // Hunters near the surface and around the jetty.
  { id: "garfish",  nlName: "Geep",      baits: ["aasvisje", "veren", "blinker"],              speciesWeight:  55, sizeWeights: [50, 35, 15],
    lengthCm: { small: [30, 45], medium: [50, 70], large: [ 80,  95] } },
  { id: "seabass",  nlName: "Zeebaars",  baits: ["zeepier", "aasvisje", "blinker", "pilker"],  speciesWeight:  45, sizeWeights: [45, 40, 15],
    lengthCm: { small: [20, 35], medium: [40, 60], large: [ 75,  95] } },
  { id: "cod",      nlName: "Kabeljauw", baits: ["zeepier", "aasvisje", "veren", "pilker"],    speciesWeight:  40, sizeWeights: [45, 35, 20],
    lengthCm: { small: [25, 40], medium: [50, 80], large: [100, 130] } },

  // A big one that does live in the North Sea: a bottom dweller that wants
  // real bait.
  { id: "ray",      nlName: "Rog",       baits: ["zeepier", "aasvisje"],                       speciesWeight:  18, sizeWeights: [45, 35, 20],
    lengthCm: { small: [30, 45], medium: [55, 80], large: [ 95, 120] } },

  // Fish an angler does NOT normally bring home from the North Sea: rare as
  // a species, and their biggest sizes rarer still. Three rules of thumb,
  // which `node scripts/fish-odds.js` prints for every bait:
  //   * one of these at all: about 1 bite in 50-100 with the right gear;
  //   * ANY fish longer than 150 cm: about 1 in 170 at best;
  //   * a tuna or shark of over two metres: about 1 in 400 on the pilker,
  //     1 in 650 or rarer on anything else -- the catch you ring a friend
  //     about. (Both are "large" from 220 cm; no "medium" exceeds 200.)
  { id: "conger",   nlName: "Zeepaling", baits: ["zeepier", "aasvisje"],                       speciesWeight:   5, sizeWeights: [55, 35, 10],
    lengthCm: { small: [50, 80], medium: [100, 150], large: [180, 230] }, maxReelTurns: 12 },
  // The Atlantic bluefin tuna: an open-water giant that chases a bait fish
  // or a fast lure.
  { id: "tuna",     nlName: "Blauwvintonijn", baits: ["aasvisje", "blinker", "pilker"],        speciesWeight: 2.2, sizeWeights: [60, 27, 13],
    lengthCm: { small: [60, 90], medium: [120, 180], large: [220, 300] }, maxReelTurns: 12 },

  // The porbeagle ("haringhaai"), the big shark of the North Sea: the
  // rarest fish in the whole game (lowest weight of all), and the longest
  // fight. About 1 bite in 310 on a bait fish, 1 in 160 on the pilker --
  // and then mostly a small one.
  { id: "shark",    nlName: "Haringhaai", baits: ["aasvisje", "pilker"],                       speciesWeight: 1.1, sizeWeights: [58, 29, 13],
    lengthCm: { small: [80, 120], medium: [140, 200], large: [220, 350] }, maxReelTurns: 14 },
];

/**
 * Map of species id -> full record. For quick lookup.
 */
export const FISH_BY_ID = Object.fromEntries(FISH_SPECIES.map(s => [s.id, s]));

/**
 * Which species live on which map, in the order of that map's collection
 * page (twelve to a page).
 */
export const MAP_SPECIES = {
  lake: ["roach", "rudd", "goby", "perch", "bream", "tench",
         "carp", "mirrorcarp", "eel", "zander", "pike", "catfish"],
  france: ["gudgeon", "minnow", "chub", "barbel", "bass", "grayling",
           "trout", "rainbowtrout", "char", "salmon", "sturgeon", "catfish"],
  sea: ["herring", "whiting", "mackerel", "flounder", "plaice", "garfish",
        "seabass", "cod", "ray", "conger", "tuna", "shark"],
};

/** All species of one map, in display order. */
export function speciesForMap(mapId) {
  return (MAP_SPECIES[mapId] || []).map((id) => FISH_BY_ID[id]);
}

/** The maps a species lives on. */
export function mapsOfSpecies(speciesId) {
  return Object.keys(MAP_SPECIES).filter((mapId) => MAP_SPECIES[mapId].includes(speciesId));
}

/** How common a species is on a map (it may be rarer in one place than in another). */
export function speciesWeightOn(species, mapId) {
  return species.weightOn?.[mapId] ?? species.speciesWeight;
}

/** Convenience helper returning the Dutch display name for a species id. */
export function speciesNlName(speciesId) {
  return FISH_BY_ID[speciesId]?.nlName ?? speciesId;
}

/**
 * Texture key for a given (species, size). Matches the file names produced
 * by scripts/split_atlas.py: clean/fish_<species>_<size>.png.
 */
export function fishTextureKey(speciesId, size) {
  return `fish_${speciesId}_${size}`;
}

/**
 * Weighted random pick of a fish among the species that live on the given
 * map and accept the given bait id. Returns { species, size, lengthCm } --
 * species and size are strings; lengthCm is an integer drawn uniformly from
 * the species' range for the chosen size.
 *
 * @param {string} baitId a bait or lure id from data/baits.js
 * @param {string} mapId  a map id from data/maps.js
 * @param {() => number} rng injectable random; defaults to Math.random
 * @returns {{ species: string, size: string, lengthCm: number } | null}
 *   null when no species there accepts the bait (shouldn't happen with our matrix)
 */
export function weightedPick(baitId, mapId, rng = Math.random) {
  const eligible = speciesForMap(mapId).filter(s => s.baits.includes(baitId));
  if (eligible.length === 0) return null;

  // Stage 1: pick a species by its weight on this map.
  const totalSpeciesWeight = eligible.reduce((sum, s) => sum + speciesWeightOn(s, mapId), 0);
  let roll = rng() * totalSpeciesWeight;
  let chosenSpecies = eligible[eligible.length - 1];
  for (const s of eligible) {
    roll -= speciesWeightOn(s, mapId);
    if (roll <= 0) { chosenSpecies = s; break; }
  }

  // Stage 2: pick a size for that species.
  const totalSizeWeight = chosenSpecies.sizeWeights.reduce((a, b) => a + b, 0);
  let sizeRoll = rng() * totalSizeWeight;
  let chosenSize = FISH_SIZES[FISH_SIZES.length - 1];
  for (let i = 0; i < FISH_SIZES.length; i++) {
    sizeRoll -= chosenSpecies.sizeWeights[i];
    if (sizeRoll <= 0) { chosenSize = FISH_SIZES[i]; break; }
  }

  // Stage 3: pick a centimetre length within the chosen size bucket. Some
  // legacy species records may have no lengthCm table -- fall back to a
  // safe default rather than throwing.
  const range = (chosenSpecies.lengthCm && chosenSpecies.lengthCm[chosenSize])
    || { small: [10, 15], medium: [20, 35], large: [40, 60] }[chosenSize]
    || [20, 30];
  const [lo, hi] = range;
  const lengthCm = Math.round(lo + rng() * (hi - lo));

  return { species: chosenSpecies.id, size: chosenSize, lengthCm };
}

/**
 * Backward-compatibility helper for code that used the old `{ id, color, size,
 * rarity }` shape. Returns a fish-shaped object from a new { species, size }
 * pick. `size` here is the size PX used by the placeholder fish sprite --
 * kept for code paths not yet migrated.
 */
const LEGACY_SIZE_PX = { small: 30, medium: 50, large: 90 };
const LEGACY_SPECIES_COLOR = {
  roach: 0xfff05a, rudd: 0xff9a3c, perch: 0xe53935, bream: 0x9aa0a6,
  tench: 0x556b2f, carp:  0xc89b3c, pike:  0x4a6b3a, zander: 0x6b7280,
  chub:  0xbcccdc, bass:  0x607d8b, trout: 0xb87333,
  catfish: 0x5c4a32,
  herring: 0xb9c7d6, whiting: 0xc9c2a8, mackerel: 0x2f7f8f, flounder: 0x6b6a45,
  plaice: 0x8a6f3c, garfish: 0x4f9a8a, seabass: 0x8f9aa3, cod: 0x8a7d4f,
  ray: 0x9a8a6a, conger: 0x4a4f57, tuna: 0x2a4f7a, shark: 0x6f7f8c,
  goby: 0x7a6f5a, mirrorcarp: 0xa8843c, eel: 0x4f5a2f, gudgeon: 0x9a9a84,
  minnow: 0xb09a4a, barbel: 0xa88a4a, grayling: 0x9aa6b0, rainbowtrout: 0xc98a9a,
  char: 0xd0603a, salmon: 0xb8c4cc, sturgeon: 0x6a705f,
};
export function legacyShape({ species, size }) {
  return {
    id: `${species}_${size}`,
    species,
    size,
    sizePx: LEGACY_SIZE_PX[size] ?? 50,
    color: LEGACY_SPECIES_COLOR[species] ?? 0x888888,
  };
}

/**
 * Backward-compat: the old code imported `FISH` as a flat array used by the
 * collection scene. We synthesize one entry per species for now. The
 * collection scene will be rebuilt in a later phase to show species × size.
 */
export const FISH = FISH_SPECIES.map(s => ({
  id: s.id,
  color: LEGACY_SPECIES_COLOR[s.id] ?? 0x888888,
  size: 50,
  rarity: s.speciesWeight,
}));
