// Fish definitions: 12 species per map x 3 sizes (small/medium/large). Each
// entry encodes its texture key, display name, bait compatibility, and
// rarity weight. Catch logic in FishingScene uses weightedPick(bait, map),
// which takes the species that live on that map and accept the selected
// bait, then rolls weighted random over the allowed (species, size)
// combinations. A lure does not hook small fish: see catchableSizes.
//
// Which species live where -- and in what order they are shown in a map's
// collection -- is MAP_SPECIES below. A species can live in more than one
// place (the catfish does); its catches are counted per place (catchKey).
//
// A species id is for ever: catches are saved under it. The NAME can change
// (the "Karper" became the "Schubkarper" when the mirror carp joined it),
// and so can the map it lives on.

export const FISH_SIZES = ["small", "medium", "large"];

// How strongly the lengths of "large" fish crowd toward the low end of
// their range: a large fish's place in the range is (a random number 0..1)
// to this power. With 4, half of all large fish are in the lowest sixteenth
// of the range, 1 in 6 gets past the middle, and about 1 in 38 comes within
// a tenth of the range of the record.
export const RECORD_SKEW = 4;

/**
 * One entry per species. `baits` lists which bait IDs this species accepts.
 * `speciesWeight` is the relative rarity of this species (higher = more
 * common). `sizeWeights` is the relative distribution of small/medium/large
 * WITHIN this species when it gets picked. `lengthCm` is the length range
 * in centimetres for each size bucket -- small = "jong/klein", medium =
 * "gemiddeld vangbaar", large = from a big one up to the species' RECORD:
 * the last number of `large` is the longest that species is known to grow
 * (FishBase and angling records, rounded; kept sensible for the place --
 * no pike in the moat is longer than its catfish).
 *
 * How long a catch is: a small or medium one anywhere in its range, but a
 * large one crowds toward the low end of its range -- the closer to the
 * record, the rarer (RECORD_SKEW). So "how rare is this catch" is not a
 * matter of centimetres but of how close it comes to the biggest its kind
 * can be: a 58 cm perch is a rarer catch than a 140 cm catfish.
 * `node scripts/fish-odds.js` prints what that comes to.
 *
 * An optional `maxReelTurns` raises the cap on how many reel turns a catch
 * of this species can take (default 9).
 */
