// The boats of the big ocean: what you fish from there. On that map the
// float button (there are no floats behind a boat) becomes the boat button.
//
// Every boat has the same shape -- the back rail straight across at the
// same height, the deck below it, the children in the same place -- and the
// sea above the rail is the very same picture (scripts/make_boats.py takes
// it from the first painting): so one water film, one fishing area and the
// places in maps.js fit them all. Only the boat itself differs.
//
// An id is saved (the chosen boat, per team): never change one.
//
// Pure data. Imports nothing.

export const BOATS = [
  { id: 'sportvis',     nlName: 'Sportvisboot', painting: 'backdrop-ocean' },
  { id: 'vissersboot',  nlName: 'Vissersboot',  painting: 'backdrop-ocean-vissersboot' },
  { id: 'piratenschip', nlName: 'Piratenschip', painting: 'backdrop-ocean-piratenschip' },
  { id: 'speedboot',    nlName: 'Speedboot',    painting: 'backdrop-ocean-speedboot' },
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

/** A square piece of its painting -- the stern and the deck -- for buttons. */
export function boatIconKey(boat) { return `boat-icon-${boat.id}`; }
export function boatIconImage(boat) { return `clean/boat_${boat.id}_icon.jpg`; }
