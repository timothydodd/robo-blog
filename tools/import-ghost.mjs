#!/usr/bin/env node
import fs from "node:fs/promises";
import fssync from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { load as loadHtml } from "cheerio";
import TurndownService from "turndown";
import { gfm } from "turndown-plugin-gfm";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const CONTENT = path.join(ROOT, "content");
const IMAGES = path.join(CONTENT, "images");

const INPUT = process.argv[2] || path.join(ROOT, "robododd.ghost.2026-04-17-22-06-41.json");
const GHOST_URL = "https://robododd.com";

// ---------------------------------------------------------------------------
// Settings helpers
// ---------------------------------------------------------------------------

function settingsToObject(settings) {
  const o = {};
  for (const s of settings) {
    let v = s.value;
    if (v === "null" || v === "" || v === undefined) v = null;
    if (v && (s.key === "navigation" || s.key === "secondary_navigation")) {
      try { v = JSON.parse(v); } catch { /* keep raw */ }
    }
    o[s.key] = v;
  }
  return o;
}

function ghostUrlToLocal(url) {
  if (!url) return url;
  // strip responsive size variants: /content/images/size/wXXX/YYYY/...
  // -> /content/images/YYYY/...
  return url
    .replace(/^__GHOST_URL__/, "")
    .replace(/^https?:\/\/robododd\.com/, "")
    .replace(/^\/content\/images\/size\/[^/]+\/(.*)$/, "/images/$1")
    .replace(/^\/content\/images\/(.*)$/, "/images/$1");
}

function ghostUrlToRemote(url) {
  if (!url) return url;
  if (url.startsWith("__GHOST_URL__")) return url.replace("__GHOST_URL__", GHOST_URL);
  return url;
}

// ---------------------------------------------------------------------------
// Image collection & download
// ---------------------------------------------------------------------------

const BROWSER_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
  "Accept": "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
  "Referer": "https://robododd.com/",
};

async function downloadImage(remoteUrl, localPath) {
  await fs.mkdir(path.dirname(localPath), { recursive: true });
  try { await fs.access(localPath); return { status: "cached", remoteUrl }; } catch {}
  const res = await fetch(remoteUrl, { redirect: "follow", headers: BROWSER_HEADERS });
  if (!res.ok) return { status: "failed", remoteUrl, code: res.status };
  const buf = Buffer.from(await res.arrayBuffer());
  await fs.writeFile(localPath, buf);
  return { status: "downloaded", remoteUrl, bytes: buf.length };
}

function collectImageUrls(posts, siteSettings) {
  const urls = new Set();
  const add = (u) => { if (u && (u.startsWith("__GHOST_URL__") || u.includes("robododd.com"))) urls.add(u); };
  for (const p of posts) {
    add(p.feature_image);
    if (!p.html) continue;
    const $ = loadHtml(p.html);
    $("img").each((_, el) => {
      add($(el).attr("src"));
      const srcset = $(el).attr("srcset");
      if (srcset) for (const part of srcset.split(",")) add(part.trim().split(/\s+/)[0]);
    });
    $("a").each((_, el) => {
      const href = $(el).attr("href");
      if (href && /\.(png|jpe?g|gif|svg|webp|pdf|zip|mp4|mov)$/i.test(href)) add(href);
    });
    $("[style]").each((_, el) => {
      const m = /url\(["']?([^)"']+)["']?\)/.exec($(el).attr("style") || "");
      if (m) add(m[1]);
    });
  }
  add(siteSettings.icon);
  add(siteSettings.cover_image);
  add(siteSettings.logo);
  return [...urls];
}

// ---------------------------------------------------------------------------
// HTML preprocessing: rewrite Ghost URLs, unwrap/strip in place
// ---------------------------------------------------------------------------