export const FISH_SPECIES = [
  // ===========================================================================
  // The moat of Naarden-Vesting
  // ===========================================================================
  // Vredevissen (peaceful fish) -- common, NO fish-bait
  { id: "roach",  nlName: "Blankvoorn",  baits: ["brood", "mais", "maden", "wormen"],         speciesWeight: 100, sizeWeights: [70, 25,  5],
    lengthCm: { small: [ 8, 10], medium: [15, 25], large: [ 35,  50] } },
  { id: "rudd",   nlName: "Ruisvoorn",   baits: ["brood", "mais", "maden", "wormen"],         speciesWeight:  90, sizeWeights: [70, 25,  5],
    lengthCm: { small: [ 8, 12], medium: [15, 25], large: [ 38,  50] } },
  // The round goby: a newcomer from the Black Sea that sits on every stone
  // of Dutch canals and moats by now, and bites at anything small.
  { id: "goby",   nlName: "Zwartbekgrondel", baits: ["brood", "maden", "wormen"],             speciesWeight:  70, sizeWeights: [60, 30, 10],
    lengthCm: { small: [ 5,  8], medium: [10, 14], large: [ 17,  25] } },
  { id: "bream",  nlName: "Brasem",      baits: ["brood", "mais", "maden", "wormen"],         speciesWeight:  75, sizeWeights: [55, 35, 10],
    lengthCm: { small: [10, 15], medium: [30, 45], large: [ 65,  82] } },
  { id: "tench",  nlName: "Zeelt",       baits: ["brood", "mais", "maden", "wormen"],         speciesWeight:  45, sizeWeights: [50, 35, 15],
    lengthCm: { small: [10, 15], medium: [25, 40], large: [ 55,  70] } },
  // "carp" was simply the Karper until the mirror carp arrived; it is the
  // fully scaled one. Same fish, same catches, a more exact name.
  { id: "carp",   nlName: "Schubkarper", baits: ["brood", "mais", "maden", "wormen"],         speciesWeight:  35, sizeWeights: [40, 40, 20],
    lengthCm: { small: [15, 25], medium: [40, 70], large: [ 90, 120] } },
  { id: "mirrorcarp", nlName: "Spiegelkarper", baits: ["brood", "mais", "maden", "wormen"],   speciesWeight:  25, sizeWeights: [40, 40, 20],
    lengthCm: { small: [15, 25], medium: [40, 70], large: [ 85, 120] } },

  // Mixed predators -- worms or fish bait
  { id: "perch",  nlName: "Baars",       baits: ["maden", "wormen", "vis", "spinner", "shad"],                   speciesWeight:  60, sizeWeights: [60, 30, 10],
    lengthCm: { small: [ 5, 10], medium: [15, 30], large: [ 42,  60] } },
  // The eel hunts along the bottom at dusk: a worm or a dead bait fish.
  { id: "eel",    nlName: "Paling",      baits: ["wormen", "vis"],                            speciesWeight:  22, sizeWeights: [50, 35, 15],
    lengthCm: { small: [20, 35], medium: [45, 70], large: [ 85, 133] } },

  // Pure predators -- ONLY fish bait
  { id: "pike",   nlName: "Snoek",       baits: ["vis", "spinner", "shad"],                                      speciesWeight:  20, sizeWeights: [35, 40, 25],
    lengthCm: { small: [20, 30], medium: [50, 85], large: [100, 140] } },
  { id: "zander", nlName: "Snoekbaars",  baits: ["vis", "spinner", "shad"],                                      speciesWeight:  15, sizeWeights: [35, 40, 25],
    lengthCm: { small: [15, 25], medium: [40, 65], large: [ 75, 105] } },

  // Wels catfish: the rarest fish of the fresh water, and by far the
  // biggest. A bottom-dwelling predator -- it takes a bunch of worms or a
  // bait fish, never bread, corn or maggots. A full-grown one is over two
  // metres, twice Julian's height -- so it may take up to 12 turns of the
  // reel (maxReelTurns; most species stop at the default cap of 9, see
  // reelTurnsFor in FishingScene.js). It lives in the moat AND in the French
  // lake, where it is rarer still (`weightOn`).
  { id: "catfish", nlName: "Meerval",    baits: ["wormen", "vis", "shad"],                            speciesWeight:   3, sizeWeights: [50, 35, 15],
    lengthCm: { small: [30, 50], medium: [80, 130], large: [170, 270] }, maxReelTurns: 12,
    weightOn: { france: 1.5 } },

  // ===========================================================================
  // The mountain lake in France
  // ===========================================================================
  // Clear, cold, running water: small fry among the stones, the trout
  // family above them, and two giants that come up from the sea.

  // Small fry -- every other cast with bread or maggots.
  { id: "minnow",  nlName: "Elrits",        baits: ["brood", "maden"],                        speciesWeight: 100, sizeWeights: [65, 28,  7],
    lengthCm: { small: [ 4,  6], medium: [ 7,  9], large: [ 10,  14] } },
  { id: "gudgeon", nlName: "Riviergrondel", baits: ["brood", "maden", "wormen"],              speciesWeight:  90, sizeWeights: [60, 30, 10],
    lengthCm: { small: [ 6,  9], medium: [10, 13], large: [ 15,  21] } },

  // Chub and bass lived in the first lake (the moat's predecessor) and
  // moved here with it. The bass was called Forelbaars there; Grootbekbaars
  // is the same fish.
  { id: "chub",   nlName: "Kopvoorn",    baits: ["brood", "mais", "maden", "wormen", "spinner", "vlieg"],         speciesWeight:  40, sizeWeights: [60, 30, 10],
    lengthCm: { small: [10, 15], medium: [25, 40], large: [ 50,  70] } },
  { id: "bass",   nlName: "Grootbekbaars", baits: ["wormen", "vis", "spinner"],                          speciesWeight:   8, sizeWeights: [55, 30, 15],
    lengthCm: { small: [ 8, 12], medium: [25, 40], large: [ 50,  80] } },
  // The barbel roots along the gravel for anything edible.
  { id: "barbel", nlName: "Barbeel",     baits: ["mais", "maden", "wormen"],                  speciesWeight:  30, sizeWeights: [45, 40, 15],
    lengthCm: { small: [15, 25], medium: [35, 55], large: [ 70, 110] } },

  // The trout family. "trout" is the brown trout, and was simply Forel in
  // the first lake; it still takes any bait.
  { id: "grayling", nlName: "Vlagzalm",  baits: ["maden", "wormen", "vlieg"],                          speciesWeight:  28, sizeWeights: [50, 35, 15],
    lengthCm: { small: [15, 22], medium: [28, 38], large: [ 45,  60] } },
  { id: "trout",  nlName: "Bruine forel", baits: ["brood", "mais", "maden", "wormen", "vis", "spinner", "vlieg"], speciesWeight:   6, sizeWeights: [45, 35, 20],
    lengthCm: { small: [20, 25], medium: [25, 45], large: [ 50, 100] } },
  { id: "rainbowtrout", nlName: "Regenboogforel", baits: ["mais", "maden", "wormen", "vis", "spinner", "vlieg"],  speciesWeight:  20, sizeWeights: [45, 35, 20],
    lengthCm: { small: [20, 28], medium: [30, 45], large: [ 55, 110] } },
  { id: "char",   nlName: "Beekridder",  baits: ["maden", "wormen", "vis", "spinner", "vlieg"],                   speciesWeight:  12, sizeWeights: [45, 35, 20],
    lengthCm: { small: [15, 22], medium: [25, 38], large: [ 45, 100] } },

  // Up from the sea to spawn: the salmon, rare; and the sturgeon, the fish
  // of a lifetime. A sturgeon grubs in the bottom -- it wants worms, not a
  // bait fish and no lure.
  { id: "salmon", nlName: "Zalm",        baits: ["wormen", "vis", "spinner", "vlieg"],                            speciesWeight:   6, sizeWeights: [40, 40, 20],
    lengthCm: { small: [40, 55], medium: [65, 90], large: [100, 150] }, maxReelTurns: 10 },
  { id: "sturgeon", nlName: "Steur",     baits: ["wormen"],                                   speciesWeight:   2, sizeWeights: [58, 30, 12],
    lengthCm: { small: [60, 90], medium: [110, 150], large: [190, 350] }, maxReelTurns: 13 },

  // ===========================================================================
  // The North Sea
  // ===========================================================================
  // Gear: zeepier and aasvisje are baits fished under a float; veren
  // (feather rig), blinker (spoon) and pilker (heavy jig) are lures you
  // reel in yourself. Roughly ordered from "every cast" to "once in a
  // blue moon".

  // Shoal fish -- the feather rig's bread and butter.
  { id: "herring",  nlName: "Haring",    baits: ["veren"],                                     speciesWeight: 100, sizeWeights: [60, 30, 10],
    lengthCm: { small: [12, 18], medium: [20, 28], large: [ 30,  45] } },
  { id: "whiting",  nlName: "Wijting",   baits: ["zeepier", "aasvisje", "veren"],              speciesWeight:  90, sizeWeights: [60, 30, 10],
    lengthCm: { small: [15, 22], medium: [25, 38], large: [ 45,  70] } },
  { id: "mackerel", nlName: "Makreel",   baits: ["aasvisje", "veren", "blinker", "pilker"],    speciesWeight:  85, sizeWeights: [55, 35, 10],
    lengthCm: { small: [18, 25], medium: [28, 38], large: [ 42,  60] } },

  // Flatfish -- lie on the bottom, only take a lugworm.
  { id: "flounder", nlName: "Bot",       baits: ["zeepier"],                                   speciesWeight:  80, sizeWeights: [55, 35, 10],
    lengthCm: { small: [12, 20], medium: [22, 32], large: [ 38,  60] } },
  { id: "plaice",   nlName: "Schol",     baits: ["zeepier"],                                   speciesWeight:  65, sizeWeights: [50, 35, 15],
    lengthCm: { small: [15, 25], medium: [28, 40], large: [ 50,  95] } },

  // Hunters near the surface and around the jetty.
  // (Both also live on the Greek coast, where they take a shrimp and a plug
  // -- the sea bass also a squid strip and a shad -- and are a little rarer.)
  { id: "garfish",  nlName: "Geep",      baits: ["aasvisje", "veren", "blinker", "garnaal", "plug"], speciesWeight:  55, sizeWeights: [50, 35, 15],
    lengthCm: { small: [30, 45], medium: [50, 70], large: [ 80, 100] }, weightOn: { greece: 50 } },
  { id: "seabass",  nlName: "Zeebaars",  baits: ["zeepier", "aasvisje", "blinker", "pilker", "garnaal", "inktvis", "plug", "shad"], speciesWeight:  45, sizeWeights: [45, 40, 15],
    lengthCm: { small: [20, 35], medium: [40, 60], large: [ 75, 100] }, weightOn: { greece: 30 } },
  { id: "cod",      nlName: "Kabeljauw", baits: ["zeepier", "aasvisje", "veren", "pilker"],    speciesWeight:  40, sizeWeights: [45, 35, 20],
    lengthCm: { small: [25, 40], medium: [50, 80], large: [100, 180] } },

  // A big one that does live in the North Sea: a bottom dweller that wants
  // real bait.
  { id: "ray",      nlName: "Rog",       baits: ["zeepier", "aasvisje"],                       speciesWeight:  18, sizeWeights: [45, 35, 20],
    lengthCm: { small: [30, 45], medium: [55, 80], large: [ 95, 130] } },

  // Fish an angler does NOT normally bring home from the North Sea: rare as
  // a species (one of these at all: about 1 bite in 50-100 with the right
  // gear), and a large one -- over two metres -- rarer still: the catch
  // you ring a friend about. `node scripts/fish-odds.js` has the numbers.
  { id: "conger",   nlName: "Zeepaling", baits: ["zeepier", "aasvisje"],                       speciesWeight:   5, sizeWeights: [55, 35, 10],
    lengthCm: { small: [50, 80], medium: [100, 150], large: [180, 300] }, maxReelTurns: 12 },
  // The Atlantic bluefin tuna: an open-water giant that chases a bait fish
  // or a fast lure.
  { id: "tuna",     nlName: "Blauwvintonijn", baits: ["aasvisje", "blinker", "pilker"],        speciesWeight: 2.2, sizeWeights: [60, 27, 13],
    lengthCm: { small: [60, 90], medium: [120, 180], large: [220, 330] }, maxReelTurns: 12 },

  // The porbeagle ("haringhaai"), the big shark of the North Sea: the
  // rarest fish in the whole game (lowest weight of all), and the longest
  // fight. About 1 bite in 310 on a bait fish, 1 in 160 on the pilker --
  // and then mostly a small one.
  { id: "shark",    nlName: "Haringhaai", baits: ["aasvisje", "pilker"],                       speciesWeight: 1.1, sizeWeights: [58, 29, 13],
    lengthCm: { small: [80, 120], medium: [140, 200], large: [220, 365] }, maxReelTurns: 14 },

  // ===========================================================================
  // The rocky coast in Greece
  // ===========================================================================
  // Clear, warm water off pale limestone. Under the float: bread (the
  // mullet), a shrimp or a strip of squid; or a lure: feathers, a minnow
  // plug, a casting jig, a shad. The sea bass and the garfish are the North
  // Sea's (above).

  // Along the rocks -- bread, a shrimp, a strip of squid.
  { id: "whitebream", nlName: "Witte zeebrasem", baits: ["brood", "garnaal", "inktvis"],      speciesWeight: 100, sizeWeights: [60, 30, 10],
    lengthCm: { small: [10, 15], medium: [18, 28], large: [ 32,  45] } },
  // Mullet: only ever on bread, and there are always some around.
  { id: "mullet",   nlName: "Harder",    baits: ["brood"],                                     speciesWeight:  95, sizeWeights: [50, 38, 12],
    lengthCm: { small: [15, 22], medium: [28, 45], large: [ 52,  75] } },
  { id: "gilthead", nlName: "Goudbrasem", baits: ["garnaal", "inktvis"],                      speciesWeight:  55, sizeWeights: [50, 35, 15],
    lengthCm: { small: [15, 22], medium: [26, 40], large: [ 45,  70] } },
  // It grubs over the sand with its whiskers: a shrimp on the bottom.
  { id: "redmullet", nlName: "Gestreepte zeebarbeel", baits: ["garnaal"],                     speciesWeight:  70, sizeWeights: [55, 35, 10],
    lengthCm: { small: [10, 14], medium: [16, 24], large: [ 27,  40] } },
  // Shoals in mid-water: a shrimp, a bit of squid, a string of feathers or
  // a small jig.
  { id: "horsemackerel", nlName: "Mediterrane horsmakreel", baits: ["garnaal", "inktvis", "veren", "werpjig"], speciesWeight: 85, sizeWeights: [55, 35, 10],
    lengthCm: { small: [12, 18], medium: [20, 30], large: [ 35,  60] } },

  // Hunters, out in the blue -- lures.
  { id: "barracuda", nlName: "Geelstaartbarracuda", baits: ["plug", "shad", "werpjig"],       speciesWeight:  25, sizeWeights: [45, 40, 15],
    lengthCm: { small: [30, 45], medium: [55, 80], large: [ 90, 128] }, maxReelTurns: 10 },
  // A small tuna that races through: a fast jig or plug.
  { id: "bonito",   nlName: "Bonito",    baits: ["werpjig", "plug"],                           speciesWeight:  12, sizeWeights: [40, 45, 15],
    lengthCm: { small: [30, 40], medium: [45, 62], large: [ 68,  91] }, maxReelTurns: 10 },
  // The big sea bream of the rocks: a big shad, or squid on the bottom.
  { id: "dentex",   nlName: "Tandbrasem", baits: ["inktvis", "shad"],                          speciesWeight:   8, sizeWeights: [45, 40, 15],
    lengthCm: { small: [20, 30], medium: [35, 60], large: [ 65, 100] }, maxReelTurns: 11 },

  // The two to tell your friends about: the amberjack, a powerful hunter of
  // almost two metres that hits a heavy jig (or a squid); and the moray,
  // which lives in the holes of the rocks and comes out for a strip of
  // squid.
  { id: "amberjack", nlName: "Amberjack", baits: ["werpjig", "inktvis"],                      speciesWeight:   3, sizeWeights: [50, 35, 15],
    lengthCm: { small: [40, 60], medium: [70, 110], large: [125, 190] }, maxReelTurns: 13 },
  { id: "moray",    nlName: "Murene",    baits: ["inktvis"],                                   speciesWeight:   5, sizeWeights: [45, 40, 15],
    lengthCm: { small: [40, 60], medium: [70, 100], large: [110, 150] }, maxReelTurns: 12 },

  // ===========================================================================
  // The ice of the South Pole
  // ===========================================================================
  // Fishing from the edge of the ice, into water just below freezing. The
  // fish here live nowhere else: most of them belong to the "ice fish"
  // family, with antifreeze in their blood. (Some really live deep down; in
  // the game they come up.) Under the float: krill -- what nearly everything
  // here eats --, a worm, a strip of squid or a bait fish; lures: the pilker
  // and a glow jig. Their cards say just their own name: Tandvis, not
  // Antarctische tandvis.

  // The little ones that swarm under the ice, on krill.
  { id: "silverfish", nlName: "Zilvervis", baits: ["krill"],                                  speciesWeight: 100, sizeWeights: [55, 35, 10],
    lengthCm: { small: [ 8, 12], medium: [13, 18], large: [ 19,  25] } },
  // A glowing little deep-sea fish that comes up at night: krill only.
  { id: "lanternfish", nlName: "Lantaarnvis", baits: ["krill"],                               speciesWeight:  16, sizeWeights: [50, 38, 12],
    lengthCm: { small: [ 4,  6], medium: [ 7,  9], large: [ 10,  12] } },
  // A schooling icefish, silvery and slim: krill, or a glow jig.
  { id: "mackerelicefish", nlName: "Makreelijsvis", baits: ["krill", "lichtjig"],             speciesWeight:  60, sizeWeights: [50, 38, 12],
    lengthCm: { small: [15, 22], medium: [25, 38], large: [ 42,  66] } },
  // THE icefish: ghostly pale, with clear blood and a crocodile's head. A
  // hunter that also eats krill.
  { id: "icefish",  nlName: "IJsvis",    baits: ["krill", "aasvisje", "pilker", "lichtjig"],   speciesWeight:  35, sizeWeights: [45, 40, 15],
    lengthCm: { small: [20, 30], medium: [35, 50], large: [ 55,  75] } },
  { id: "dragonfish", nlName: "Draakvis", baits: ["krill", "aasvisje", "lichtjig"],           speciesWeight:  25, sizeWeights: [50, 38, 12],
    lengthCm: { small: [10, 16], medium: [18, 28], large: [ 30,  42] } },

  // On the bottom: worms and krill; the eelpout also takes squid.
  { id: "plunderfish", nlName: "Plundervis", baits: ["zeepier", "krill"],                     speciesWeight:  55, sizeWeights: [55, 35, 10],
    lengthCm: { small: [ 8, 12], medium: [14, 20], large: [ 22,  30] } },
  { id: "eelpout",  nlName: "Puitaal",   baits: ["zeepier", "inktvis"],                        speciesWeight:  45, sizeWeights: [50, 38, 12],
    lengthCm: { small: [12, 18], medium: [20, 30], large: [ 33,  45] } },
  // Soft and pink as jelly, the strangest of them.
  { id: "snailfish", nlName: "Slakdolf", baits: ["zeepier", "krill"],                         speciesWeight:  25, sizeWeights: [55, 35, 10],
    lengthCm: { small: [ 8, 12], medium: [14, 20], large: [ 22,  30] } },
  // The South Pole's "cod": big, common, and it bites at everything.
  { id: "rockcod",  nlName: "Gemarmerde rotskabeljauw", baits: ["krill", "zeepier", "inktvis", "aasvisje", "pilker"], speciesWeight: 55, sizeWeights: [50, 38, 12],
    lengthCm: { small: [20, 30], medium: [35, 55], large: [ 60,  92] } },

  // Bigger and rarer: squid and bait fish on the bottom, or a jig.
  { id: "skate",    nlName: "Sterrog",   baits: ["inktvis", "aasvisje", "zeepier"],            speciesWeight:  10, sizeWeights: [45, 40, 15],
    lengthCm: { small: [30, 45], medium: [50, 70], large: [ 75, 100] }, maxReelTurns: 11 },
  { id: "grenadier", nlName: "Grenadiervis", baits: ["inktvis", "aasvisje", "pilker", "lichtjig"], speciesWeight: 6, sizeWeights: [45, 40, 15],
    lengthCm: { small: [30, 45], medium: [50, 72], large: [ 78, 105] }, maxReelTurns: 12 },

  // The trophy of the ice: the toothfish, two metres long and as heavy as a
  // grown man, that can live for fifty years. Squid, a bait fish or a jig.
  { id: "toothfish", nlName: "Tandvis",  baits: ["inktvis", "aasvisje", "pilker", "lichtjig"], speciesWeight: 1.5, sizeWeights: [50, 35, 15],
    lengthCm: { small: [40, 70], medium: [80, 130], large: [140, 200] }, maxReelTurns: 14 },
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
  greece: ["gilthead", "whitebream", "seabass", "mullet", "redmullet", "barracuda",
           "garfish", "horsemackerel", "bonito", "dentex", "amberjack", "moray"],
  antarctica: ["silverfish", "lanternfish", "mackerelicefish", "icefish", "dragonfish",
               "plunderfish", "eelpout", "snailfish", "rockcod", "skate", "grenadier",
               "toothfish"],
};

