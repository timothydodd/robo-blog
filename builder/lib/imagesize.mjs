// Image dimension resolver. Maps `/images/YYYY/MM/foo.ext` site paths back to
// the filesystem copy under `content/images/` and returns { width, height }.
// Memoized so large posts referencing the same image dozens of times don't
// re-probe the file.

import path from "node:path";
import sharp from "sharp";

export function createImageSizer(contentRoot) {
  const cache = new Map();
  const imagesDir = path.join(contentRoot, "images");

  function toFsPath(src) {
    if (!src) return null;
    if (!src.startsWith("/images/")) return null;
    const rel = src.slice("/images/".length).split("?")[0].split("#")[0];
    return path.join(imagesDir, rel);
  }

  async function size(src) {
    if (cache.has(src)) return cache.get(src);
    const fsPath = toFsPath(src);
    if (!fsPath) { cache.set(src, null); return null; }
    try {
      const meta = await sharp(fsPath).metadata();
      if (!meta.width || !meta.height) { cache.set(src, null); return null; }
      const out = { width: meta.width, height: meta.height };
      cache.set(src, out);
      return out;
    } catch {
      cache.set(src, null);
      return null;
    }
  }

  return { size };
}
