// Fishing spots. Each map is a 4:3 painting with something to fish from in
// its lower-left corner -- a jetty (the moat), a floating pontoon (the
// French lake) or a stone pier (the sea); everything a scene needs
// to know about ONE spot lives here, so FishingScene itself contains no
// "lake" or "sea" specifics.
//
// Pure data + small helpers. Imports only constants.js, so any other
// module can import this without creating a cycle.

import { WORLD_TOP, WORLD_HEIGHT } from '../constants.js';

// ---------------------------------------------------------------------------
// Waterlines
// ---------------------------------------------------------------------------
//
// A waterline is a list of [x, y] samples in DESIGN coordinates: for each x
// across the painting, the y where water starts. Taps below the line are
// casts; taps above it (trees, shore, sky) are ignored.
//
// Press 'W' in the fishing scene to see the active map's curve drawn over
// the painting.

// The moat of Naarden-Vesting, traced from assets/raw/backdrop-naarden.png.
// From x = 335 on, the water starts at the foot of the fortress wall; left
// of that it follows the bastion's corner, the stony shore and -- from
// x = 105 down to the jetty -- the reeds and rocks of the near bank.
const NAARDEN_WATERLINE = [
  [   0, 585], [  50, 580], [  65, 505], [ 105, 500], [ 110, 356],
  [ 140, 348], [ 165, 302], [ 190, 287], [ 240, 280], [ 270, 272],
  [ 330, 267], [ 336, 253], [1280, 252],
];

// The mountain lake in France, traced from assets/raw/backdrop-france.png.
// From x = 250 on, the water starts at the stones of the far shore; left of
// that it follows the reeds, the rowing boat and the near bank down to the
// grass beside the pontoon.
const FRANCE_WATERLINE = [
  [   0, 520], [  58, 520], [  64, 354], [ 100, 340], [ 176, 333],
  [ 230, 300], [ 250, 268], [1280, 266],
];

/**
 * A horizon as a fraction of the painting's height (0 = top, 1 = bottom)
 * -> a flat two-point waterline in design coordinates.
 */
function flatHorizon(fraction) {
  const y = WORLD_TOP + fraction * WORLD_HEIGHT;
  return [[0, y], [1280, y]];
}

/** Build the "where does water start at this x" lookup for a waterline. */
function makeWaterTopAt(samples) {
  const last = samples.length - 1;
  return (x) => {
    if (x <= samples[0][0]) return samples[0][1];
    if (x >= samples[last][0]) return samples[last][1];
    // Binary search for the bracketing pair, then interpolate.
    let lo = 0, hi = last;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (samples[mid][0] <= x) lo = mid; else hi = mid;
    }
    const [x0, y0] = samples[lo];
    const [x1, y1] = samples[hi];
    return y0 + (y1 - y0) * ((x - x0) / (x1 - x0));
  };
}

// ---------------------------------------------------------------------------
// The maps
// ---------------------------------------------------------------------------
//
// Fields:
//   id              save-data key and scene parameter
//   backdropKey     Phaser texture key of the painting (still image)
//   backdropImage   its file (made by scripts/make_paintings.py)
//   backdropVideo   optional: a looping video of the same painting in
//                   which the water moves (made by scripts/make_water.py).
//                   The still is shown at once, the video takes over as
//                   soon as it has loaded.
//   skyMask         alpha image of the painting's sky, for the clouds
//   skyMaskFraction how much of the painting's height that image covers
//   clouds          the layers of clouds drifting across the sky, far one
//                   first (painted into this map's own sky and lifted off
//                   it again: scripts/make_clouds.py). Each is a long
//                   transparent picture that repeats:
//                     src     the picture
//                     height  design px of sky it spans, from the top of
//                             the painting downwards
//                     speed   drift in design px per second (far = slow)
//                     alpha   opacity (far = fainter, as through haze)
//                   (The "look what we caught" painting shows the children,
//                   so it belongs to a team AND a map: see catchBgKey().)
//   seat            design x/y of the bottom-left corner of the tackle box
//                   the angler sits on: where the crew is on this
//                   painting's jetty or pier (systems/Crew.js).
//   landing         design x/y of the spot on the water, right at the jetty
//                   or the foot of the pier, where a fish (or a lure) is
//                   drawn to before it is lifted out. A slack line also
//                   comes down onto the water between here and the float.
//   dry             the jetty or pier as it stands in the picture -- top,
//                   front and posts -- as a polygon of [x, y] points: below
//                   the waterline, but not water. A float cannot land on it.
//   waterline       see above
//   depthFarY       design y where a cast counts as "far away" (the float
//                   is drawn smallest there, full size at the jetty)
//   defaultBait     what is on the hook the first time you fish here
//   nlName          what the place is called: spoken when it is chosen
//                   (the phrase `map_<id>` of a voice atlas)
//   music           ambient loop key; falls back to the lake's if missing
//   voiceVolume     how loud the voice speaks here, as a share of its usual
//                   volume (1 if left out): on the pier it has the waves,
//                   the gulls and louder music to speak over
//   ambience        what is heard here besides the music (systems/
//                   Ambience.js): a `bed` that goes round and round, and
//                   sounds that are `passing` now and then. `every` and
//                   `first`: how many seconds until the next one and until
//                   the first one, as [shortest, longest]; `volume` as
//                   [softest, loudest] (the files all have the same
//                   loudness, see scripts/make_ambience.py); `vary`: how far
//                   its pitch may wander, as a share (0.07 = 7 % up or down)

