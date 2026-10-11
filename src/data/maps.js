// Fishing spots. Each map is a 4:3 painting with a jetty (the moat) or a
// stone pier (the sea) in the lower-left corner; everything a scene needs
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
//                   first. Each is a long transparent picture that repeats:
//                     src     the picture
//                     height  design px of sky it spans, from the top of
//                             the painting downwards
//                     speed   drift in design px per second (far = slow)
//                     alpha   opacity (far = fainter, as through haze)
//   catchBgKey /    the "look what I caught" painting. Optional file: when
//   catchBgImage    it is missing the lake's is used.
//   julianAnchor    design x/y of the bottom-left corner of Julian's sprite
//                   (a square with some empty margin around him): where he
//                   sits on this painting's jetty or pier. Dirk and the rod
//                   are placed relative to it.
//   waterline       see above
//   depthFarY       design y where a cast counts as "far away" (the float
//                   is drawn smallest there, full size at the jetty)
//   defaultBait     what is on the hook the first time you fish here
//   music           ambient loop key; falls back to the lake's if missing

// The horizon of assets/raw/backdrop-sea.png lies 24.5% down the painting;
// casting starts a hair below it, so a float never sits ON the line.
const SEA_SKY = 0.245;
const SEA_HORIZON = SEA_SKY + 0.005;

const MAP_DEFS = [
  {
    id: 'lake',
    // The id stays 'lake' for good: it is in every player's save data.
    backdropKey: 'backdrop',
    backdropImage: 'clean/backdrop-naarden.jpg',
    backdropVideo: 'clean/backdrop-naarden.mp4',
    skyMask: 'clean/sky-mask-naarden.png',
    skyMaskFraction: 320 / 720,
    clouds: [
      { src: 'clean/clouds-back.png',  height: 192,   speed: 1.25, alpha: 0.55 },
      { src: 'clean/clouds-front.png', height: 172.8, speed: 3.75, alpha: 0.85 },
    ],
    catchBgKey: 'catch-bg',
    catchBgImage: 'raw/catch.png',
    julianAnchor: { x: 260, y: 640 },
    waterline: NAARDEN_WATERLINE,
    depthFarY: 252,
    defaultBait: 'wormen',
    music: 'ambient',
  },
  {
    id: 'sea',
    backdropKey: 'backdrop-sea',
    backdropImage: 'clean/backdrop-sea.jpg',
    backdropVideo: 'clean/backdrop-sea.mp4',
    skyMask: 'clean/sky-mask-sea.png',
    skyMaskFraction: 320 / 720,
    // Made by scripts/make_clouds.py: each picture spans the whole sky down
    // to the horizon and is wider than the screen, so no cloud shows twice.
    clouds: [
      { src: 'clean/clouds-sea-back.png',  height: SEA_SKY * WORLD_HEIGHT, speed: 1.5, alpha: 0.8 },
      { src: 'clean/clouds-sea-front.png', height: SEA_SKY * WORLD_HEIGHT, speed: 4,   alpha: 0.96 },
    ],
    catchBgKey: 'catch-bg-sea',
    catchBgImage: 'clean/catch-sea.jpg',
    // Well back from the edge, on the paving of the pier's top.
    julianAnchor: { x: 204, y: 547 },
    waterline: flatHorizon(SEA_HORIZON),
    depthFarY: WORLD_TOP + SEA_HORIZON * WORLD_HEIGHT,
    defaultBait: 'zeepier',
    music: 'sea',
  },
];

export const MAPS = MAP_DEFS.map((def) => {
  const waterTopAt = makeWaterTopAt(def.waterline);
  return Object.freeze({
    ...def,
    /** Design y where water starts at design x. */
    waterTopAt,
    /** Highest point of the waterline (smallest y). */
    waterMinY: Math.min(...def.waterline.map((p) => p[1])),
  });
});

export const MAPS_BY_ID = Object.fromEntries(MAPS.map((m) => [m.id, m]));

export const DEFAULT_MAP_ID = 'lake';

/** The map for an id, or the default map when the id is unknown. */
export function getMap(mapId) {
  return MAPS_BY_ID[mapId] || MAPS_BY_ID[DEFAULT_MAP_ID];
}
