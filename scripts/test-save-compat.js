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

// The day James's collection was asked for; the sea book of James & Boaz is
// emptied (once) on devices that start this version within days of it.
const REQUEST_DAY = Date.UTC(2026, 9, 11, 18, 0, 0);

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
  // (Start-up first offers James & Boaz James's collection. This guest
  // profile has lake fish of its own, so nothing may come of it.)
  SaveSystem.adoptJamesCatches(REQUEST_DAY);
  check(SaveSystem.getProfile() === 'julian', 'start-up left another profile active');
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
  check(same(JSON.parse(store.get('julians_game_guest_jamesCatchesAdopted') || 'null')?.loaded, false),
        "James's collection was loaded over a guest profile that has lake fish of its own");
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
  SaveSystem.adoptJamesCatches(REQUEST_DAY);   // start-up; this guest has lake fish

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

// ---------------------------------------------------------------------------
// James's collection for James & Boaz (SaveSystem.adoptJamesCatches).
//
// The one place where the game writes into a save by itself, and -- for a
// few days -- takes something out of one. Every fence around it is checked
// here; see the comment in SaveSystem.js for why each one is there.
// ---------------------------------------------------------------------------

function fakeStorage(store, counters) {
  globalThis.window = {
    localStorage: {
      getItem: (k) => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => { store.set(k, String(v)); },
      removeItem: (k) => { counters.removals++; store.delete(k); },
      clear: () => { counters.removals++; store.clear(); },
    },
  };
}

const GUEST_PREFIX = 'julians_game_guest_';
const notGuest = (store) => [...store].filter(([key]) => !key.startsWith(GUEST_PREFIX));