function preprocessHtml(rawHtml) {
  if (!rawHtml) return "";
  const $ = loadHtml(`<root>${rawHtml}</root>`, null, false);

  // Rewrite __GHOST_URL__ anywhere in src/srcset/href
  $("[src], [srcset], [href], [data-src]").each((_, el) => {
    const $el = $(el);
    for (const attr of ["src", "href", "data-src"]) {
      const v = $el.attr(attr);
      if (v && (v.startsWith("__GHOST_URL__") || v.includes("robododd.com"))) {
        $el.attr(attr, ghostUrlToLocal(v));
      }
    }
    const srcset = $el.attr("srcset");
    if (srcset) {
      const rewritten = srcset.split(",").map(part => {
        const [u, ...rest] = part.trim().split(/\s+/);
        return [ghostUrlToLocal(u), ...rest].join(" ");
      }).join(", ");
      $el.attr("srcset", rewritten);
    }
  });

  // Strip srcset entirely (we serve full-size in v1)
  $("[srcset]").removeAttr("srcset").removeAttr("sizes");

  // Drop Ghost card HTML comments
  $.root().contents().each(function removeCommentsRecursively() {
    // no-op placeholder; actual comment removal below via traversal
  });
  // Remove HTML comments (cheerio: walk tree)
  function stripComments(node) {
    $(node).contents().each((_, c) => {
      if (c.type === "comment") $(c).remove();
      else if (c.children) stripComments(c);
    });
  }
  stripComments($.root());

  // Add a marker to kg-cards we want to preserve as raw HTML
  // so Turndown's keep() rules can find them unambiguously.
  $("figure.kg-bookmark-card, figure.kg-gallery-card, figure.kg-callout-card, figure.kg-file-card, div.kg-callout-card, div.kg-bookmark-card, figure.kg-image-card.kg-card-hascaption")
    .attr("data-kg-preserve", "true");

  return $("root").html() || "";
}

// ---------------------------------------------------------------------------
// Turndown config
// ---------------------------------------------------------------------------

function buildTurndown() {
  const td = new TurndownService({
    headingStyle: "atx",
    bulletListMarker: "-",
    codeBlockStyle: "fenced",
    emDelimiter: "_",
    fence: "```",
    hr: "---",
    linkStyle: "inlined",
  });
  td.use(gfm);

  // Preserve marked Ghost cards verbatim
  td.addRule("preserveKgCards", {
    filter: (node) => node.getAttribute && node.getAttribute("data-kg-preserve") === "true",
    replacement: (_content, node) => {
      node.removeAttribute("data-kg-preserve");
      return "\n\n" + node.outerHTML.replace(/\sdata-kg-preserve="true"/g, "") + "\n\n";
    },
  });

  // Plain image cards (no caption) → markdown image
  td.addRule("kgImageCardPlain", {
    filter: (node) =>
      node.nodeName === "FIGURE" &&
      node.classList &&
      node.classList.contains("kg-image-card") &&
      !node.classList.contains("kg-card-hascaption"),
    replacement: (_content, node) => {
      const img = node.querySelector("img");
      if (!img) return "";
      const src = img.getAttribute("src") || "";
      const alt = img.getAttribute("alt") || "";
      return `\n\n![${alt}](${src})\n\n`;
    },
  });

  // Code cards with language
  td.addRule("kgCodeCard", {
    filter: (node) =>
      node.nodeName === "FIGURE" &&
      node.classList &&
      node.classList.contains("kg-code-card"),
    replacement: (_content, node) => {
      const pre = node.querySelector("pre");
      const code = pre ? pre.querySelector("code") : null;
      const lang = (code && (code.getAttribute("class") || "").match(/language-(\S+)/) || [])[1]
        || (pre && pre.getAttribute("data-language")) || "";
      const text = (code && code.textContent) || (pre && pre.textContent) || "";
      return `\n\n\`\`\`${lang}\n${text.replace(/\n$/, "")}\n\`\`\`\n\n`;
    },
  });

  // Plain fenced code blocks: carry language from <code class="language-*">
  td.addRule("fencedCodeBlockWithLang", {
    filter: (node) =>
      node.nodeName === "PRE" &&
      node.firstChild &&
      node.firstChild.nodeName === "CODE",
    replacement: (_content, node) => {
      const code = node.firstChild;
      const lang = ((code.getAttribute("class") || "").match(/language-(\S+)/) || [])[1] || "";
      const text = code.textContent.replace(/\n$/, "");
      return `\n\n\`\`\`${lang}\n${text}\n\`\`\`\n\n`;
    },
  });

  // Preserve id on headings as {#slug}
  for (const level of [1, 2, 3, 4, 5, 6]) {
    td.addRule(`h${level}WithId`, {
      filter: (node) => node.nodeName === `H${level}` && node.getAttribute("id"),
      replacement: (content, node) => {
        const id = node.getAttribute("id");
        const hashes = "#".repeat(level);
        return `\n\n${hashes} ${content.trim()} {#${id}}\n\n`;
      },
    });
  }

  return td;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function writeJson(file, data) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, JSON.stringify(data, null, 2) + "\n");
}

