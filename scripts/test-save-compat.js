// Guard against losing players' catches in an update.
//
// Catches are stored only in the player's browser (localStorage). A new
// version of the game runs on top of whatever an older version wrote, so an
// innocent-looking change -- a renamed key, a renamed species id, a clean-up
// at start-up -- can silently empty Julian's collection.
//
// This script takes a save exactly as the RELEASED game writes it, lets the
// current code load it, play on it and add to it, and checks that every
// catch is still there and still shown. `npm run build` runs it first: if it
// fails, nothing gets built and nothing gets deployed.
//
//   node scripts/test-save-compat.js

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

// ---------------------------------------------------------------------------
// The released save format. FROZEN: this describes what is already on
// players' devices. Never edit it to make a failing test pass -- only ever
// add a new fixture next to it when a later release adds keys.
// ---------------------------------------------------------------------------

const RELEASED_LAKE_SPECIES = [
  'roach', 'rudd', 'bream', 'tench', 'carp', 'perch', 'bass', 'pike',
  'zander', 'chub', 'trout', 'catfish',
];
const RELEASED_BAITS  = ['brood', 'mais', 'maden', 'wormen', 'vis'];
const RELEASED_FLOATS = ['float_01', 'float_02', 'float_03', 'float_04', 'float_05'];

const JULIAN = {
  fishCounts: { roach: 14, rudd: 9, bream: 6, tench: 2, carp: 2, perch: 4, bass: 1,
                pike: 3, zander: 1, chub: 3, trout: 1, catfish: 1 },
  catchCountsBySize: {
    roach: { small: 10, medium: 3, large: 1 }, rudd: { small: 7, medium: 2 },
    bream: { small: 3, medium: 2, large: 1 }, tench: { small: 2 },
    carp: { medium: 1, large: 1 }, perch: { small: 3, medium: 1 }, bass: { small: 1 },
    pike: { small: 1, medium: 1, large: 1 }, zander: { medium: 1 },
    chub: { small: 2, medium: 1 }, trout: { large: 1 }, catfish: { medium: 1 },
  },
  bestCatches: {
    roach: { small: 10, medium: 24, large: 41 }, rudd: { small: 12, medium: 22 },
    bream: { small: 15, medium: 44, large: 78 }, tench: { small: 14 },
    carp: { medium: 66, large: 118 }, perch: { small: 9, medium: 27 }, bass: { small: 11 },
    pike: { small: 28, medium: 77, large: 124 }, zander: { medium: 58 },
    chub: { small: 13, medium: 36 }, trout: { large: 57 }, catfish: { medium: 112 },
  },
  lastCatch: { species: 'pike', size: 'large', lengthCm: 124 },
  selectedBait: 'vis',
  selectedFloat: 'float_03',
};

const GUEST = {
  fishCounts: { roach: 2, perch: 1 },
  catchCountsBySize: { roach: { small: 2 }, perch: { medium: 1 } },
  bestCatches: { roach: { small: 9 }, perch: { medium: 21 } },
  lastCatch: { species: 'perch', size: 'medium', lengthCm: 21 },
  selectedBait: 'maden',
};

/** A device's localStorage as the released game left it. */
function releasedStorage({ wipeAlreadyRan }) {
  const store = new Map();
  for (const [key, value] of Object.entries(JULIAN)) {
    store.set(`julians_game_${key}`, JSON.stringify(value));
  }
  for (const [key, value] of Object.entries(GUEST)) {
    store.set(`julians_game_guest_${key}`, JSON.stringify(value));
  }
  // The released game carried a one-off "keep only pike" wipe that marks a
  // device once it has run. Both kinds of device are out there.
  if (wipeAlreadyRan) store.set('julians_game_migration_keep_only_pike_v1', 'done');
  // Something another app on the same origin might have stored.
  store.set('some_other_app_setting', 'untouched');
  return store;
}

// ---------------------------------------------------------------------------

let failures = 0;
function check(condition, message) {
  if (condition) return;
  failures++;
  console.error(`  FAIL: ${message}`);
}
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

