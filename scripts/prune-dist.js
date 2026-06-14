#!/usr/bin/env node
/**
 * Post-build pruning. Vite's publicDir copies assets/ wholesale, but the
 * AI-generated source images in assets/raw/ exist ONLY as input for the
 * Python asset pipeline -- they shouldn't ship to production. Same for a
 * couple of backup wavs. This script trims dist/ to runtime essentials.
 *
 * Run automatically as the "build" npm script's tail.
 */
import { readdirSync, unlinkSync, statSync, rmSync } from 'fs';
import { join, resolve } from 'path';

const DIST = resolve('dist');

// Files inside dist/raw that are actually loaded by Phaser at runtime.
const RAW_KEEP = new Set([
  'backdrop.mp4',
  'backdrop.png',
  'catch.png',
  'fishon.png',
]);

// Files anywhere else under dist/ that are backups / dev-only.
const PRUNE_PATHS = [
  'audio/sfx/plop-source.wav',
  'clean/julian-fishing-with-rod.png',
  'clean/julian-idle1-pre-rod-long.png',
];

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
    if (!RAW_KEEP.has(f)) tryUnlink(join(rawDir, f));
  }
} catch (e) { /* no raw dir, ok */ }

// Trim other backup files.
for (const p of PRUNE_PATHS) tryUnlink(join(DIST, p));

console.log(`[prune-dist] deleted ${totalDeleted} files, saved ${(totalBytesSaved / 1024 / 1024).toFixed(1)} MB`);
