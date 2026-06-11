// Float (bobber) definitions. Each float has a "full" sprite used in the
// selection menu and a "tip" sprite used in-game as the above-water bobber.
// Texture keys match scripts/split_atlas.py output:
// clean/float_<N>_full.png and clean/float_<N>_tip.png.

export const FLOATS = [
  { id: "float_01", displayName: "Slim" },
  { id: "float_02", displayName: "Bal" },
  { id: "float_03", displayName: "Druppel" },
  { id: "float_04", displayName: "Hout" },
  { id: "float_05", displayName: "Pen" },
];

export const FLOATS_BY_ID = Object.fromEntries(FLOATS.map(f => [f.id, f]));

export function floatFullTextureKey(floatId) {
  return `${floatId}_full`;
}

export function floatTipTextureKey(floatId) {
  return `${floatId}_tip`;
}

export const DEFAULT_FLOAT_ID = "float_01";