// The horizon of assets/raw/backdrop-sea.png lies 24.5% down the painting;
// casting starts a hair below it, so a float never sits ON the line.
const SEA_SKY = 0.245;
const SEA_HORIZON = SEA_SKY + 0.005;

const MAP_DEFS = [
  {
    id: 'lake',
    // The id stays 'lake' for good: it is in every player's save data.
    nlName: 'Naarden-Vesting',
    backdropKey: 'backdrop',
    backdropImage: 'clean/backdrop-naarden.jpg',
    backdropVideo: 'clean/backdrop-naarden.mp4',
    skyMask: 'clean/sky-mask-naarden.png',
    skyMaskFraction: 320 / 720,
    // Each picture spans the top 28% of the painting (the same share as
    // in scripts/make_clouds.py) and is wider than the screen, so no cloud
    // is on screen twice.
    clouds: [
      { src: 'clean/clouds-lake-back.png',  height: 0.28 * WORLD_HEIGHT, speed: 1.4, alpha: 0.95 },
      { src: 'clean/clouds-lake-front.png', height: 0.28 * WORLD_HEIGHT, speed: 3.6, alpha: 1 },
    ],
    seat: { x: 268, y: 618 },
    landing: { x: 612, y: 634 },
    dry: [
      [0, 568], [319, 523], [580, 588], [580, 632], [534, 640], [534, 718], [480, 718],
      [480, 655], [322, 698], [322, 795], [262, 795], [262, 714], [62, 768], [62, 840], [0, 840],
    ],
    waterline: NAARDEN_WATERLINE,
    depthFarY: 252,
    defaultBait: 'wormen',
    music: 'ambient',
    ambience: {
      bed: { name: 'lake-birds', volume: 0.5 },
      passing: [
        // A fish jumps somewhere on the moat.
        { name: 'lake-plons', every: [25, 70], first: [12, 40], volume: [0.3, 0.6], vary: 0.06 },
        // The bells of the Grote Kerk, across the water.
        { name: 'lake-bells', every: [150, 330], first: [45, 120], volume: [0.3, 0.45] },
      ],
    },
  },
  {
    // The game's very first painting, a mountain lake, moved to France: a
    // floating pontoon on wine barrels, a village and a chateau across the
    // water. Its fish are those of clear, cold water.
    id: 'france',
    nlName: 'Frankrijk',
    backdropKey: 'backdrop-france',
    backdropImage: 'clean/backdrop-france.jpg',
    backdropVideo: 'clean/backdrop-france.mp4',
    skyMask: 'clean/sky-mask-france.png',
    skyMaskFraction: 320 / 720,
    clouds: [
      { src: 'clean/clouds-france-back.png',  height: 0.28 * WORLD_HEIGHT, speed: 1.3, alpha: 0.95 },
      { src: 'clean/clouds-france-front.png', height: 0.28 * WORLD_HEIGHT, speed: 3.4, alpha: 1 },
    ],
    // In the middle of the pontoon's planks, between its two mooring poles
    // and well back from its front edge.
    seat: { x: 196, y: 598 },
    landing: { x: 640, y: 648 },
    // Deck, barrels and both poles.
    dry: [
      [0, 494], [92, 520], [95, 402], [141, 402], [143, 530], [532, 592], [535, 447],
      [589, 447], [591, 676], [550, 709], [422, 735], [335, 776], [128, 840], [0, 840],
    ],
    waterline: FRANCE_WATERLINE,
    depthFarY: 266,
    defaultBait: 'wormen',
    music: 'ambient',
    ambience: {
      bed: { name: 'lake-birds', volume: 0.5 },
      passing: [
        // A trout rises.
        { name: 'lake-plons', every: [20, 60], first: [10, 35], volume: [0.3, 0.6], vary: 0.06 },
        // The bells of the village church across the lake.
        { name: 'lake-bells', every: [150, 330], first: [60, 150], volume: [0.3, 0.45] },
      ],
    },
  },
  {
    id: 'sea',
    nlName: 'Noordzee',
    backdropKey: 'backdrop-sea',
    backdropImage: 'clean/backdrop-sea.jpg',
    backdropVideo: 'clean/backdrop-sea.mp4',
    skyMask: 'clean/sky-mask-sea.png',
    skyMaskFraction: 320 / 720,
    // Each picture spans the whole sky, down to the horizon.
    clouds: [
      { src: 'clean/clouds-sea-back.png',  height: SEA_SKY * WORLD_HEIGHT, speed: 1.5, alpha: 0.95 },
      { src: 'clean/clouds-sea-front.png', height: SEA_SKY * WORLD_HEIGHT, speed: 4,   alpha: 1 },
    ],
    // Well back from the edge, on the paving of the pier's top.
    seat: { x: 214, y: 526 },
    landing: { x: 668, y: 690 },
    dry: [
      [0, 480], [172, 444], [300, 450], [468, 430], [522, 432], [566, 478], [600, 505],
      [620, 735], [540, 770], [400, 792], [315, 840], [0, 840],
    ],
    waterline: flatHorizon(SEA_HORIZON),
    depthFarY: WORLD_TOP + SEA_HORIZON * WORLD_HEIGHT,
    defaultBait: 'zeepier',
    music: 'relaxing',
    voiceVolume: 1.15,
    ambience: {
      bed: { name: 'sea-waves', volume: 0.6 },
      passing: [
        { name: 'sea-gulls', every: [22, 60], first: [8, 25], volume: [0.18, 0.38], vary: 0.07 },
        // A ship far out.
        { name: 'sea-horn', every: [140, 320], first: [50, 130], volume: [0.4, 0.55] },
      ],
    },
  },
];

