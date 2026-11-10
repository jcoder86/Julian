// The boats of the big ocean: what you fish from there. On that map the
// float button (there are no floats behind a boat) becomes the boat button.
//
// Every boat has the same shape -- the back rail straight across at the
// same height, the deck below it -- and the sea above the rail is the very
// same picture (scripts/make_boats.py takes it from the first painting): so
// one water film, one fishing area and the places in maps.js fit them all.
// Only the boat itself differs; and where its walls are higher, the
// children sit further forward (`seat`).
//
// `props`: what belongs on that boat, cut out on green and placed by the
// game (src/systems/BoatProps.js) -- on the right of the deck, at the right
// corner and in the sky, never where the children sit, where the rod swings
// back or where the reel comes up. Each: `name` (its file:
// clean/prop_<boat>_<name>.png), `x`, `y` its bottom middle (design px),
// `height` how tall it is drawn, and `kind`:
//   deck    stands on the deck, a soft shadow under it (`glints`: gold that
//           sparkles)
//   flag    a flag on its pole (`frames`: the pole and the cloth, cut apart
//           on canvases of one size; the pole is the left edge, `flip`: the
//           right): the pole stands still, the cloth waves from it
//   perch   a bird on the rail: it shifts and looks about (`foot`: how far
//           down its picture its claws are -- they grip the rail at `y`,
//           the tail hangs down over the wall)
//   gulls   two gulls now and then flying over the wake (`frames`: wings up,
//           wings down)
//
// An id is saved (the chosen boat, per team): never change one.
//
// Pure data. Imports nothing.

export const BOATS = [
  { id: 'sportvis',     nlName: 'Sportvisboot', painting: 'backdrop-ocean',
    props: [
      { name: 'chair', kind: 'deck', x: 900, y: 655, height: 230 },
      { name: 'flag', kind: 'flag', frames: ['flag-pole', 'flag-cloth'], x: 1118, y: 437, height: 200, flip: true },
    ] },
  // (Its bulwark is higher than the sport-fishing boat's: the children sit
  // further forward on the deck, not against the wall: `seat`, as in maps.js.)
  { id: 'vissersboot',  nlName: 'Vissersboot',  painting: 'backdrop-ocean-vissersboot', seat: { x: 290, y: 705 },
    props: [
      { name: 'net', kind: 'deck', x: 650, y: 700, height: 110 },
      { name: 'crates', kind: 'deck', x: 850, y: 690, height: 165 },
      { name: 'gulls', kind: 'gulls', frames: ['gull-up', 'gull-down'], height: 46 },
    ] },
  { id: 'piratenschip', nlName: 'Piratenschip', painting: 'backdrop-ocean-piratenschip', seat: { x: 290, y: 705 },
    props: [
      { name: 'chest', kind: 'deck', x: 800, y: 700, height: 130, glints: true },
      { name: 'cannon', kind: 'deck', x: 1010, y: 665, height: 150 },
      { name: 'flag', kind: 'flag', frames: ['flag-pole', 'flag-cloth'], x: 1118, y: 437, height: 210, flip: true },
      { name: 'parrot', kind: 'perch', x: 905, y: 437, height: 120, foot: 0.55 },
    ] },
  { id: 'speedboot',    nlName: 'Speedboot',    painting: 'backdrop-ocean-speedboot',
    props: [
      { name: 'cooler', kind: 'deck', x: 930, y: 640, height: 150 },
      { name: 'flag', kind: 'flag', frames: ['flag-pole', 'flag-cloth'], x: 1118, y: 437, height: 190, flip: true },
    ] },
];

export const DEFAULT_BOAT_ID = 'sportvis';
export const BOATS_BY_ID = Object.fromEntries(BOATS.map((b) => [b.id, b]));

/** The chosen boat, or the first one for an unknown id. */
export function getBoat(id) {
  return BOATS_BY_ID[id] || BOATS_BY_ID[DEFAULT_BOAT_ID];
}

/** Its painting: texture key (the same as its file name), still, and video. */
export function boatTextureKey(boat) { return boat.painting; }
export function boatImage(boat) { return `clean/${boat.painting}.jpg`; }
export function boatVideo(boat) { return `clean/${boat.painting}.mp4`; }

/** The whole boat, seen from outside: on the sea for the boat menu... */
export function boatIconKey(boat) { return `boat-icon-${boat.id}`; }
export function boatIconImage(boat) { return `clean/boat_${boat.id}_icon.jpg`; }
/** ...and cut out, on its own, for the round boat button. */
export function boatBadgeKey(boat) { return `boat-badge-${boat.id}`; }
export function boatBadgeImage(boat) { return `clean/boat_${boat.id}_badge.png`; }

/** Its props' pictures: one per prop, or a gull's two (`frames`). */
export function propFiles(prop) { return prop.frames || [prop.name]; }
export function propTextureKey(boat, file) { return `prop-${boat.id}-${file}`; }
export function propImage(boat, file) { return `clean/prop_${boat.id}_${file}.png`; }
