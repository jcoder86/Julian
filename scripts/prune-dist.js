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
