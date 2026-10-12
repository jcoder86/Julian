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
// Two things were taken out of saves ON REQUEST, each once and each fenced
// in (see SaveSystem.js): the sea book of James & Boaz (2026-10-11) and the
// French lake's book of both teams (2026-10-12). The scenarios below check
// that exactly that goes, that it is kept in a note, and nothing else.
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

// The French lake's book is emptied once, for both teams, on devices that
// start this version through 19 October 2026. Three species of the released
// lake are on that page now: their old catches are what goes (into a note).
// Written out here, not looked up: any OTHER species going is a failure.
const MOVED_TO_FRANCE = ['bass', 'chub', 'trout'];
const AFTER_FRANCE_CUTOFF = Date.UTC(2026, 9, 20, 0, 0, 1);
const FRENCH_TABLES = ['fishCounts', 'catchCountsBySize', 'bestCatches'];

/** What the game does with saves when it starts (BootScene). */
function startUp(SaveSystem, now) {
  SaveSystem.adoptJamesCatches(now);
  SaveSystem.emptyFrenchBooks(now);
}

let failures = 0;
function check(condition, message) {
  if (condition) return;
  failures++;
  console.error(`  FAIL: ${message}`);
}
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
// The same, whatever order the keys are in.
const sorted = (value) => (value && typeof value === 'object' && !Array.isArray(value)
  ? Object.fromEntries(Object.keys(value).sort().map((key) => [key, sorted(value[key])]))
  : value);