/** Is (x, y) inside the polygon? (Even-odd rule.) */
function insidePolygon(points, x, y) {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const [xi, yi] = points[i];
    const [xj, yj] = points[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

export const MAPS = MAP_DEFS.map((def) => {
  const waterTopAt = makeWaterTopAt(def.waterline);
  const dry = def.dry || [];
  return Object.freeze({
    ...def,
    /** Design y where water starts at design x. */
    waterTopAt,
    /** Can something float at design (x, y)? Below the waterline, not on the jetty. */
    isWater: (x, y) => y >= waterTopAt(x) && !insidePolygon(dry, x, y),
    /** Highest point of the waterline (smallest y). */
    waterMinY: Math.min(...def.waterline.map((p) => p[1])),
  });
});

export const MAPS_BY_ID = Object.fromEntries(MAPS.map((m) => [m.id, m]));

export const DEFAULT_MAP_ID = 'lake';

/**
 * The "look what we caught" painting of a team on a map: texture key and
 * file (made by scripts/make_paintings.py from assets/raw/catch-*.png).
 */
export function catchBgKey(teamId, mapId) {
  return `catch-${teamId}-${mapId}`;
}
export function catchBgImage(teamId, mapId) {
  return `clean/catch-${teamId}-${mapId}.jpg`;
}

/** The map for an id, or the default map when the id is unknown. */
export function getMap(mapId) {
  return MAPS_BY_ID[mapId] || MAPS_BY_ID[DEFAULT_MAP_ID];
}