async function main() {
  console.log(`Loading ${path.relative(ROOT, INPUT)}`);
  const raw = JSON.parse(await fs.readFile(INPUT, "utf8"));
  const data = raw.db[0].data;

  // ---- Tags
  const tagsById = new Map();
  for (const t of data.tags) tagsById.set(t.id, { slug: t.slug, name: t.name, description: t.description || null });

  // ---- posts_tags → ordered slug lists per post
  const postTagRows = [...data.posts_tags].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  const tagsByPost = new Map();
  const usedTagIds = new Set();
  for (const pt of postTagRows) {
    if (!tagsByPost.has(pt.post_id)) tagsByPost.set(pt.post_id, []);
    const tag = tagsById.get(pt.tag_id);
    if (!tag) continue;
    tagsByPost.get(pt.post_id).push(tag.slug);
    usedTagIds.add(pt.tag_id);
  }

  // ---- Site settings
  const s = settingsToObject(data.settings);
  const site = {
    title: s.title || "RoboDodd",
    description: s.description || null,
    meta_title: s.meta_title || null,
    meta_description: s.meta_description || null,
    url: "https://robododd.com",
    accent_color: s.accent_color || "#891A43",
    icon: ghostUrlToLocal(s.icon),
    cover_image: ghostUrlToLocal(s.cover_image),
    logo: ghostUrlToLocal(s.logo),
    timezone: s.timezone || "America/New_York",
    locale: s.locale || "en",
    twitter: s.twitter || null,
    facebook: s.facebook || null,
    navigation: Array.isArray(s.navigation) ? s.navigation : [],
    secondary_navigation: Array.isArray(s.secondary_navigation) ? s.secondary_navigation : [],
  };

  // ---- Image download
  // Pass the raw settings object so site.icon/cover_image/logo keep their __GHOST_URL__ prefix
  // and get picked up by the URL filter. `site` has already been rewritten to /images/… paths.
  const imageUrls = collectImageUrls(data.posts, s);
  console.log(`Found ${imageUrls.length} unique image URLs. Downloading…`);
  let ok = 0, cached = 0, failed = [];
  for (const u of imageUrls) {
    const localRel = ghostUrlToLocal(u);
    if (!localRel.startsWith("/images/")) continue; // external image, skip
    const localAbs = path.join(CONTENT, localRel); // /images/... → content/images/...
    const remote = ghostUrlToRemote(u);
    const r = await downloadImage(remote, localAbs);
    if (r.status === "downloaded") ok++;
    else if (r.status === "cached") cached++;
    else { failed.push(r); }
  }
  console.log(`Images: ${ok} downloaded, ${cached} already cached, ${failed.length} failed.`);
  if (failed.length) console.log("Failures:", failed.slice(0, 5));

  // ---- Posts & pages
  const turndown = buildTurndown();
  await fs.rm(path.join(CONTENT, "posts"), { recursive: true, force: true });
  await fs.rm(path.join(CONTENT, "pages"), { recursive: true, force: true });
  await fs.mkdir(path.join(CONTENT, "posts"), { recursive: true });
  await fs.mkdir(path.join(CONTENT, "pages"), { recursive: true });

  let nPosts = 0, nPages = 0;
  for (const post of data.posts) {
    const preprocessed = preprocessHtml(post.html || "");
    const markdown = turndown.turndown(preprocessed).trim();

    const primaryTags = tagsByPost.get(post.id) || [];
    const record = {
      title: post.title,
      slug: post.slug,
      status: post.status,
      published_at: post.published_at,
      updated_at: post.updated_at,
      created_at: post.created_at,
      feature_image: ghostUrlToLocal(post.feature_image) || null,
      feature_image_alt: null,
      feature_image_caption: null,
      excerpt: post.custom_excerpt || null,
      tags: post.type === "page" ? undefined : primaryTags,
      featured: post.type === "page" ? undefined : !!post.featured,
      content: markdown,
    };
    // drop undefined fields
    for (const k of Object.keys(record)) if (record[k] === undefined) delete record[k];

    const dir = post.type === "page" ? "pages" : "posts";
    await writeJson(path.join(CONTENT, dir, `${post.slug}.json`), record);
    if (post.type === "page") nPages++; else nPosts++;
  }
  console.log(`Posts: ${nPosts} written. Pages: ${nPages} written.`);

  // ---- Tags file (used only)
  const usedTags = [...usedTagIds]
    .map(id => tagsById.get(id))
    .filter(Boolean)
    .sort((a, b) => a.slug.localeCompare(b.slug));
  await writeJson(path.join(CONTENT, "tags.json"), usedTags);
  console.log(`Tags: ${usedTags.length} written.`);

  // ---- Site settings
  await writeJson(path.join(CONTENT, "site.json"), site);
  console.log("Site settings written.");

  console.log("\nDone.");
}

main().catch(err => { console.error(err); process.exit(1); });