const sameContent = (a, b) => same(sorted(a), sorted(b));
const without = (table, ids) => Object.fromEntries(Object.entries(table).filter(([id]) => !ids.includes(id)));
const only = (table, ids) => Object.fromEntries(Object.entries(table).filter(([id]) => ids.includes(id)));
/** A save (see snapshot) without the catches of some species. */
const withoutCatchesOf = (save, ids) => ({
  ...save,
  ...Object.fromEntries(FRENCH_TABLES.map((table) => [table, without(save[table], ids)])),
});

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
  const { FISH_BY_ID, MAP_SPECIES, mapsOfSpecies } = await import('../src/data/fish.js');
  const { baitOnMap } = await import('../src/data/baits.js');
  const { FLOATS_BY_ID } = await import('../src/data/floats.js');

  // --- 1. Start the game as Julian, the way START does -------------------
  // (Start-up first offers James & Boaz James's collection. This guest
  // profile has lake fish of its own, so nothing may come of it. Then the
  // French lake's book is emptied -- on a device that starts in time.)
  const startedAt = options.startedAt ?? REQUEST_DAY;
  const gone = startedAt < AFTER_FRANCE_CUTOFF ? MOVED_TO_FRANCE : [];
  const expected = withoutCatchesOf(JULIAN, gone);
  startUp(SaveSystem, startedAt);
  check(SaveSystem.getProfile() === 'julian', 'start-up left another profile active');
  SaveSystem.setProfile('julian');
  check(same(SaveSystem.getFishCounts(), expected.fishCounts), 'fishCounts changed on load');
  check(same(SaveSystem.getCatchCountsBySize(), expected.catchCountsBySize), 'catchCountsBySize changed on load');
  check(same(SaveSystem.getBestCatches(), expected.bestCatches), 'bestCatches changed on load');
  check(same(SaveSystem.getLastCatch(), JULIAN.lastCatch), 'lastCatch changed on load');
  check(SaveSystem.getSelectedBait('lake') === JULIAN.selectedBait, 'the lake no longer finds the saved bait');
  check(SaveSystem.getSelectedBait() === JULIAN.selectedBait, 'getSelectedBait() without a map must still mean the lake');
  check(SaveSystem.getSelectedFloat() === JULIAN.selectedFloat, 'saved float not found');
  // Only the three tables of Julian's book may have been rewritten, and
  // only when the French page was emptied (their content is checked above).
  const rewritten = gone.length ? FRENCH_TABLES.map((table) => `julians_game_${table}`) : [];
  for (const [key, value] of before) {
    if (rewritten.includes(key)) continue;
    check(store.get(key) === value, `loading the save rewrote "${key}"`);
  }
  // What was taken off the French page is kept, to the last centimetre.
  const frenchNote = SaveSystem.load('franceEmptied');
  check(frenchNote?.emptied === (gone.length > 0), 'the note about the French book says the wrong thing');
  if (gone.length) {
    for (const table of FRENCH_TABLES) {
      check(sameContent(frenchNote?.removed?.[table], only(JULIAN[table], gone)),
            `what was taken out of ${table} was not kept in the note`);
    }
  } else {
    check(frenchNote?.removed === undefined, 'the note claims French catches were taken out');
  }

  // --- 2. Everything saved is still a known id, and still shown -----------
  // A species may move to another map (the first lake's trout, chub and
  // bass now live in the French lake): what counts is that it is on SOME
  // map's collection page, so no catch drops out of sight -- and that a
  // page still holds exactly twelve.
  for (const id of RELEASED_LAKE_SPECIES) {
    check(!!FISH_BY_ID[id], `species "${id}" no longer exists: its catches would vanish`);
    check(mapsOfSpecies(id).length > 0, `species "${id}" is on no map's collection page any more`);
  }
  for (const [mapId, ids] of Object.entries(MAP_SPECIES)) {
    check(ids.length === 12 && new Set(ids).size === 12, `the collection page of "${mapId}" does not hold twelve species`);
    check(ids.every((id) => !!FISH_BY_ID[id]), `the collection page of "${mapId}" lists an unknown species`);
  }
  for (const id of RELEASED_BAITS) {
    check(baitOnMap(id, 'lake'), `bait "${id}" is no longer a lake bait`);
  }
  for (const id of RELEASED_FLOATS) {
    check(!!FLOATS_BY_ID[id], `float "${id}" no longer exists`);
  }

  // --- 3. Play the new content: it may only ADD ---------------------------
  // (Catches are recorded the way the fishing screen does: with the map.)
  SaveSystem.setCurrentMap('sea');
  SaveSystem.setSelectedBait('pilker', 'sea');
  SaveSystem.recordCatch({ species: 'shark', size: 'small', lengthCm: 95, mapId: 'sea' });
  SaveSystem.recordCatch({ species: 'mackerel', size: 'medium', lengthCm: 31, mapId: 'sea' });
  SaveSystem.setCurrentMap('lake');
  SaveSystem.recordCatch({ species: 'pike', size: 'medium', lengthCm: 60, mapId: 'lake' });   // smaller than his best
  // A catfish from the French lake is not one from the moat.
  SaveSystem.recordCatch({ species: 'catfish', size: 'large', lengthCm: 231, mapId: 'france' });

  const counts = SaveSystem.getFishCounts();
  const best = SaveSystem.getBestCatches();
  const bySize = SaveSystem.getCatchCountsBySize();
  for (const id of RELEASED_LAKE_SPECIES) {
    if (gone.includes(id)) {
      check(counts[id] === undefined && best[id] === undefined && bySize[id] === undefined,
            `"${id}" is on the emptied French page, but has catches`);
      continue;
    }
    const count = JULIAN.fishCounts[id] + (id === 'pike' ? 1 : 0);
    check(counts[id] === count, `count for "${id}" is ${counts[id]}, expected ${count}`);
    check(same(best[id], JULIAN.bestCatches[id]), `best catches for "${id}" changed`);
    if (id !== 'pike') check(same(bySize[id], JULIAN.catchCountsBySize[id]), `size counts for "${id}" changed`);
  }
  check(counts.shark === 1 && best.shark?.small === 95, 'a sea catch was not recorded');
  check(counts['catfish@france'] === 1 && best['catfish@france']?.large === 231,
        'a French catfish was not kept apart from the catfish of the moat');
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
  const { mapsOfSpecies } = await import('../src/data/fish.js');
  startUp(SaveSystem, REQUEST_DAY);   // this guest has lake fish; the French page is emptied

  // Julian caught every species of the released lake, so three of them are
  // on the French page now; this guest caught none of those.
  const julianNow = withoutCatchesOf(julianBefore, MOVED_TO_FRANCE);
  for (const [profile, before] of [['julian', julianNow], ['guest', guestBefore]]) {
    SaveSystem.setProfile(profile);
    const now = snapshot(SaveSystem);
    for (const part of Object.keys(before)) {
      check(same(now[part], before[part]), `${profile}: ${part} differs from what the released game stored`);
    }
    for (const species of Object.keys(before.fishCounts)) {
      check(mapsOfSpecies(species).length > 0, `${profile}: "${species}" is on no map's collection page`);
    }
  }
  SaveSystem.setProfile('julian');
  for (const table of FRENCH_TABLES) {
    check(sameContent(SaveSystem.load('franceEmptied')?.removed?.[table], only(julianBefore[table], MOVED_TO_FRANCE)),
          `julian: what was taken out of ${table} was not kept in the note`);
  }
  const rewritten = FRENCH_TABLES.map((table) => `julians_game_${table}`);
  for (const [key, value] of written) {
    if (rewritten.includes(key)) continue;
    check(store.get(key) === value, `the update changed "${key}"`);
  }
  check(removals === 0, `the update deleted from storage ${removals} time(s)`);

  // Playing on does not mix the two up.
  SaveSystem.setProfile('guest');
  SaveSystem.recordCatch({ species: 'shark', size: 'small', lengthCm: 90, mapId: 'sea' });
  check(SaveSystem.getFishCounts().roach === guestBefore.fishCounts.roach, "guest: an old count changed after a new catch");
  SaveSystem.setProfile('julian');
  check(same(snapshot(SaveSystem), julianNow), "Julian's save changed when the guest caught a fish");
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
  const { speciesForMap, mapsOfSpecies } = await import('../src/data/fish.js');
  // His twelve species are the first map's, as it was when he caught them.
  // Three of those live in the French lake now, and that book starts empty:
  // they are not put in (176 - 6 chub - 7 bass - 10 trout = 153 fish).
  const JAMES = withoutCatchesOf(JAMES_CATCHES, MOVED_TO_FRANCE);
  const lake = Object.keys(JAMES.fishCounts);
  const sea = speciesForMap('sea').map((s) => s.id);
  let scenario = 0;
  const fresh = async () =>
    (await import(`../src/systems/SaveSystem.js?scenario=james-${scenario++}`)).SaveSystem;

  console.log("- James's collection itself");
  let total = 0;
  for (const [id, count] of Object.entries(JAMES_CATCHES.fishCounts)) {
    total += count;
    check(mapsOfSpecies(id).length > 0 && !sea.includes(id),
          `James's collection holds "${id}", which is not a fresh-water fish on any map`);
    const bySize = JAMES_CATCHES.catchCountsBySize[id] || {};
    check(Object.values(bySize).reduce((a, b) => a + b, 0) === count, `James: sizes of "${id}" do not add up to ${count}`);
    check(same(Object.keys(bySize), Object.keys(JAMES_CATCHES.bestCatches[id] || {})),
          `James: "${id}" has a best catch for a size he never caught, or the other way round`);
  }
  check(total === 176, `James's collection is ${total} fish, the photo shows 176`);
  check(lake.length === 9 && Object.values(JAMES.fishCounts).reduce((a, b) => a + b, 0) === 153,
        'what is put in for James & Boaz is not his collection minus chub, bass and trout');
  check(!MOVED_TO_FRANCE.includes(JAMES_CATCHES.lastCatch.species), "James's last catch is a fish that is not put in");

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
    check(same(SaveSystem.getFishCounts(), JAMES.fishCounts), "James & Boaz did not get exactly James's counts");
    check(same(SaveSystem.getCatchCountsBySize(), JAMES.catchCountsBySize), "James & Boaz did not get exactly James's size counts");
    check(same(SaveSystem.getBestCatches(), JAMES.bestCatches), "James & Boaz did not get exactly James's best catches");
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
    check(lake.every((id) => counts[id] === JAMES.fishCounts[id]), "the lake book was not filled with James's fish");
    check(MOVED_TO_FRANCE.every((id) => !(id in counts)), 'a fish of the French lake was put in');
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
    check(same(SaveSystem.getFishCounts(), JAMES.fishCounts), "a new device did not get James's collection");
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
// The French lake's book starts empty (SaveSystem.emptyFrenchBooks), and a
// fish that lives on two maps is counted per map (catchKey).
//
// The second place where the game takes something out of a save by itself.
// ---------------------------------------------------------------------------

