// Fish definitions: 12 species per map (lake, sea) x 3 sizes
// (small/medium/large). Each entry encodes its texture key, display name,
// bait compatibility, and rarity weight. Catch logic in FishingScene uses
// weightedPick(bait) which filters to species that accept the selected
// bait then rolls weighted random over the allowed (species, size)
// combinations.
//
// Which map a species lives in is its `map` field (default "lake"). Bait
// and lure ids are unique per map (see data/baits.js), so picking by bait
// can never return a fish from the other map.

export const FISH_SIZES = ["small", "medium", "large"];

/**
 * One entry per species. `baits` lists which bait IDs this species accepts.
 * `speciesWeight` is the relative rarity of this species (higher = more
 * common). `sizeWeights` is the relative distribution of small/medium/large
 * WITHIN this species when it gets picked. `lengthCm` is the random length
 * range in centimetres for each size bucket, sourced from a Dutch field
 * guide table -- small = "jong/klein", medium = "gemiddeld vangbaar",
 * large = "max NL". Each catch rolls a random integer cm in the bucket's
 * range. Adjust to taste. An optional `maxReelTurns` raises the cap on
 * how many reel turns a catch of this species can take (default 9).
 */
export const FISH_SPECIES = [
  // Vredevissen (peaceful fish) -- common, NO fish-bait
  { id: "roach",  nlName: "Blankvoorn",  baits: ["brood", "mais", "maden", "wormen"],         speciesWeight: 100, sizeWeights: [70, 25,  5],
    lengthCm: { small: [ 8, 10], medium: [15, 25], large: [ 35,  45] } },
  { id: "rudd",   nlName: "Ruisvoorn",   baits: ["brood", "mais", "maden", "wormen"],         speciesWeight:  90, sizeWeights: [70, 25,  5],
    lengthCm: { small: [ 8, 12], medium: [15, 25], large: [ 40,  45] } },
  { id: "bream",  nlName: "Brasem",      baits: ["brood", "mais", "maden", "wormen"],         speciesWeight:  75, sizeWeights: [55, 35, 10],
    lengthCm: { small: [10, 15], medium: [30, 45], large: [ 70,  80] } },
  { id: "tench",  nlName: "Zeelt",       baits: ["brood", "mais", "maden", "wormen"],         speciesWeight:  45, sizeWeights: [50, 35, 15],
    lengthCm: { small: [10, 15], medium: [25, 40], large: [ 60,  70] } },
  { id: "carp",   nlName: "Karper",      baits: ["brood", "mais", "maden", "wormen"],         speciesWeight:  35, sizeWeights: [40, 40, 20],
    lengthCm: { small: [15, 25], medium: [40, 70], large: [100, 120] } },

  // Mixed predators -- worms or fish bait
  { id: "perch",  nlName: "Baars",       baits: ["maden", "wormen", "vis"],                   speciesWeight:  60, sizeWeights: [60, 30, 10],
    lengthCm: { small: [ 5, 10], medium: [15, 30], large: [ 50,  55] } },
  { id: "bass",   nlName: "Forelbaars",  baits: ["wormen", "vis"],                            speciesWeight:   8, sizeWeights: [55, 30, 15],
    lengthCm: { small: [ 8, 12], medium: [25, 40], large: [ 55,  60] } },

  // Pure predators -- ONLY fish bait
  { id: "pike",   nlName: "Snoek",       baits: ["vis"],                                      speciesWeight:  20, sizeWeights: [35, 40, 25],
    lengthCm: { small: [20, 30], medium: [50, 85], large: [120, 130] } },
  { id: "zander", nlName: "Snoekbaars",  baits: ["vis"],                                      speciesWeight:  15, sizeWeights: [35, 40, 25],
    lengthCm: { small: [15, 25], medium: [40, 65], large: [ 90, 100] } },

  // Chub: peaceful + insectivorous, won't take a fish bait in our model.
  { id: "chub",   nlName: "Kopvoorn",    baits: ["brood", "mais", "maden", "wormen"],         speciesWeight:  40, sizeWeights: [60, 30, 10],
    lengthCm: { small: [10, 15], medium: [25, 40], large: [ 55,  60] } },
  // Trout still takes any bait.
  { id: "trout",  nlName: "Forel",       baits: ["brood", "mais", "maden", "wormen", "vis"],  speciesWeight:   6, sizeWeights: [45, 35, 20],
    lengthCm: { small: [20, 25], medium: [25, 45], large: [ 50,  60] } },

  // Wels catfish: the rarest fish in the lake, and by far the biggest. A
  // bottom-dwelling predator -- it takes a bunch of worms or a bait fish,
  // never bread, corn or maggots. speciesWeight 3 is half of the trout's
  // (the next rarest): about 1 bite in 150 on worms, 1 in 37 on fish bait.
  // A full-grown one is over two metres, twice Julian's height -- so it
  // alone may take up to 12 turns of the reel (maxReelTurns; every other
  // species stops at the default cap of 9, see reelTurnsFor in
  // FishingScene.js).
  { id: "catfish", nlName: "Meerval",    baits: ["wormen", "vis"],                            speciesWeight:   3, sizeWeights: [50, 35, 15],
    lengthCm: { small: [30, 50], medium: [80, 130], large: [170, 220] }, maxReelTurns: 12 },

  // ===========================================================================
  // The sea
  // ===========================================================================
  // Gear: zeepier and aasvisje are baits fished under a float; veren
  // (feather rig), blinker (spoon) and pilker (heavy jig) are lures you
  // reel in yourself. Roughly ordered from "every cast" to "once in a
  // blue moon".

  // Shoal fish -- the feather rig's bread and butter.
  { id: "herring",  map: "sea", nlName: "Haring",    baits: ["veren"],                                     speciesWeight: 100, sizeWeights: [60, 30, 10],
    lengthCm: { small: [12, 18], medium: [20, 28], large: [ 30,  38] } },
  { id: "whiting",  map: "sea", nlName: "Wijting",   baits: ["zeepier", "aasvisje", "veren"],              speciesWeight:  90, sizeWeights: [60, 30, 10],
    lengthCm: { small: [15, 22], medium: [25, 38], large: [ 45,  60] } },
  { id: "mackerel", map: "sea", nlName: "Makreel",   baits: ["aasvisje", "veren", "blinker", "pilker"],    speciesWeight:  85, sizeWeights: [55, 35, 10],
    lengthCm: { small: [18, 25], medium: [28, 38], large: [ 42,  55] } },

  // Flatfish -- lie on the bottom, only take a lugworm.
  { id: "flounder", map: "sea", nlName: "Bot",       baits: ["zeepier"],                                   speciesWeight:  80, sizeWeights: [55, 35, 10],
    lengthCm: { small: [12, 20], medium: [22, 32], large: [ 38,  50] } },
  { id: "plaice",   map: "sea", nlName: "Schol",     baits: ["zeepier"],                                   speciesWeight:  65, sizeWeights: [50, 35, 15],
    lengthCm: { small: [15, 25], medium: [28, 40], large: [ 50,  70] } },

  // Hunters near the surface and around the jetty.
  { id: "garfish",  map: "sea", nlName: "Geep",      baits: ["aasvisje", "veren", "blinker"],              speciesWeight:  55, sizeWeights: [50, 35, 15],
    lengthCm: { small: [30, 45], medium: [50, 70], large: [ 80,  95] } },
  { id: "seabass",  map: "sea", nlName: "Zeebaars",  baits: ["zeepier", "aasvisje", "blinker", "pilker"],  speciesWeight:  45, sizeWeights: [45, 40, 15],
    lengthCm: { small: [20, 35], medium: [40, 60], large: [ 75,  95] } },
  { id: "cod",      map: "sea", nlName: "Kabeljauw", baits: ["zeepier", "aasvisje", "veren", "pilker"],    speciesWeight:  40, sizeWeights: [45, 35, 20],
    lengthCm: { small: [25, 40], medium: [50, 80], large: [100, 130] } },

  // Big and rare: bottom dwellers that want real bait...
  { id: "ray",      map: "sea", nlName: "Rog",       baits: ["zeepier", "aasvisje"],                       speciesWeight:  18, sizeWeights: [45, 35, 20],
    lengthCm: { small: [30, 45], medium: [55, 80], large: [ 95, 120] } },
  { id: "conger",   map: "sea", nlName: "Zeepaling", baits: ["zeepier", "aasvisje"],                       speciesWeight:  10, sizeWeights: [45, 35, 20],
    lengthCm: { small: [50, 80], medium: [100, 150], large: [180, 230] }, maxReelTurns: 12 },
  // ...and open-water giants that chase a bait fish or a fast lure.
  { id: "tuna",     map: "sea", nlName: "Tonijn",    baits: ["aasvisje", "blinker", "pilker"],             speciesWeight:   5, sizeWeights: [45, 35, 20],
    lengthCm: { small: [60, 90], medium: [120, 180], large: [220, 300] }, maxReelTurns: 12 },

  // The shark: the rarest fish in the whole game (lowest weight of all),
  // and the longest fight. About 1 bite in 175 on a bait fish, 1 in 90 on
  // the pilker.
  { id: "shark",    map: "sea", nlName: "Haai",      baits: ["aasvisje", "pilker"],                        speciesWeight:   2, sizeWeights: [50, 35, 15],
    lengthCm: { small: [80, 120], medium: [150, 210], large: [260, 350] }, maxReelTurns: 14 },
];

