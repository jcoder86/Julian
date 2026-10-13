// How rare is what? For every map and every bait or lure fished there: the
// chance per hooked fish of each species, of a catch close to the record of
// its own kind, and of a GIANT (within 5 % of that record: the catch that
// glitters and is called out -- isGiant in src/data/fish.js).
//
//   node scripts/fish-odds.js
//
// "Close to the record" is what makes a catch special, not its length in
// centimetres: a 58 cm perch (record 60) is rarer than a 140 cm catfish
// (record 270). Exact, not simulated: the numbers follow from speciesWeight
// (and weightOn), sizeWeights, lengthCm and RECORD_SKEW in src/data/fish.js,
// and from what a lure cannot hook (smallestCatchOn in src/data/baits.js: no
// small fish, nothing under 20 cm). Run it after changing any of those.

import {
  GIANT_SHARE, MAP_SPECIES, RECORD_SKEW, catchableSizes, recordCm, speciesForMap, speciesWeightOn,
} from '../src/data/fish.js';
import { baitsForMap, smallestCatchOn } from '../src/data/baits.js';

// A catch counts as "big" from this share of the species' record, and as a
// giant from the game's own share.
const BIG = 0.9;
const RECORD = GIANT_SHARE;
const giantPct = `${Math.round((1 - GIANT_SHARE) * 100)}%`;

/** Chance that a fish of this size, somewhere in this range of lengths, is at least `cm` long. */
function shareAtLeast({ size, range: [lo, hi] }, cm) {
  if (cm <= lo) return 1;
  if (cm > hi) return 0;
  const place = (cm - lo) / (hi - lo);
  return 1 - (size === 'large' ? place ** (1 / RECORD_SKEW) : place);
}

/**
 * Chance that a hooked fish of this species is at least `share` of its
 * record -- on a bait that hooks nothing smaller than `smallest`.
 */
function chanceNearRecord(species, share, smallest = null) {
  const cm = recordCm(species) * share;
  const sizes = catchableSizes(species, smallest);
  const total = sizes.reduce((sum, s) => sum + s.weight, 0);
  return sizes.reduce((sum, s) => sum + s.weight / total * shareAtLeast(s, cm), 0);
}

const oneIn = (p) => (p > 0 ? `1 in ${Math.round(1 / p)}` : 'never');
const pct = (p) => `${(p * 100).toFixed(p < 0.1 ? 1 : 0)}%`;

for (const mapId of Object.keys(MAP_SPECIES)) {
  console.log(`\n=== ${mapId} ===`);
  console.log('record lengths: ' + speciesForMap(mapId)
    .map((s) => `${s.nlName} ${recordCm(s)} cm`).join(', '));
  for (const bait of baitsForMap(mapId)) {
    const smallest = smallestCatchOn(bait.id);
    const takers = speciesForMap(mapId)
      .filter((s) => s.baits.includes(bait.id) && catchableSizes(s, smallest).length > 0);
    const total = takers.reduce((sum, s) => sum + speciesWeightOn(s, mapId), 0);
    let big = 0;
    let record = 0;
    let large = 0;
    const lines = [];
    for (const s of takers) {
      const p = speciesWeightOn(s, mapId) / total;
      const sizes = catchableSizes(s, smallest);
      big += p * chanceNearRecord(s, BIG, smallest);
      record += p * chanceNearRecord(s, RECORD, smallest);
      large += p * (sizes.find((size) => size.size === 'large')?.weight || 0)
        / sizes.reduce((sum, size) => sum + size.weight, 0);
      lines.push(`${s.nlName} ${pct(p)}`);
    }
    const limit = smallest ? ` (lure: no small fish, nothing under ${smallest.cm} cm)` : '';
    console.log(`${bait.nlName}${limit}:  ${lines.join(', ')}`);
    console.log(`    a large one: ${pct(large)}    any fish within 10% of its record: ${oneIn(big)}    a giant (within ${giantPct}): ${oneIn(record)}`);
  }
  console.log(`per species, once it is hooked -- within 10% of its record / a giant (within ${giantPct}):`);
  for (const s of speciesForMap(mapId)) {
    console.log(`    ${s.nlName.padEnd(16)} ${oneIn(chanceNearRecord(s, BIG)).padEnd(10)} ${oneIn(chanceNearRecord(s, RECORD))}`);
  }
}