const JULIAN_PREFIX = 'julians_game_';
const ofJulian = (store) => [...store].filter(([key]) => key.startsWith(JULIAN_PREFIX) && !key.startsWith(GUEST_PREFIX));
const ofGuest = (store) => [...store].filter(([key]) => key.startsWith(GUEST_PREFIX));

async function runFranceScenarios() {
  const { JAMES_CATCHES } = await import('../src/data/jamesCatches.js');
  const { MAP_SPECIES, catchKey, mapsOfSpecies } = await import('../src/data/fish.js');
  let scenario = 0;
  const fresh = async () =>
    (await import(`../src/systems/SaveSystem.js?scenario=france-${scenario++}`)).SaveSystem;

  console.log('- every card of the fish book has catches of its own');
  {
    const keys = Object.entries(MAP_SPECIES).flatMap(([mapId, ids]) => ids.map((id) => catchKey(id, mapId)));
    check(new Set(keys).size === keys.length, 'two cards of the fish book share their catches');
    check(catchKey('catfish', 'lake') === 'catfish' && catchKey('catfish', 'france') === 'catfish@france',
          'the catfish of the moat and of the French lake are not kept apart');
    // Whatever was caught before there were maps is still on a page.
    for (const id of RELEASED_LAKE_SPECIES) {
      check(catchKey(id, mapsOfSpecies(id)[0]) === id && catchKey(id) === id,
            `the catches the released game stored for "${id}" are on no card any more`);
    }
  }

  // --- the family's own devices: yesterday's version put ALL of James's fish in ---
  console.log("- James & Boaz with James's whole collection already loaded: chub, bass and trout go, the rest stays");
  {
    const store = new Map([['some_other_app_setting', 'untouched']]);
    for (const [key, value] of Object.entries(JULIAN)) store.set(`${JULIAN_PREFIX}${key}`, JSON.stringify(value));
    for (const table of [...FRENCH_TABLES, 'lastCatch']) {
      store.set(`${GUEST_PREFIX}${table}`, JSON.stringify(JAMES_CATCHES[table]));
    }
    store.set(`${GUEST_PREFIX}jamesCatchesAdopted`, JSON.stringify({ at: '2026-10-11T18:00:00.000Z', loaded: true }));
    const counters = { removals: 0 };
    fakeStorage(store, counters);
    const SaveSystem = await fresh();

    startUp(SaveSystem, REQUEST_DAY + 86_400_000);
    SaveSystem.setProfile('guest');
    for (const table of FRENCH_TABLES) {
      const now = SaveSystem.load(table);
      check(same(now, without(JAMES_CATCHES[table], MOVED_TO_FRANCE)), `James & Boaz: ${table} is not James's minus the French fish`);
      check(sameContent(SaveSystem.load('franceEmptied')?.removed?.[table], only(JAMES_CATCHES[table], MOVED_TO_FRANCE)),
            `James & Boaz: what was taken out of ${table} was not kept in the note`);
    }
    check(SaveSystem.getFishCounts().catfish === JAMES_CATCHES.fishCounts.catfish, "James's catfish from the moat were taken for French ones");
    check(same(SaveSystem.getLastCatch(), JAMES_CATCHES.lastCatch), 'their last catch (a catfish from the moat) was taken away');
    SaveSystem.setProfile('julian');
    check(same(SaveSystem.getFishCounts(), without(JULIAN.fishCounts, MOVED_TO_FRANCE)), "Julian's French page was not emptied, or more than that");
    check(store.get('some_other_app_setting') === 'untouched', "another app's data was touched");
    check(counters.removals === 0, 'something was deleted from storage outright');
  }

  // --- both teams tried the French lake out -------------------------------------------
  console.log('- both teams have fish on the French page: it is emptied once, everything else stays');
  {
    const store = new Map([['some_other_app_setting', 'untouched']]);
    const counters = { removals: 0 };
    fakeStorage(store, counters);
    const SaveSystem = await fresh();
    // As the version before this one stored them: by species only.
    SaveSystem.setProfile('julian');
    SaveSystem.setCurrentMap('france');
    SaveSystem.setSelectedBait('vlieg', 'france');
    SaveSystem.recordCatch({ species: 'trout', size: 'large', lengthCm: 57 });
    SaveSystem.recordCatch({ species: 'salmon', size: 'medium', lengthCm: 81 });
    SaveSystem.recordCatch({ species: 'salmon', size: 'medium', lengthCm: 77 });
    SaveSystem.recordCatch({ species: 'catfish', size: 'small', lengthCm: 61 });
    SaveSystem.recordCatch({ species: 'pike', size: 'large', lengthCm: 124 });
    SaveSystem.recordCatch({ species: 'mackerel', size: 'medium', lengthCm: 33 });   // his last catch: not French
    SaveSystem.setProfile('guest');
    SaveSystem.recordCatch({ species: 'roach', size: 'small', lengthCm: 12 });
    SaveSystem.recordCatch({ species: 'chub', size: 'medium', lengthCm: 35 });
    SaveSystem.recordCatch({ species: 'sturgeon', size: 'large', lengthCm: 310 });   // their last catch: French
    SaveSystem.setProfile('julian');

    SaveSystem.emptyFrenchBooks(REQUEST_DAY);
    check(SaveSystem.getProfile() === 'julian', 'emptying left another profile active');
    check(same(SaveSystem.getFishCounts(), { catfish: 1, pike: 1, mackerel: 1 }), "Julian's book is not what it was minus the French page");
    check(same(SaveSystem.getBestCatches(), { catfish: { small: 61 }, pike: { large: 124 }, mackerel: { medium: 33 } }),
          "Julian's best catches are not what they were minus the French page");
    check(same(SaveSystem.getCatchCountsBySize(), { catfish: { small: 1 }, pike: { large: 1 }, mackerel: { medium: 1 } }),
          "Julian's size counts are not what they were minus the French page");
    check(SaveSystem.getLastCatch()?.species === 'mackerel', "Julian's last catch was taken away although its fish is still there");
    check(SaveSystem.getCurrentMap() === 'france' && SaveSystem.getSelectedBait('france') === 'vlieg', 'his chosen map or lure was changed');
    const julianNote = SaveSystem.load('franceEmptied');
    check(julianNote?.emptied === true
          && sameContent(julianNote?.removed?.fishCounts, { trout: 1, salmon: 2 })
          && sameContent(julianNote?.removed?.bestCatches, { trout: { large: 57 }, salmon: { medium: 81 } })
          && sameContent(julianNote?.removed?.catchCountsBySize, { trout: { large: 1 }, salmon: { medium: 2 } })
          && julianNote?.removed?.lastCatch === undefined,
          "what was taken out of Julian's book was not kept in the note");

    SaveSystem.setProfile('guest');
    check(same(SaveSystem.getFishCounts(), { roach: 1 }) && same(SaveSystem.getBestCatches(), { roach: { small: 12 } }),
          'the book of James & Boaz is not what it was minus the French page');
    check(SaveSystem.getLastCatch() === null, 'the last catch still points at a fish that is gone');
    const guestNote = SaveSystem.load('franceEmptied');
    check(sameContent(guestNote?.removed?.fishCounts, { chub: 1, sturgeon: 1 })
          && guestNote?.removed?.bestCatches?.sturgeon?.large === 310
          && guestNote?.removed?.lastCatch?.species === 'sturgeon',
          'what was taken out of the book of James & Boaz was not kept in the note');
    check(store.get('some_other_app_setting') === 'untouched', "another app's data was touched");

    // Once means once: starting again changes nothing, and what they catch
    // in France from now on stays -- the catfish on its own card.
    const afterFirst = new Map(store);
    SaveSystem.emptyFrenchBooks(REQUEST_DAY + 60_000);
    check(same([...store], [...afterFirst]), 'a second start changed the save again');
    SaveSystem.recordCatch({ species: 'trout', size: 'small', lengthCm: 22, mapId: 'france' });
    SaveSystem.recordCatch({ species: 'catfish', size: 'medium', lengthCm: 140, mapId: 'france' });
    SaveSystem.setProfile('julian');
    SaveSystem.recordCatch({ species: 'catfish', size: 'medium', lengthCm: 118, mapId: 'lake' });
    SaveSystem.emptyFrenchBooks(REQUEST_DAY + 120_000);
    check(same(SaveSystem.getFishCounts(), { catfish: 2, pike: 1, mackerel: 1 }), "a catfish from the moat did not join Julian's other one");
    check(same(SaveSystem.getLastCatch(), { species: 'catfish', size: 'medium', lengthCm: 118, mapId: 'lake' }),
          'the last catch does not say where it was caught');
    SaveSystem.setProfile('guest');
    check(same(SaveSystem.getFishCounts(), { roach: 1, trout: 1, 'catfish@france': 1 }),
          'a French catch made after the change was taken away, or not kept apart');
    check(SaveSystem.getBestCatches()['catfish@france']?.medium === 140, 'the French catfish has no best catch of its own');
    check(counters.removals === 0, 'something was deleted from storage outright');
  }

  // --- the update only arrives after the cut-off ---------------------------------------
  console.log('- first run after the cut-off date: French catches are kept, also when the clock is set back');
  {
    const store = new Map();
    const counters = { removals: 0 };
    fakeStorage(store, counters);
    const SaveSystem = await fresh();
    SaveSystem.setProfile('guest');
    SaveSystem.recordCatch({ species: 'salmon', size: 'large', lengthCm: 121, mapId: 'france' });
    SaveSystem.setProfile('julian');
    SaveSystem.recordCatch({ species: 'char', size: 'small', lengthCm: 19, mapId: 'france' });
    const tables = (s) => [...s].filter(([key]) => !key.endsWith('franceEmptied'));
    const before = tables(store);

    SaveSystem.emptyFrenchBooks(AFTER_FRANCE_CUTOFF);
    SaveSystem.emptyFrenchBooks(REQUEST_DAY);
    check(same(tables(store), before), 'French catches were taken away after the cut-off date');
    for (const profile of ['julian', 'guest']) {
      SaveSystem.setProfile(profile);
      const note = SaveSystem.load('franceEmptied');
      check(note?.emptied === false && note?.removed === undefined, `${profile}: the note claims something was taken out`);
    }
  }

  // --- a save that cannot be read is not an empty save ------------------------------------
  console.log("- a damaged or unreadable save: left alone, and the other team's is still done");
  {
    const store = new Map([
      [`${JULIAN_PREFIX}fishCounts`, '{"trout": 3, "pik'],
      [`${JULIAN_PREFIX}bestCatches`, JSON.stringify({ trout: { small: 21 } })],
      [`${GUEST_PREFIX}fishCounts`, JSON.stringify({ trout: 2, roach: 4 })],
    ]);
    const counters = { removals: 0 };
    fakeStorage(store, counters);
    const julianBefore = ofJulian(store);
    const SaveSystem = await fresh();
    const warn = console.warn;
    console.warn = () => {};
    SaveSystem.emptyFrenchBooks(REQUEST_DAY);
    console.warn = warn;
    check(same(ofJulian(store), julianBefore), "a damaged save was written to (Julian's)");
    SaveSystem.setProfile('guest');
    check(same(SaveSystem.getFishCounts(), { roach: 4 }), "the other team's French page was not emptied");
  }
  {
    const store = new Map([[`${GUEST_PREFIX}fishCounts`, JSON.stringify({ trout: 2, roach: 4 })]]);
    const counters = { removals: 0 };
    fakeStorage(store, counters);
    globalThis.window.localStorage.getItem = () => { throw new Error('storage is off'); };
    const before = new Map(store);
    const SaveSystem = await fresh();
    const warn = console.warn;
    console.warn = () => {};
    SaveSystem.emptyFrenchBooks(REQUEST_DAY);
    console.warn = warn;
    check(same([...store], [...before]), 'an unreadable save was written to');
    check(ofGuest(store).length === 1, 'an unreadable save got a note saying it was done');
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

  startUp(SaveSystem, AFTER_FRANCE_CUTOFF);            // (late: this scenario is about the visitor)
  const before = new Map(store);

  SaveSystem.setProfile(visitor.id);
  check(same(SaveSystem.getFishCounts(), {}), 'a visitor does not start with an empty book');
  SaveSystem.setCurrentMap('sea');
  SaveSystem.setSelectedBait('pilker', 'sea');
  SaveSystem.setSelectedFloat('float_02');
  SaveSystem.recordCatch({ species: 'shark', size: 'large', lengthCm: 301, mapId: 'sea' });
  SaveSystem.recordCatch({ species: 'pike', size: 'small', lengthCm: 26, mapId: 'lake' });
  SaveSystem.recordCatch({ species: 'salmon', size: 'small', lengthCm: 48, mapId: 'france' });
  // (Start-up empties the French book of the two teams. Not his.)
  SaveSystem.emptyFrenchBooks(REQUEST_DAY);
  check(SaveSystem.getProfile() === visitor.id && SaveSystem.getFishCounts().salmon === 1,
        "start-up took a visitor's French fish away");
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
await runScenario('device that gets this version only after 19 October: nothing at all is taken out',
                  { wipeAlreadyRan: true, startedAt: AFTER_FRANCE_CUTOFF });
await runReleasedWriterScenario();
await runJamesScenarios();
await runFranceScenarios();
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