/** Which map a species lives in. */
export function speciesMapId(species) {
  return species.map ?? "lake";
}

/** All species of one map, in display order. */
export function speciesForMap(mapId) {
  return FISH_SPECIES.filter(s => speciesMapId(s) === mapId);
}

/** Convenience helper returning the Dutch display name for a species id. */
export function speciesNlName(speciesId) {
  return FISH_BY_ID[speciesId]?.nlName ?? speciesId;
}

/**
 * Map of species id -> full record. For quick lookup.
 */
export const FISH_BY_ID = Object.fromEntries(FISH_SPECIES.map(s => [s.id, s]));

/**
 * Texture key for a given (species, size). Matches the file names produced
 * by scripts/split_atlas.py: clean/fish_<species>_<size>.png.
 */
export function fishTextureKey(speciesId, size) {
  return `fish_${speciesId}_${size}`;
}

/**
 * Weighted random pick of a fish, restricted to species that accept the
 * given bait id. Returns { species, size, lengthCm } -- species and size
 * are strings; lengthCm is an integer drawn uniformly from the species'
 * range for the chosen size.
 *
 * @param {string} baitId a bait or lure id from data/baits.js
 * @param {() => number} rng injectable random; defaults to Math.random
 * @returns {{ species: string, size: string, lengthCm: number } | null}
 *   null when no species accepts the bait (shouldn't happen with our matrix)
 */
export function weightedPick(baitId, rng = Math.random) {
  const eligible = FISH_SPECIES.filter(s => s.baits.includes(baitId));
  if (eligible.length === 0) return null;

  // Stage 1: pick a species by speciesWeight.
  const totalSpeciesWeight = eligible.reduce((sum, s) => sum + s.speciesWeight, 0);
  let roll = rng() * totalSpeciesWeight;
  let chosenSpecies = eligible[eligible.length - 1];
  for (const s of eligible) {
    roll -= s.speciesWeight;
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
