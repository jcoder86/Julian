#!/usr/bin/env node
/**
 * Post-build pruning. Vite's publicDir copies assets/ wholesale, but the
 * AI-generated source images in assets/raw/ exist ONLY as input for the
 * Python asset pipeline -- they shouldn't ship to production. Same for a
 * couple of backup wavs. This script trims dist/ to runtime essentials,
 * and then checks that the service worker does not expect any file that
 * is no longer there.
 *
 * Run automatically as the "build" npm script's tail.
 */
import { readdirSync, unlinkSync, statSync, readFileSync, existsSync } from 'fs';
import { join, resolve } from 'path';
import { RAW_KEEP, NOT_SHIPPED } from './shipping.js';

const DIST = resolve('dist');

// What to delete is listed in scripts/shipping.js.
const RAW_KEEP_SET = new Set(RAW_KEEP);

let totalDeleted = 0, totalBytesSaved = 0;

function tryUnlink(path) {
  try {
    const size = statSync(path).size;
    unlinkSync(path);
    totalDeleted++;
    totalBytesSaved += size;
    return size;
  } catch (e) {
    if (e.code !== 'ENOENT') console.warn(`  skip ${path}: ${e.code}`);
    return 0;
  }
}

// Trim raw/ to runtime keepers.
const rawDir = join(DIST, 'raw');
try {
  for (const f of readdirSync(rawDir)) {
    if (!RAW_KEEP_SET.has(f)) tryUnlink(join(rawDir, f));
  }
} catch (e) { /* no raw dir, ok */ }

// Trim other backup files.
for (const p of NOT_SHIPPED) tryUnlink(join(DIST, p));

console.log(`[prune-dist] deleted ${totalDeleted} files, saved ${(totalBytesSaved / 1024 / 1024).toFixed(1)} MB`);

// The service worker was written BEFORE this script ran, with a list of
// every file it will download for offline play. A file on that list that
// was just deleted breaks the install (or, behind the server's fallback to
// index.html, gets a web page cached under a picture's name). The list and
// this script share scripts/shipping.js so that cannot happen -- check it
// anyway, and refuse to finish a build where it did.
let sw = null;
try {
  sw = readFileSync(join(DIST, 'sw.js'), 'utf8');
} catch (e) { /* built without a service worker, ok */ }
if (sw !== null) {
  const listed = [...new Set([...sw.matchAll(/["']?url["']?\s*:\s*["']([^"']+)["']/g)].map((m) => m[1]))];
  const gone = listed.filter((url) => !existsSync(join(DIST, url)));
  if (gone.length) {
    console.error(`[prune-dist] the service worker lists ${gone.length} file(s) that are not in dist/:`);
    for (const url of gone) console.error(`  ${url}`);
    console.error('  Keep them off its list too: see scripts/shipping.js and workbox.globIgnores in vite.config.js.');
    process.exit(1);
  }
  console.log(`[prune-dist] service worker: all ${listed.length} listed files are in dist/`);
}
