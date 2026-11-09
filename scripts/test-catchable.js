// Can everything be caught? For every map: every fish on its page, in every
// size (the three places on its card), must take at least one bait or lure
// that is fished there -- and every bait in that map's menu must catch
// something. Uses the game's own rules (data/fish.js, data/baits.js): a
// lure never hooks the small ones (smallestCatchOn).
//
//   node scripts/test-catchable.js
//
// Exits with 1 (and says what) when something cannot be caught.

import { MAPS } from '../src/data/maps.js';
import { FISH_SIZES, speciesForMap, speciesWeightOn, catchableSizes } from '../src/data/fish.js';
import { baitsForMap, smallestCatchOn } from '../src/data/baits.js';

let problems = 0;
const fail = (msg) => { problems++; console.log(`  FAIL: ${msg}`); };

for (const map of MAPS) {
  const baits = baitsForMap(map.id);
  const fish = speciesForMap(map.id);
  console.log(`${map.id}: ${fish.length} fish, ${baits.length} baits (${baits.map((b) => b.id).join(', ')})`);
  for (const species of fish) {
    if (!(speciesWeightOn(species, map.id) > 0)) fail(`${species.id} never bites on ${map.id} (weight 0)`);
    const takes = baits.filter((b) => species.baits.includes(b.id));
    if (!takes.length) {
      fail(`${species.id} (${species.nlName}) takes none of the baits on ${map.id}`);
      continue;
    }
    for (const size of FISH_SIZES) {
      const by = takes.filter((b) => catchableSizes(species, smallestCatchOn(b.id)).some((s) => s.size === size));
      if (!by.length) {
        fail(`a ${size} ${species.id} (${species.nlName}) cannot be caught on ${map.id}: only on ${takes.map((b) => b.id).join(', ')}`);
      }
    }
  }
  for (const bait of baits) {
    if (!fish.some((s) => s.baits.includes(bait.id) && catchableSizes(s, smallestCatchOn(bait.id)).length)) {
      fail(`${bait.id} catches nothing on ${map.id}`);
    }
  }
}
// Is the map's own first bait one of its baits?
for (const map of MAPS) {
  if (map.defaultBait && !baitsForMap(map.id).some((b) => b.id === map.defaultBait)) {
    fail(`${map.id}'s default bait ${map.defaultBait} is not fished there`);
  }
}

if (problems) {
  console.log(`\ncatchable: ${problems} problem(s).`);
  process.exit(1);
}
console.log('\ncatchable: OK -- every fish, in every size, can be caught where it lives.');