/** All species of one map, in display order. */
export function speciesForMap(mapId) {
  return (MAP_SPECIES[mapId] || []).map((id) => FISH_BY_ID[id]);
}

/** The maps a species lives on. */
export function mapsOfSpecies(speciesId) {
  return Object.keys(MAP_SPECIES).filter((mapId) => MAP_SPECIES[mapId].includes(speciesId));
}

/**
 * Under which name a catch is kept in the save tables (fishCounts,
 * catchCountsBySize, bestCatches). A species that lives on one map: its id,
 * as always. A species that lives on more than one keeps its plain id on
 * its first map and gets `<id>@<map>` on the others -- so a catfish from
 * the French lake is counted apart from a catfish from the moat, and every
 * catch made before there was a second map stays where it was.
 */
export function catchKey(speciesId, mapId) {
  const home = mapsOfSpecies(speciesId)[0];
  return !mapId || !home || mapId === home ? speciesId : `${speciesId}@${mapId}`;
}

/** How common a species is on a map (it may be rarer in one place than in another). */
export function speciesWeightOn(species, mapId) {
  return species.weightOn?.[mapId] ?? species.speciesWeight;
}

/** The longest a species grows: the top of its "large" range, in cm. */
export function recordCm(species) {
  return species.lengthCm.large[1];
}

