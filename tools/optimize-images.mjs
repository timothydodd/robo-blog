#!/usr/bin/env node
// Re-encodes large PNG/JPEG images in content/images/ as WEBP (quality 82),
// resizes anything wider than MAX_W to MAX_W, rewrites all references in
// content/{posts,pages}/*.json and content/site.json, and removes the originals
// only when the new file is strictly smaller.
//
// Skips: SVG (vector), GIF (may be animated), and files under MIN_BYTES.
// Idempotent: re-running finds nothing to optimize.

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const CONTENT = path.join(ROOT, "content");
const IMAGES = path.join(CONTENT, "images");

const MIN_BYTES = 100 * 1024; // only touch files > 100 KB
const MAX_W = 1920;
const WEBP_QUALITY = 82;

async function walk(dir, out = []) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) await walk(full, out);
    else out.push(full);
  }
  return out;
}

function toUrlPath(absPath) {
  return "/images/" + path.relative(IMAGES, absPath).split(path.sep).join("/");
}

async function optimizeOne(file) {
  const ext = path.extname(file).toLowerCase();
  if (![".png", ".jpg", ".jpeg"].includes(ext)) return null;

  const stat = await fs.stat(file);
  if (stat.size < MIN_BYTES) return null;

  const img = sharp(file, { failOnError: false });
  const meta = await img.metadata();
  const resize = (meta.width && meta.width > MAX_W) ? { width: MAX_W } : null;

  const outPath = file.replace(/\.(png|jpe?g)$/i, ".webp");
  const buf = await (resize ? img.resize(resize) : img)
    .webp({ quality: WEBP_QUALITY, effort: 5 })
    .toBuffer();

  if (buf.length >= stat.size) return { skipped: true, file, oldSize: stat.size, newSize: buf.length };

  await fs.writeFile(outPath, buf);
  if (outPath !== file) await fs.unlink(file);

  return {
    oldPath: toUrlPath(file),
    newPath: toUrlPath(outPath),
    oldSize: stat.size,
    newSize: buf.length,
    resized: !!resize,
  };
}

async function rewriteRefs(mapping) {
  if (mapping.size === 0) return 0;
  const targets = [
    path.join(CONTENT, "site.json"),
    ...(await fs.readdir(path.join(CONTENT, "posts"))).map(f => path.join(CONTENT, "posts", f)),
    ...(await fs.readdir(path.join(CONTENT, "pages"))).map(f => path.join(CONTENT, "pages", f)),
  ].filter(f => f.endsWith(".json"));

  let totalReplacements = 0;
  for (const file of targets) {
    let text = await fs.readFile(file, "utf8");
    let fileReplacements = 0;
    for (const [oldP, newP] of mapping) {
      if (oldP === newP) continue;
      const before = text;
      text = text.split(oldP).join(newP);
      if (text !== before) fileReplacements += (before.length - text.length === 0 ? 1 : Math.max(1, (before.match(new RegExp(oldP.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g")) || []).length));
    }
    if (fileReplacements > 0) {
      await fs.writeFile(file, text);
      totalReplacements += fileReplacements;
    }
  }
  return totalReplacements;
}

function fmt(n) { return (n / 1024).toFixed(1) + " KB"; }

async function main() {
  console.log(`Scanning ${IMAGES}…`);
  const files = await walk(IMAGES);
  console.log(`Found ${files.length} files total. Optimizing those > ${MIN_BYTES / 1024} KB…\n`);

  const mapping = new Map();
  let totalOld = 0, totalNew = 0, nOptimized = 0, nSkipped = 0, nResized = 0;
  const results = [];

  for (const f of files) {
    try {
      const r = await optimizeOne(f);
      if (!r) continue;
      if (r.skipped) { nSkipped++; continue; }
      mapping.set(r.oldPath, r.newPath);
      totalOld += r.oldSize;
      totalNew += r.newSize;
      if (r.resized) nResized++;
      nOptimized++;
      results.push(r);
    } catch (e) {
      console.error(`  ! error processing ${f}: ${e.message}`);
    }
  }

  results.sort((a, b) => (b.oldSize - b.newSize) - (a.oldSize - a.newSize));
  for (const r of results.slice(0, 15)) {
    console.log(`  ${fmt(r.oldSize).padStart(10)} → ${fmt(r.newSize).padStart(10)}  ${r.resized ? "(resized)" : "         "}  ${r.newPath}`);
  }
  if (results.length > 15) console.log(`  … and ${results.length - 15} more`);

  if (mapping.size > 0) {
    console.log(`\nRewriting ${mapping.size} references in content/…`);
    const n = await rewriteRefs(mapping);
    console.log(`  ${n} textual replacements applied.`);
  }

  console.log(`\n=== Summary ===`);
  console.log(`Optimized:  ${nOptimized} files`);
  console.log(`Resized:    ${nResized} files (wider than ${MAX_W}px)`);
  console.log(`Skipped:    ${nSkipped} files (new version wasn't smaller)`);
  if (nOptimized > 0) {
    const saved = totalOld - totalNew;
    console.log(`Total:      ${fmt(totalOld)} → ${fmt(totalNew)}  (saved ${fmt(saved)}, -${((saved / totalOld) * 100).toFixed(1)}%)`);
  }
}

main().catch(err => { console.error(err); process.exit(1); });