async function runJamesScenarios() {
  const { JAMES_CATCHES } = await import('../src/data/jamesCatches.js');
  const { speciesForMap } = await import('../src/data/fish.js');
  const lake = speciesForMap('lake').map((s) => s.id);
  const sea = speciesForMap('sea').map((s) => s.id);
  let scenario = 0;
  const fresh = async () =>
    (await import(`../src/systems/SaveSystem.js?scenario=james-${scenario++}`)).SaveSystem;

  console.log("- James's collection itself");
  let total = 0;
  for (const [id, count] of Object.entries(JAMES_CATCHES.fishCounts)) {
    total += count;
    check(lake.includes(id), `James's collection holds "${id}", which is not a fish of the first map`);
    const bySize = JAMES_CATCHES.catchCountsBySize[id] || {};
    check(Object.values(bySize).reduce((a, b) => a + b, 0) === count, `James: sizes of "${id}" do not add up to ${count}`);
    check(same(Object.keys(bySize), Object.keys(JAMES_CATCHES.bestCatches[id] || {})),
          `James: "${id}" has a best catch for a size he never caught, or the other way round`);
  }
  check(total === 176, `James's collection is ${total} fish, the photo shows 176`);

  // --- the device the request came from ------------------------------------
  console.log('- James & Boaz with an empty lake book and a stray sea fish: lake filled, sea emptied');
  {
    const store = releasedStorage({ wipeAlreadyRan: true });
    for (const key of [...store.keys()]) if (key.startsWith(GUEST_PREFIX)) store.delete(key);
    const counters = { removals: 0 };
    fakeStorage(store, counters);
    const SaveSystem = await fresh();

    SaveSystem.setProfile('guest');
    SaveSystem.setCurrentMap('sea');
    SaveSystem.setSelectedBait('veren', 'sea');
    SaveSystem.recordCatch({ species: 'herring', size: 'small', lengthCm: 14 });
    SaveSystem.setProfile('julian');
    SaveSystem.recordCatch({ species: 'mackerel', size: 'medium', lengthCm: 33 });   // Julian's own sea fish
    const othersBefore = notGuest(store);

    SaveSystem.adoptJamesCatches(REQUEST_DAY);
    check(SaveSystem.getProfile() === 'julian', 'adopting left the guest profile active');
    check(same(notGuest(store), othersBefore), "Julian's save (or another app's data) was touched");

    SaveSystem.setProfile('guest');
    check(same(SaveSystem.getFishCounts(), JAMES_CATCHES.fishCounts), "James & Boaz did not get exactly James's counts");
    check(same(SaveSystem.getCatchCountsBySize(), JAMES_CATCHES.catchCountsBySize), "James & Boaz did not get exactly James's size counts");
    check(same(SaveSystem.getBestCatches(), JAMES_CATCHES.bestCatches), "James & Boaz did not get exactly James's best catches");
    check(same(SaveSystem.getLastCatch(), JAMES_CATCHES.lastCatch), 'the last catch still points at a fish that is gone');
    check(sea.every((id) => !(id in SaveSystem.getFishCounts())), 'a sea fish is still in the book of James & Boaz');
    check(SaveSystem.getSelectedBait('sea') === 'veren' && SaveSystem.getCurrentMap() === 'sea',
          'their chosen lure or map was changed');
    const note = SaveSystem.load('jamesCatchesAdopted');
    check(note?.loaded === true, 'the note does not say the collection was loaded');
    check(note?.removedSea?.fishCounts?.herring === 1 && note?.removedSea?.bestCatches?.herring?.small === 14
          && note?.removedSea?.lastCatch?.species === 'herring',
          'the sea fish that was taken out was not kept in the note');

    // Once means once: starting again changes nothing, and what they catch
    // at sea from now on stays.
    const afterFirst = new Map(store);
    SaveSystem.adoptJamesCatches(REQUEST_DAY + 60_000);
    check(same([...store], [...afterFirst]), 'a second start changed the save again');
    SaveSystem.recordCatch({ species: 'shark', size: 'small', lengthCm: 101 });
    SaveSystem.recordCatch({ species: 'pike', size: 'small', lengthCm: 27 });
    SaveSystem.adoptJamesCatches(REQUEST_DAY + 120_000);
    check(SaveSystem.getFishCounts().shark === 1, 'a sea fish caught after the change was taken away');
    check(SaveSystem.getFishCounts().pike === JAMES_CATCHES.fishCounts.pike + 1, 'a new lake catch was not added to James\'s count');
    check(counters.removals === 0, 'something was deleted from storage outright');
  }

  // --- the same device, but the update only arrives days later -------------
  console.log('- the same, first run after the cut-off date: lake filled, sea catches kept');
  {
    const store = new Map();
    const counters = { removals: 0 };
    fakeStorage(store, counters);
    const SaveSystem = await fresh();
    SaveSystem.setProfile('guest');
    SaveSystem.recordCatch({ species: 'cod', size: 'large', lengthCm: 104 });
    SaveSystem.setProfile('julian');

    SaveSystem.adoptJamesCatches(Date.UTC(2026, 9, 15, 0, 0, 1));
    SaveSystem.setProfile('guest');
    const counts = SaveSystem.getFishCounts();
    check(counts.cod === 1 && SaveSystem.getBestCatches().cod?.large === 104, 'a sea catch was taken away after the cut-off date');
    check(SaveSystem.getLastCatch()?.species === 'cod', 'the last catch was replaced although its fish is still there');
    check(lake.every((id) => counts[id] === JAMES_CATCHES.fishCounts[id]), "the lake book was not filled with James's fish");
    check(SaveSystem.load('jamesCatchesAdopted')?.removedSea === undefined, 'the note claims something was taken out');
  }

  // --- a brand-new device ----------------------------------------------------
  console.log('- a device that never ran the game: James & Boaz start with his collection, Julian with nothing');
  {
    const store = new Map([['some_other_app_setting', 'untouched']]);
    const counters = { removals: 0 };
    fakeStorage(store, counters);
    const SaveSystem = await fresh();
    SaveSystem.adoptJamesCatches(REQUEST_DAY);
    check(same(notGuest(store), [['some_other_app_setting', 'untouched']]), 'something was written outside the guest profile');
    SaveSystem.setProfile('guest');
    check(same(SaveSystem.getFishCounts(), JAMES_CATCHES.fishCounts), "a new device did not get James's collection");
    SaveSystem.setProfile('julian');
    check(same(SaveSystem.getFishCounts(), {}), 'Julian got fish he did not catch');
  }

  // --- a save that cannot be read is not an empty save ------------------------
  console.log('- a damaged or unreadable guest save: left alone');
  for (const [what, breakIt] of [
    ['damaged', (store) => store.set(`${GUEST_PREFIX}fishCounts`, '{"roach": 12, "pik')],
    ['unreadable', () => { globalThis.window.localStorage.getItem = () => { throw new Error('storage is off'); }; }],
  ]) {
    const store = new Map([[`${GUEST_PREFIX}bestCatches`, JSON.stringify({ roach: { small: 9 } })]]);
    const counters = { removals: 0 };
    fakeStorage(store, counters);
    breakIt(store);
    const before = new Map(store);
    const SaveSystem = await fresh();
    const warn = console.warn;
    console.warn = () => {};
    SaveSystem.adoptJamesCatches(REQUEST_DAY);
    console.warn = warn;
    check(same([...store], [...before]), `a ${what} guest save was written to`);
  }
}