async function runScenario(label, options) {
  console.log(`- ${label}`);
  const store = releasedStorage(options);
  const before = new Map(store);
  let removals = 0;
  globalThis.window = {
    localStorage: {
      getItem: (k) => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => { store.set(k, String(v)); },
      removeItem: (k) => { removals++; store.delete(k); },
      clear: () => { removals++; store.clear(); },
    },
  };

  // A fresh copy of the module per scenario (it keeps the active profile).
  const { SaveSystem } = await import(`../src/systems/SaveSystem.js?scenario=${encodeURIComponent(label)}`);
  const { FISH_BY_ID, speciesForMap } = await import('../src/data/fish.js');
  const { BAITS_BY_ID } = await import('../src/data/baits.js');
  const { FLOATS_BY_ID } = await import('../src/data/floats.js');

  // --- 1. Start the game as Julian, the way START does -------------------
  SaveSystem.setProfile('julian');
  check(same(SaveSystem.getFishCounts(), JULIAN.fishCounts), 'fishCounts changed on load');
  check(same(SaveSystem.getCatchCountsBySize(), JULIAN.catchCountsBySize), 'catchCountsBySize changed on load');
  check(same(SaveSystem.getBestCatches(), JULIAN.bestCatches), 'bestCatches changed on load');
  check(same(SaveSystem.getLastCatch(), JULIAN.lastCatch), 'lastCatch changed on load');
  check(SaveSystem.getSelectedBait('lake') === JULIAN.selectedBait, 'the lake no longer finds the saved bait');
  check(SaveSystem.getSelectedBait() === JULIAN.selectedBait, 'getSelectedBait() without a map must still mean the lake');
  check(SaveSystem.getSelectedFloat() === JULIAN.selectedFloat, 'saved float not found');
  for (const [key, value] of before) {
    check(store.get(key) === value, `loading the save rewrote "${key}"`);
  }

  // --- 2. Everything saved is still a known id, shown on the lake page ---
  const lakePage = speciesForMap('lake').map((s) => s.id);
  for (const id of RELEASED_LAKE_SPECIES) {
    check(!!FISH_BY_ID[id], `species "${id}" no longer exists: its catches would vanish`);
    check(lakePage.includes(id), `species "${id}" is no longer on the lake's collection page`);
  }
  for (const id of RELEASED_BAITS) {
    check(BAITS_BY_ID[id]?.map === 'lake', `bait "${id}" is no longer a lake bait`);
  }
  for (const id of RELEASED_FLOATS) {
    check(!!FLOATS_BY_ID[id], `float "${id}" no longer exists`);
  }

  // --- 3. Play the new content: it may only ADD ---------------------------
  SaveSystem.setCurrentMap('sea');
  SaveSystem.setSelectedBait('pilker', 'sea');
  SaveSystem.recordCatch({ species: 'shark', size: 'small', lengthCm: 95 });
  SaveSystem.recordCatch({ species: 'mackerel', size: 'medium', lengthCm: 31 });
  SaveSystem.setCurrentMap('lake');
  SaveSystem.recordCatch({ species: 'pike', size: 'medium', lengthCm: 60 });   // smaller than his best

  const counts = SaveSystem.getFishCounts();
  const best = SaveSystem.getBestCatches();
  const bySize = SaveSystem.getCatchCountsBySize();
  for (const id of RELEASED_LAKE_SPECIES) {
    const expected = JULIAN.fishCounts[id] + (id === 'pike' ? 1 : 0);
    check(counts[id] === expected, `count for "${id}" is ${counts[id]}, expected ${expected}`);
    check(same(best[id], JULIAN.bestCatches[id]), `best catches for "${id}" changed`);
    if (id !== 'pike') check(same(bySize[id], JULIAN.catchCountsBySize[id]), `size counts for "${id}" changed`);
  }
  check(counts.shark === 1 && best.shark?.small === 95, 'a sea catch was not recorded');
  check(SaveSystem.getSelectedBait('lake') === JULIAN.selectedBait, 'choosing a sea lure changed the lake bait');
  check(SaveSystem.getSelectedBait('sea') === 'pilker', 'the sea lure was not remembered');

  // --- 4. Guests stay separate, in both directions -----------------------
  SaveSystem.setProfile('guest');
  check(same(SaveSystem.getFishCounts(), GUEST.fishCounts), 'guest fishCounts changed');
  check(SaveSystem.getSelectedBait('lake') === GUEST.selectedBait, 'guest bait not found');
  SaveSystem.recordCatch({ species: 'herring', size: 'small', lengthCm: 14 });
  SaveSystem.setProfile('julian');
  check(SaveSystem.getFishCounts().herring === undefined, "a guest's catch ended up in Julian's collection");
  check(SaveSystem.getFishCounts().roach === JULIAN.fishCounts.roach, "a guest's play changed Julian's catches");

  // --- 5. Nothing was ever deleted ----------------------------------------
  check(removals === 0, `the save system deleted from storage ${removals} time(s)`);
  for (const key of before.keys()) {
    check(store.has(key), `key "${key}" disappeared`);
  }
  check(store.get('some_other_app_setting') === 'untouched', "another app's data was touched");
}

