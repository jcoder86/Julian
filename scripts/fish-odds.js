// How rare is what? For every map and every bait or lure fished there: the
// chance per hooked fish of each species, of a catch close to the record of
// its own kind, and of a GIANT (within 5 % of that record: the catch that
// glitters and is called out -- isGiant in src/data/fish.js).
//
//   node scripts/fish-odds.js            everything, per map and bait
//   node scripts/fish-odds.js --tabel    one line per fish, in Dutch, as a
//                                        Markdown table: its best bait, the
//                                        chance per bite, how many of them
//                                        are large and how many are giants
//
// "Close to the record" is what makes a catch special, not its length in
// centimetres: a 58 cm perch (record 60) is rarer than a 140 cm catfish
// (record 270). Exact, not simulated, and counted the way the game rolls:
// lengths in whole centimetres. The numbers follow from speciesWeight (and
// weightOn), sizeWeights, lengthCm, RECORD_SKEW and the old ones
// (OLDEST_YEARS, OLD_ONE_PER_YEAR, OLD_ONE_SKEW) in src/data/fish.js, and
// from what a lure cannot hook (smallestCatchOn in src/data/baits.js: no
// small fish, nothing under 20 cm). Run it after changing any of those.

import {
  GIANT_SHARE, MAP_SPECIES, OLD_ONE_SKEW, RECORD_SKEW, catchableSizes, giantFromCm, oldOneChance,
  oldOneRange, recordCm, speciesForMap, speciesWeightOn,
} from '../src/data/fish.js';
import { baitsForMap, smallestCatchOn } from '../src/data/baits.js';
import { getMap } from '../src/data/maps.js';

// A catch counts as "big" from this share of the species' record, and as a
// giant from the game's own share.
const BIG = 0.9;
const giantPct = `${Math.round((1 - GIANT_SHARE) * 100)}%`;

/**
 * What becomes of a hooked fish of this species, on a bait that hooks
 * nothing smaller than `smallest`: the chance that it is a large one, and
 * the chance that it is at least `cm` long.
 */
function chances(species, cm, smallest = null) {
  const from = Math.ceil(cm);                      // lengths are whole cm
  const sizes = catchableSizes(species, smallest);
  const total = sizes.reduce((sum, s) => sum + s.weight, 0);

  // The ordinary roll: a size, then a length in its range, rounded.
  let large = 0;
  let long = 0;
  for (const { size, weight, range: [lo, hi] } of sizes) {
    const share = weight / total;
    if (size === 'large') large += share;
    // Math.round(lo + place * (hi - lo)) >= from  <=>  place >= q
    const q = hi === lo ? (lo >= from ? 0 : 2) : (from - 0.5 - lo) / (hi - lo);
    long += share * (q <= 0 ? 1 : q > 1 ? 0 : 1 - (size === 'large' ? q ** (1 / RECORD_SKEW) : q));
  }

  // One of the old ones: always large, its length from the top band.
  const old = sizes.some((s) => s.size === 'large') ? oldOneChance(species) : 0;
  const [oldFrom, oldTo] = oldOneRange(species);
  const steps = oldTo - oldFrom + 1;
  const need = from - oldFrom;                     // floor(place * steps) >= need
  const oldLong = need <= 0 ? 1 : need >= steps ? 0 : 1 - (need / steps) ** (1 / OLD_ONE_SKEW);

  return { large: old + (1 - old) * large, long: old * oldLong + (1 - old) * long };
}

/** For every bait of a map: who takes it, and how often. */
function baitsOf(mapId) {
  return baitsForMap(mapId).map((bait) => {
    const smallest = smallestCatchOn(bait.id);
    const takers = speciesForMap(mapId)
      .filter((s) => s.baits.includes(bait.id) && catchableSizes(s, smallest).length > 0);
    const total = takers.reduce((sum, s) => sum + speciesWeightOn(s, mapId), 0);
    return {
      bait,
      smallest,
      takers: takers.map((species) => ({ species, share: speciesWeightOn(species, mapId) / total })),
    };
  });
}

const oneIn = (p) => (p > 0 ? `1 in ${Math.round(1 / p)}` : 'never');
const pct = (p) => `${(p * 100).toFixed(p < 0.1 ? 1 : 0)}%`;

function printEverything() {
  for (const mapId of Object.keys(MAP_SPECIES)) {
    console.log(`\n=== ${mapId} ===`);
    console.log('record lengths: ' + speciesForMap(mapId)
      .map((s) => `${s.nlName} ${recordCm(s)} cm`).join(', '));
    for (const { bait, smallest, takers } of baitsOf(mapId)) {
      let big = 0;
      let giant = 0;
      let large = 0;
      for (const { species, share } of takers) {
        big += share * chances(species, recordCm(species) * BIG, smallest).long;
        const top = chances(species, giantFromCm(species), smallest);
        giant += share * top.long;
        large += share * top.large;
      }
      const limit = smallest ? ` (lure: no small fish, nothing under ${smallest.cm} cm)` : '';
      console.log(`${bait.nlName}${limit}:  ${takers.map((t) => `${t.species.nlName} ${pct(t.share)}`).join(', ')}`);
      console.log(`    a large one: ${pct(large)}    any fish within 10% of its record: ${oneIn(big)}    a giant (within ${giantPct}): ${oneIn(giant)}`);
    }
    console.log(`per species, once it is hooked -- an old one / within 10% of its record / a giant (within ${giantPct}):`);
    for (const s of speciesForMap(mapId)) {
      console.log(`    ${s.nlName.padEnd(16)} ${oneIn(oldOneChance(s)).padEnd(10)} ${oneIn(chances(s, recordCm(s) * BIG).long).padEnd(10)} ${oneIn(chances(s, giantFromCm(s)).long)}`);
    }
  }
}

function printTable() {
  const nl = (p) => (p * 100 >= 10 ? (p * 100).toFixed(0) : (p * 100).toFixed(1)).replace('.', ',') + '%';
  const eenOp = (p) => (p > 0 ? `1 op ${Math.round(1 / p).toLocaleString('nl-NL')}` : 'nooit');
  for (const mapId of Object.keys(MAP_SPECIES)) {
    console.log(`\n### ${getMap(mapId).nlName}\n`);
    console.log('| Vis | Beste aas | Kans per beet | Daarvan groot | Daarvan gigantisch | Gigantisch per beet |');
    console.log('|---|---|---|---|---|---|');
    const baits = baitsOf(mapId);
    for (const species of speciesForMap(mapId)) {
      // The bait on which this species bites most often.
      const best = baits
        .map((b) => ({ ...b, share: b.takers.find((t) => t.species === species)?.share || 0 }))
        .reduce((a, b) => (b.share > a.share ? b : a));
      const { large, long } = chances(species, giantFromCm(species), best.smallest);
      console.log(`| ${species.nlName} | ${best.bait.nlName} | ${nl(best.share)} | ${nl(large)} | ` +
        `${eenOp(long)} (vanaf ${oldOneRange(species)[0]} cm) | ${eenOp(best.share * long)} |`);
    }
  }
}

if (process.argv.includes('--tabel')) printTable();
else printEverything();
