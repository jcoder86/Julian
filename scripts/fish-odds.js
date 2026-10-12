// How rare is what? For every map and every bait or lure fished there: the
// chance per hooked fish of each species, and of a catch close to the
// record of its own kind.
//
//   node scripts/fish-odds.js
//
// "Close to the record" is what makes a catch special, not its length in
// centimetres: a 58 cm perch (record 60) is rarer than a 140 cm catfish
// (record 270). Exact, not simulated: the numbers follow from speciesWeight
// (and weightOn), sizeWeights, lengthCm and RECORD_SKEW in src/data/fish.js.
// Run it after changing any of those.

import {
  FISH_SIZES, MAP_SPECIES, RECORD_SKEW, recordCm, speciesForMap, speciesWeightOn,
} from '../src/data/fish.js';
import { baitsForMap } from '../src/data/baits.js';

// A catch counts as "big" from this share of the species' record, and as
// "a record fish" from that one.
const BIG = 0.9;
const RECORD = 0.97;

/** Chance that a fish of this size bucket is at least `cm` long. */
function shareAtLeast(species, size, cm) {
  const [lo, hi] = species.lengthCm[size];
  if (cm <= lo) return 1;
  if (cm > hi) return 0;
  const place = (cm - lo) / (hi - lo);
  return 1 - (size === 'large' ? place ** (1 / RECORD_SKEW) : place);
}

/** Chance that a hooked fish of this species is at least `share` of its record. */
function chanceNearRecord(species, share) {
  const cm = recordCm(species) * share;
  const sizes = species.sizeWeights.reduce((a, b) => a + b, 0);
  return FISH_SIZES.reduce(
    (sum, size, i) => sum + species.sizeWeights[i] / sizes * shareAtLeast(species, size, cm), 0);
}

const oneIn = (p) => (p > 0 ? `1 in ${Math.round(1 / p)}` : 'never');
const pct = (p) => `${(p * 100).toFixed(p < 0.1 ? 1 : 0)}%`;

for (const mapId of Object.keys(MAP_SPECIES)) {
  console.log(`\n=== ${mapId} ===`);
  console.log('record lengths: ' + speciesForMap(mapId)
    .map((s) => `${s.nlName} ${recordCm(s)} cm`).join(', '));
  for (const bait of baitsForMap(mapId)) {
    const takers = speciesForMap(mapId).filter((s) => s.baits.includes(bait.id));
    const total = takers.reduce((sum, s) => sum + speciesWeightOn(s, mapId), 0);
    let big = 0;
    let record = 0;
    const lines = [];
    for (const s of takers) {
      const p = speciesWeightOn(s, mapId) / total;
      big += p * chanceNearRecord(s, BIG);
      record += p * chanceNearRecord(s, RECORD);
      lines.push(`${s.nlName} ${pct(p)}`);
    }
    console.log(`${bait.nlName}${bait.kind === 'lure' ? ' (lure)' : ''}:  ${lines.join(', ')}`);
    console.log(`    any fish within 10% of its record: ${oneIn(big)}    within 3%: ${oneIn(record)}`);
  }
  console.log('per species, once it is hooked -- within 10% of its record / within 3%:');
  for (const s of speciesForMap(mapId)) {
    console.log(`    ${s.nlName.padEnd(16)} ${oneIn(chanceNearRecord(s, BIG)).padEnd(10)} ${oneIn(chanceNearRecord(s, RECORD))}`);
  }
}