// A GIANT: a catch within this share of the longest its kind can be (0.95 =
// no more than 5 % short of the record). About one bite in 80-150,
// depending on the bait (see "The old ones" below). It is called out ("Wow!
// Een gigantische snoek!"), it glitters on the catch screen, and its card
// in the fish book keeps glittering.
export const GIANT_SHARE = 0.95;

/** The length in cm from which a fish of this species is a giant. */
export function giantFromCm(species) {
  return recordCm(species) * GIANT_SHARE;
}

/** Is a fish of this species and this length (cm) a giant? */
export function isGiant(speciesId, lengthCm) {
  const species = FISH_BY_ID[speciesId];
  return !!species && typeof lengthCm === "number" && lengthCm >= giantFromCm(species);
}

// ---------------------------------------------------------------------------
// The old ones
// ---------------------------------------------------------------------------
// A giant is a very old fish. Going by the lengths alone (RECORD_SKEW) one
// turned up once in 140-240 bites, and of the rare species practically
// never: a little too rare. So besides the ordinary roll, every hooked fish
// has a small chance of being one of the OLD ONES of its kind -- a fish
// somewhere in the top 5 % of what its kind can reach, a giant for certain.
//
// How big that chance is follows nature: the older a kind of fish can get,
// the more very old ones there are about. A goby or a minnow lives a few
// years and hardly any gets old; pike, carp and cod live for decades; a
// catfish for eighty years and a sturgeon for a hundred -- and in water
// where nobody takes them out (a moat, a mountain lake) one year class
// piles up on the other. So a species gets OLD_ONE_PER_YEAR for every year
// it can live: 1 in 250 hooked perch, 1 in 100 eels, 1 in 50 sturgeon.
// `node scripts/fish-odds.js` prints what that comes to per fish and bait.
//
// OLDEST_YEARS: the greatest age each species is known to reach (FishBase
// and angling literature, rounded and kept sober -- not the one freak in an
// aquarium; the eel as in closed water, where it cannot leave to spawn).
export const OLDEST_YEARS = {
  // The moat
  roach: 14, rudd: 17, goby: 5, perch: 20, bream: 23, tench: 20,
  carp: 40, mirrorcarp: 40, eel: 50, zander: 17, pike: 25, catfish: 80,
  // The French lake
  gudgeon: 8, minnow: 6, chub: 22, barbel: 20, bass: 20, grayling: 14,
  trout: 20, rainbowtrout: 11, char: 30, salmon: 13, sturgeon: 100,
  // The North Sea
  herring: 22, whiting: 20, mackerel: 18, flounder: 15, plaice: 50, garfish: 18,
  seabass: 30, cod: 25, ray: 15, conger: 20, tuna: 35, shark: 45,
  // The Greek coast
  gilthead: 11, whitebream: 12, mullet: 20, redmullet: 11, horsemackerel: 12,
  barracuda: 12, bonito: 5, dentex: 30, amberjack: 17, moray: 30,
  // The ice of the South Pole: cold water, slow lives, old fish.
  silverfish: 14, lanternfish: 4, mackerelicefish: 12, icefish: 15, dragonfish: 10,
  plunderfish: 8, eelpout: 15, snailfish: 8, rockcod: 20, skate: 20, grenadier: 40,
  toothfish: 45,
};
// A species that is not in the list is taken for an ordinary one.
const OLDEST_YEARS_UNKNOWN = 15;
export const OLD_ONE_PER_YEAR = 0.0002;
// Among the old ones, too, the closer to the record the rarer: an old one's
// place in its band of lengths is (a random number 0..1) to this power.
export const OLD_ONE_SKEW = 2;

