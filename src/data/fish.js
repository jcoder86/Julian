// Fish definitions. `color` is the placeholder fill -- replaced by sprite
// art later. `size` is the diameter of the placeholder circle in pixels.
// `rarity` is a relative weight; weightedPick() handles the math.

export const FISH = [
  { id: 'small_yellow',       color: 0xfff05a, size:  30, rarity: 50 },
  { id: 'medium_orange',      color: 0xff9a3c, size:  50, rarity: 25 },
  { id: 'large_red',          color: 0xe53935, size:  70, rarity: 15 },
  { id: 'huge_blue',          color: 0x1e88e5, size:  90, rarity:  8 },
  { id: 'legendary_rainbow',  color: 0xd81b60, size: 110, rarity:  2 },
];

/**
 * Picks one fish using rarity weights. Higher weight = more common.
 * @param {() => number} rng -- defaults to Math.random; injectable for tests.
 */
export function weightedPick(rng = Math.random) {
  const total = FISH.reduce((sum, f) => sum + f.rarity, 0);
  let roll = rng() * total;
  for (const fish of FISH) {
    roll -= fish.rarity;
    if (roll <= 0) return fish;
  }
  // Fallback in case of floating-point drift; the last fish wins.
  return FISH[FISH.length - 1];
}

export function getFishById(id) {
  return FISH.find(f => f.id === id) || null;
}
