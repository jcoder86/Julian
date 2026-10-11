// How rare is what? For every bait and lure: the chance per bite of each
// species, and of the catches worth telling about.
//
//   node scripts/fish-odds.js
//
// Exact, not simulated: the numbers follow from speciesWeight, sizeWeights
// and lengthCm in src/data/fish.js. Run it after changing any of those.

import { FISH_SPECIES, FISH_SIZES } from '../src/data/fish.js';
import { BAITS } from '../src/data/baits.js';

const LONG_CM = 150;        // "a really big fish"
const GIANT_CM = 200;       // "call your friend"
const GIANTS = ['tuna', 'shark'];

/** Share of a size bucket's length range that is longer than `cm`. */
function shareLongerThan(range, cm) {
  const [lo, hi] = range;
  if (hi <= cm) return 0;
  if (lo > cm) return 1;
  return (hi - cm) / (hi - lo);
}

const oneIn = (p) => (p > 0 ? `1 in ${Math.round(1 / p)}` : 'never');

for (const bait of BAITS) {
  const takers = FISH_SPECIES.filter((s) => s.baits.includes(bait.id));
  const total = takers.reduce((sum, s) => sum + s.speciesWeight, 0);
  let long = 0;
  let giant = 0;
  const lines = [];
  for (const s of takers) {
    const p = s.speciesWeight / total;
    const sizes = s.sizeWeights.reduce((a, b) => a + b, 0);
    FISH_SIZES.forEach((size, i) => {
      const pSize = p * s.sizeWeights[i] / sizes;
      long += pSize * shareLongerThan(s.lengthCm[size], LONG_CM);
      if (GIANTS.includes(s.id)) giant += pSize * shareLongerThan(s.lengthCm[size], GIANT_CM);
    });
    lines.push(`${s.nlName} ${(p * 100).toFixed(p < 0.1 ? 1 : 0)}%`);
  }
  console.log(`${bait.nlName} (${bait.map}):  ${lines.join(', ')}`);
  console.log(`    longer than ${LONG_CM} cm: ${oneIn(long)}` +
              (giant > 0 ? `    a tuna or shark over ${GIANT_CM} cm: ${oneIn(giant)}` : ''));
}