// ---------------------------------------------------------------------------
// The visitor (the grey "Gast" button): plays like anyone else, but nothing
// of it reaches storage, and nobody else's save notices.
// ---------------------------------------------------------------------------

async function runVisitorScenario() {
  console.log('- a visitor fishes: nothing is stored, nobody else is touched');
  const store = releasedStorage({ wipeAlreadyRan: true });
  const counters = { removals: 0 };
  fakeStorage(store, counters);
  const { SaveSystem } = await import('../src/systems/SaveSystem.js?scenario=visitor');
  const { TEAMS } = await import('../src/data/teams.js');
  const visitor = TEAMS.find((team) => team.visitor);
  check(!!visitor, 'there is no visitor team any more');
  check(visitor && !['julian', 'guest'].includes(visitor.id), "the visitor plays on somebody's real save");
  if (!visitor) return;

  SaveSystem.adoptJamesCatches(REQUEST_DAY);          // start-up
  const before = new Map(store);

  SaveSystem.setProfile(visitor.id);
  check(same(SaveSystem.getFishCounts(), {}), 'a visitor does not start with an empty book');
  SaveSystem.setCurrentMap('sea');
  SaveSystem.setSelectedBait('pilker', 'sea');
  SaveSystem.setSelectedFloat('float_02');
  SaveSystem.recordCatch({ species: 'shark', size: 'large', lengthCm: 301 });
  SaveSystem.recordCatch({ species: 'pike', size: 'small', lengthCm: 26 });
  // Within his visit the game works as usual...
  check(SaveSystem.getFishCounts().shark === 1 && SaveSystem.getBestCatches().pike?.small === 26,
        'a visitor cannot see his own catches during his visit');
  check(SaveSystem.getSelectedBait('sea') === 'pilker' && SaveSystem.getCurrentMap() === 'sea',
        "a visitor's choices are not remembered during his visit");
  // ...but none of it is written anywhere,
  check(same([...store], [...before]), 'a visitor wrote to storage');
  check(counters.removals === 0, 'a visitor deleted from storage');
  // the next visitor starts from nothing,
  SaveSystem.setProfile(visitor.id);
  check(same(SaveSystem.getFishCounts(), {}) && SaveSystem.getLastCatch() === null,
        "the next visitor sees the previous visitor's catches");
  // and the others are as they were.
  SaveSystem.setProfile('julian');
  check(same(SaveSystem.getFishCounts(), JULIAN.fishCounts), "a visitor's play changed Julian's catches");
  SaveSystem.setProfile('guest');
  check(same(SaveSystem.getFishCounts(), GUEST.fishCounts), "a visitor's play changed the catches of James & Boaz");
}

await runScenario('device where the old pike-only wipe already ran', { wipeAlreadyRan: true });
await runScenario('device where that wipe never ran', { wipeAlreadyRan: false });
await runReleasedWriterScenario();
await runJamesScenarios();
await runVisitorScenario();

// Both released saves must still be reachable from the title screen: each
// START button there is a team, and a team plays on the save profile of
// the same id. ('guest' was a try-it-out button once; it is James's save.)
const { TEAMS } = await import('../src/data/teams.js');
for (const profile of ['julian', 'guest']) {
  check(TEAMS.some((team) => team.id === profile),
        `no team plays on the "${profile}" save any more: its catches would be out of reach`);
}

// The code itself must not contain a way to delete.
const source = readFileSync(join(ROOT, 'src/systems/SaveSystem.js'), 'utf8');
check(!/\.removeItem\s*\(|localStorage\.clear\s*\(/.test(source),
      'SaveSystem.js contains a removeItem / clear call');

if (failures) {
  console.error(`\nsave compatibility: ${failures} check(s) FAILED -- this build would lose player data.`);
  process.exit(1);
}
console.log('save compatibility: OK -- existing catches survive this version.');
