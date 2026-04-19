// Image dimension resolver + responsive variant generator.
//
// `size(src)` maps `/images/YYYY/MM/foo.ext` site paths back to the filesystem
// copy under `content/images/` and returns { width, height }. Memoized.
//
// `variants(src, widths)` schedules responsive WEBP variants to be written into
// `site/images/` and returns an srcset descriptor [{ width, url }] including
// the original. Widths wider than the source are skipped. Non-raster formats
// (SVG, GIF) return null and should fall back to a plain `<img src>`.
//
// `writePendingVariants(siteImagesDir)` actually encodes and writes the queued
// variants — call this once after site/images/ has been populated from
// content/images/ so variant files land alongside their sources.

import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const VARIANT_QUALITY = 82;
const VARIANT_EFFORT = 5;
const RASTER_EXT = /\.(jpe?g|png|webp)$/i;

export function createImageSizer(contentRoot) {
  const metaCache = new Map();
  const pending = new Map(); // key `${src}|${width}` → { src, width, url }
  const imagesDir = path.join(contentRoot, "images");

  function toFsPath(src) {
    if (!src) return null;
    if (!src.startsWith("/images/")) return null;
    const rel = src.slice("/images/".length).split("?")[0].split("#")[0];
    return path.join(imagesDir, rel);
  }

  function variantUrl(src, width) {
    const ext = path.extname(src);
    const base = src.slice(0, -ext.length);
    return `${base}-${width}w.webp`;
  }

  async function size(src) {
    if (metaCache.has(src)) return metaCache.get(src);
    const fsPath = toFsPath(src);
    if (!fsPath) { metaCache.set(src, null); return null; }
    try {
      const meta = await sharp(fsPath).metadata();
      if (!meta.width || !meta.height) { metaCache.set(src, null); return null; }
      const out = { width: meta.width, height: meta.height };
      metaCache.set(src, out);
      return out;
    } catch {
      metaCache.set(src, null);
      return null;
    }
  }

  async function variants(src, widths) {
    if (!src || !RASTER_EXT.test(src)) return null;
    const meta = await size(src);
    if (!meta) return null;
    const out = [];
    for (const w of widths) {
      if (w >= meta.width) continue;
      const url = variantUrl(src, w);
      const key = `${src}|${w}`;
      if (!pending.has(key)) pending.set(key, { src, width: w, url });
      out.push({ width: w, url });
    }
    // Always include the source as the widest option so the browser can fall
    // back to it on large screens / high-DPI.
    out.push({ width: meta.width, url: src });
    return out;
  }

  async function writePendingVariants(siteImagesDir) {
    const tasks = Array.from(pending.values());
    for (const v of tasks) {
      const srcFs = toFsPath(v.src);
      if (!srcFs) continue;
      const relUrl = v.url.slice("/images/".length);
      const outFs = path.join(siteImagesDir, relUrl);
      await fs.mkdir(path.dirname(outFs), { recursive: true });
      try {
        const buf = await sharp(srcFs)
          .resize({ width: v.width, withoutEnlargement: true })
          .webp({ quality: VARIANT_QUALITY, effort: VARIANT_EFFORT })
          .toBuffer();
        await fs.writeFile(outFs, buf);
      } catch (e) {
        // Surface but don't fail the whole build on a single bad source image.
        console.warn(`  (warn) variant ${v.width}w for ${v.src} failed: ${e.message}`);
      }
    }
    return tasks.length;
  }

  return { size, variants, writePendingVariants };
}