/** The chance that a hooked fish of this species is one of the old ones. */
export function oldOneChance(species) {
  return (OLDEST_YEARS[species.id] ?? OLDEST_YEARS_UNKNOWN) * OLD_ONE_PER_YEAR;
}

/** The lengths an old one can have, in whole cm: [from, to], both giants. */
export function oldOneRange(species) {
  return [Math.ceil(giantFromCm(species)), recordCm(species)];
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
 * In which sizes a species can be caught on a bait, each with its weight
 * and its range of lengths in cm.
 *
 * `smallest` is the smallest fish the bait can hook, as { size, cm } (from
 * smallestCatchOn in data/baits.js; null = anything goes). A fish that
 * would have been too small comes as the smallest that IS allowed: its
 * weight goes there. So on a lure nothing is "small" and nothing is under
 * 20 cm, the species are as common as on any bait, and a big one is exactly
 * as rare as it always was. Empty when the species never gets big enough.
 *
 * @returns {{ size: string, weight: number, range: [number, number] }[]}
 */
export function catchableSizes(species, smallest = null) {
  const fromSize = smallest?.size ? Math.max(0, FISH_SIZES.indexOf(smallest.size)) : 0;
  const fromCm = smallest?.cm ?? 0;
  const sizes = [];
  let tooSmall = 0;      // the weight of the sizes passed over so far
  FISH_SIZES.forEach((size, i) => {
    // Some legacy species records may have no lengthCm table -- fall back
    // to a safe default rather than throwing.
    const [lo, hi] = (species.lengthCm && species.lengthCm[size])
      || { small: [10, 15], medium: [20, 35], large: [40, 60] }[size];
    if (i < fromSize || hi < fromCm) {
      tooSmall += species.sizeWeights[i];
      return;
    }
    sizes.push({ size, weight: species.sizeWeights[i] + tooSmall, range: [Math.max(lo, fromCm), hi] });
    tooSmall = 0;
  });
  return sizes;
}

/**
 * Weighted random pick of a fish among the species that live on the given
 * map and accept the given bait id. Returns { species, size, lengthCm } --
 * species and size are strings; lengthCm is an integer drawn from the
 * species' range for the chosen size. Now and then the fish is one of the
 * old ones of its kind (see "The old ones" above): then it is a giant.
 *
 * @param {string} baitId a bait or lure id from data/baits.js
 * @param {string} mapId  a map id from data/maps.js
 * @param {() => number} rng injectable random; defaults to Math.random
 * @param {{ size?: string, cm?: number } | null} smallest the smallest fish
 *   this bait can hook (smallestCatchOn in data/baits.js); see catchableSizes
 * @returns {{ species: string, size: string, lengthCm: number } | null}
 *   null when no species there accepts the bait (shouldn't happen with our matrix)
 */
export function weightedPick(baitId, mapId, rng = Math.random, smallest = null) {
  const eligible = speciesForMap(mapId)
    .filter(s => s.baits.includes(baitId))
    .map(s => ({ species: s, sizes: catchableSizes(s, smallest) }))
    .filter(e => e.sizes.length > 0);
  if (eligible.length === 0) return null;

  // Stage 1: pick a species by its weight on this map.
  const totalSpeciesWeight = eligible.reduce((sum, e) => sum + speciesWeightOn(e.species, mapId), 0);
  let roll = rng() * totalSpeciesWeight;
  let chosen = eligible[eligible.length - 1];
  for (const e of eligible) {
    roll -= speciesWeightOn(e.species, mapId);
    if (roll <= 0) { chosen = e; break; }
  }

  // One of the old ones? Then it is a large one from the top of the range,
  // whatever the rolls below would have said.
  if (chosen.sizes.some(s => s.size === "large") && rng() < oldOneChance(chosen.species)) {
    const [from, to] = oldOneRange(chosen.species);
    const lengthCm = Math.min(to, from + Math.floor(rng() ** OLD_ONE_SKEW * (to - from + 1)));
    return { species: chosen.species.id, size: "large", lengthCm };
  }

  // Stage 2: pick a size for that species.
  const totalSizeWeight = chosen.sizes.reduce((sum, s) => sum + s.weight, 0);
  let sizeRoll = rng() * totalSizeWeight;
  let chosenSize = chosen.sizes[chosen.sizes.length - 1];
  for (const s of chosen.sizes) {
    sizeRoll -= s.weight;
    if (sizeRoll <= 0) { chosenSize = s; break; }
  }

  // Stage 3: pick a centimetre length within the chosen size bucket.
  const [lo, hi] = chosenSize.range;
  // A large one: the closer to the record, the rarer.
  const place = chosenSize.size === "large" ? rng() ** RECORD_SKEW : rng();
  const lengthCm = Math.round(lo + place * (hi - lo));

  return { species: chosen.species.id, size: chosenSize.size, lengthCm };
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
