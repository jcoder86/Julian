// James's collection on the first map as it stood on 11 October 2026: 176
// fish, read off a photo of his collection screen. He caught them on the
// "start as guest" button of one tablet; the team James & Boaz plays on that
// same save profile ('guest'), but on every other device it started empty.
//
// SaveSystem.adoptJamesCatches() puts this in, once, on a device where
// James & Boaz have no lake fish yet. The three objects have exactly the
// shape the game stores them in (see the keys in SaveSystem.js).
//
// Never edit the numbers: they are what one boy really caught.

export const JAMES_CATCHES = Object.freeze({
  fishCounts: {
    roach: 16, rudd: 17, bream: 9, tench: 8,
    carp: 5, perch: 66, bass: 7, pike: 19,
    zander: 10, chub: 6, trout: 10, catfish: 3,
  },
  catchCountsBySize: {
    roach:   { small: 12, medium: 4 },
    rudd:    { small: 14, medium: 3 },
    bream:   { small: 4, medium: 3, large: 2 },
    tench:   { small: 1, medium: 6, large: 1 },
    carp:    { small: 4, medium: 1 },
    perch:   { small: 44, medium: 17, large: 5 },
    bass:    { small: 4, medium: 1, large: 2 },
    pike:    { small: 6, medium: 10, large: 3 },
    zander:  { small: 3, medium: 5, large: 2 },
    chub:    { small: 3, medium: 3 },
    trout:   { small: 5, medium: 3, large: 2 },
    catfish: { medium: 3 },
  },
  bestCatches: {
    roach:   { small: 10, medium: 22 },
    rudd:    { small: 12, medium: 20 },
    bream:   { small: 12, medium: 40, large: 75 },
    tench:   { small: 14, medium: 36, large: 68 },
    carp:    { small: 25, medium: 45 },
    perch:   { small: 10, medium: 30, large: 54 },
    bass:    { small: 11, medium: 33, large: 59 },
    pike:    { small: 29, medium: 85, large: 125 },
    zander:  { small: 25, medium: 62, large: 93 },
    chub:    { small: 14, medium: 35 },
    trout:   { small: 24, medium: 39, large: 57 },
    catfish: { medium: 106 },
  },
  // The card that was lit up on the photo: his last catch was a medium
  // catfish. How long it was the photo does not say.
  lastCatch: { species: 'catfish', size: 'medium' },
});
