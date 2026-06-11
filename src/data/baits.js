// Bait definitions. Order in BAITS array determines display order in the
// bait-selection menu. Texture keys match files produced by
// scripts/split_atlas.py: clean/bait_<id>_full.png + clean/bait_<id>_simple.png.

export const BAITS = [
  { id: "brood",  displayName: "Brood",   nlName: "Brood" },
  { id: "mais",   displayName: "Mais",    nlName: "Mais" },
  { id: "maden",  displayName: "Maden",   nlName: "Maden" },
  { id: "wormen", displayName: "Wormen",  nlName: "Wormen" },
  { id: "vis",    displayName: "Vis",     nlName: "Vis" },
];

export const BAITS_BY_ID = Object.fromEntries(BAITS.map(b => [b.id, b]));

/** Texture key for selection-menu (full) bait sprite. */
export function baitFullTextureKey(baitId) {
  return `bait_${baitId}_full`;
}

/** Texture key for in-icon (simple) bait sprite. */
export function baitSimpleTextureKey(baitId) {
  return `bait_${baitId}_simple`;
}

export const DEFAULT_BAIT_ID = "wormen";