// ---------------------------------------------------------------------------
// The same promise, without trusting the hand-written save above: here the
// save is WRITTEN BY the released game's own code.
//
// scripts/fixtures/SaveSystem.released.js is an untouched copy of the save
// code of the version that was live before the sea map (commit bd22811,
// 2026-10-09). It plays a session for each of the two profiles the title
// screen offers -- START (Julian) and "start as guest" -- and the current
// code must then show exactly what that version itself would have shown.
// ---------------------------------------------------------------------------

const snapshot = (save) => ({
  fishCounts: save.getFishCounts(),
  catchCountsBySize: save.getCatchCountsBySize(),
  bestCatches: save.getBestCatches(),
  lastCatch: save.getLastCatch(),
  selectedBait: save.getSelectedBait(),
  selectedFloat: save.getSelectedFloat(),
});

async function runReleasedWriterScenario() {
  console.log('- a save written by the released game itself, for Julian and for the guest profile');
  const store = new Map();
  let removals = 0;
  globalThis.window = {
    localStorage: {
      getItem: (k) => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => { store.set(k, String(v)); },
      removeItem: (k) => { removals++; store.delete(k); },
      clear: () => { removals++; store.clear(); },
    },
  };
  const { SaveSystem: Released } = await import('./fixtures/SaveSystem.released.js');
  const sizes = ['small', 'medium', 'large'];

  // Julian: every lake species, several of each, in all sizes.
  Released.setProfile('julian');
  RELEASED_LAKE_SPECIES.forEach((species, i) => {
    for (let n = 0; n <= i % 4; n++) {
      Released.recordCatch({ species, size: sizes[(i + n) % 3], lengthCm: 10 + 7 * i + 3 * n });
    }
  });
  Released.setSelectedBait('vis');
  Released.setSelectedFloat('float_03');
  const julianBefore = snapshot(Released);

  // The guest profile: a smaller collection of its own.
  Released.setProfile('guest');
  for (const [species, size, lengthCm] of [
    ['roach', 'small', 11], ['roach', 'medium', 23], ['perch', 'small', 9],
    ['bream', 'large', 71], ['pike', 'medium', 64], ['catfish', 'small', 44],
  ]) {
    Released.recordCatch({ species, size, lengthCm });
  }
  Released.setSelectedBait('maden');
  Released.setSelectedFloat('float_05');
  const guestBefore = snapshot(Released);

  check(Object.keys(julianBefore.fishCounts).length === RELEASED_LAKE_SPECIES.length,
        'test set-up: the released code did not store all lake species for Julian');
  check(Object.keys(guestBefore.fishCounts).length === 5,
        'test set-up: the released code did not store the guest catches');

  const written = new Map(store);
  removals = 0;

  // --- the update arrives: the current code runs on that device -----------
  const { SaveSystem } = await import('../src/systems/SaveSystem.js?scenario=released-writer');
  const { speciesForMap } = await import('../src/data/fish.js');
  const lakePage = speciesForMap('lake').map((s) => s.id);

  for (const [profile, before] of [['julian', julianBefore], ['guest', guestBefore]]) {
    SaveSystem.setProfile(profile);
    const now = snapshot(SaveSystem);
    for (const part of Object.keys(before)) {
      check(same(now[part], before[part]), `${profile}: ${part} differs from what the released game stored`);
    }
    for (const species of Object.keys(before.fishCounts)) {
      check(lakePage.includes(species), `${profile}: "${species}" is not on the first map's collection page`);
    }
  }
  for (const [key, value] of written) {
    check(store.get(key) === value, `the update changed "${key}"`);
  }
  check(removals === 0, `the update deleted from storage ${removals} time(s)`);

  // Playing on does not mix the two up.
  SaveSystem.setProfile('guest');
  SaveSystem.recordCatch({ species: 'shark', size: 'small', lengthCm: 90 });
  check(SaveSystem.getFishCounts().roach === guestBefore.fishCounts.roach, "guest: an old count changed after a new catch");
  SaveSystem.setProfile('julian');
  check(same(snapshot(SaveSystem), julianBefore), "Julian's save changed when the guest caught a fish");
}

await runScenario('device where the old pike-only wipe already ran', { wipeAlreadyRan: true });
await runScenario('device where that wipe never ran', { wipeAlreadyRan: false });
await runReleasedWriterScenario();

// The code itself must not contain a way to delete.
const source = readFileSync(join(ROOT, 'src/systems/SaveSystem.js'), 'utf8');
check(!/\.removeItem\s*\(|localStorage\.clear\s*\(/.test(source),
      'SaveSystem.js contains a removeItem / clear call');

if (failures) {
  console.error(`\nsave compatibility: ${failures} check(s) FAILED -- this build would lose player data.`);
  process.exit(1);
}
console.log('save compatibility: OK -- existing catches survive this version.');
