// Fish definitions: 11 species x 3 sizes (small/medium/large).
// Each entry encodes its texture key, display name, bait compatibility,
// and rarity weight. Catch logic in FishingScene uses weightedPick(bait)
// which filters to species that accept the selected bait then rolls
// weighted random over the allowed (species, size) combinations.

export const FISH_SIZES = ["small", "medium", "large"];

/**
 * One entry per species. `baits` lists which bait IDs this species accepts.
 * `speciesWeight` is the relative rarity of this species (higher = more
 * common). `sizeWeights` is the relative distribution of small/medium/large
 * WITHIN this species when it gets picked. `lengthCm` is the random length
 * range in centimetres for each size bucket, sourced from a Dutch field
 * guide table -- small = "jong/klein", medium = "gemiddeld vangbaar",
 * large = "max NL". Each catch rolls a random integer cm in the bucket's
 * range. Adjust to taste.
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
];

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
 * @param {string} baitId one of "brood","mais","maden","wormen","vis"
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
