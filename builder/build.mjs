#!/usr/bin/env node
import fs from "node:fs/promises";
import fssync from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Eta } from "eta";
import postcss from "postcss";
import tailwindcss from "@tailwindcss/postcss";

import { createRenderer, renderMarkdown } from "./lib/markdown.mjs";
import { buildRss } from "./lib/rss.mjs";
import { buildSitemap } from "./lib/sitemap.mjs";
import {
  formatDate, readingTime, buildExcerpt, escapeHtml, tagsWithPrimary,
} from "./lib/util.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const CONTENT = path.join(ROOT, "content");
const SITE = path.join(ROOT, "site");
const TEMPLATES = path.join(__dirname, "templates");
const ASSETS = path.join(__dirname, "assets");

const POSTS_PER_PAGE = 9;

const ICONS = {
  linkedin: `<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M20.45 20.45h-3.56v-5.57c0-1.33-.03-3.04-1.85-3.04-1.85 0-2.14 1.45-2.14 2.94v5.67H9.34V9h3.42v1.56h.05c.48-.9 1.64-1.85 3.38-1.85 3.61 0 4.27 2.38 4.27 5.47v6.27zM5.34 7.44a2.06 2.06 0 1 1 0-4.12 2.06 2.06 0 0 1 0 4.12zm1.78 13.01H3.56V9h3.56v11.45zM22.22 0H1.77C.79 0 0 .77 0 1.72v20.56C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.72V1.72C24 .77 23.2 0 22.22 0z"/></svg>`,
  github: `<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.3 3.44 9.8 8.21 11.39.6.11.82-.26.82-.58v-2.17c-3.34.73-4.04-1.41-4.04-1.41-.55-1.39-1.33-1.76-1.33-1.76-1.09-.74.08-.73.08-.73 1.2.08 1.84 1.24 1.84 1.24 1.07 1.84 2.81 1.31 3.5 1 .11-.78.42-1.31.76-1.61-2.67-.3-5.47-1.33-5.47-5.93 0-1.31.47-2.38 1.24-3.22-.13-.3-.54-1.52.11-3.18 0 0 1.01-.32 3.3 1.23a11.5 11.5 0 0 1 6 0c2.29-1.55 3.3-1.23 3.3-1.23.66 1.66.25 2.88.12 3.18.77.84 1.23 1.91 1.23 3.22 0 4.61-2.81 5.63-5.48 5.92.43.37.81 1.1.81 2.22v3.29c0 .32.22.7.83.58C20.56 21.8 24 17.3 24 12c0-6.63-5.37-12-12-12z"/></svg>`,
  x: `<svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M18.244 2H21.5l-7.5 8.57L22.88 22H16l-5.36-7L4.5 22H1.24l8.02-9.17L1 2h6.88L12.7 8.36 18.244 2zm-1.14 18h1.84L6.94 3.88H4.98L17.104 20z"/></svg>`,
  mail: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></svg>`,
  rss: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 11a9 9 0 0 1 9 9"/><path d="M4 4a16 16 0 0 1 16 16"/><circle cx="5" cy="19" r="1.5" fill="currentColor"/></svg>`,
};

function socialIcon(url) {
  const u = (url || "").toLowerCase();
  if (u.includes("linkedin.com")) return ICONS.linkedin;
  if (u.includes("github.com")) return ICONS.github;
  if (u.includes("x.com") || u.includes("twitter.com")) return ICONS.x;
  if (u.startsWith("mailto:")) return ICONS.mail;
  if (u.endsWith("/rss") || u.endsWith("/rss.xml") || u.endsWith("/feed")) return ICONS.rss;
  return null;
}

// ---------------------------------------------------------------------------

async function readJson(file) { return JSON.parse(await fs.readFile(file, "utf8")); }

async function readDirJson(dir) {
  let entries = [];
  try { entries = await fs.readdir(dir); } catch { return []; }
  const out = [];
  for (const name of entries) {
    if (!name.endsWith(".json")) continue;
    out.push(await readJson(path.join(dir, name)));
  }
  return out;
}

async function writeHtml(file, html) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, html);
}

async function copyDir(src, dst) {
  try { await fs.cp(src, dst, { recursive: true }); } catch (e) {
    if (e.code !== "ENOENT") throw e;
  }
}

function absoluteUrl(baseUrl, p) {
  if (!p) return "";
  if (/^https?:/i.test(p)) return p;
  if (!p.startsWith("/")) p = "/" + p;
  return baseUrl.replace(/\/$/, "") + p;
}

// ---------------------------------------------------------------------------

async function runTailwind() {
  const inputPath = path.join(ASSETS, "app.css");
  const outputPath = path.join(SITE, "assets", "app.css");
  const input = await fs.readFile(inputPath, "utf8");
  // No minifier — avoids the lightningcss native-binary dependency. Unminified CSS
  // still gzips to a few KB on the wire. Consumer can layer cssnano later if desired.
  const result = await postcss([tailwindcss()]).process(input, {
    from: inputPath,
    to: outputPath,
    map: false,
  });
  await fs.writeFile(outputPath, result.css);
}

// ---------------------------------------------------------------------------

async function main() {
  const t0 = Date.now();
  console.log("Building static site…");

  // ---- Load content
  const site = await readJson(path.join(CONTENT, "site.json"));
  const tags = await readJson(path.join(CONTENT, "tags.json"));
  const tagsBySlug = new Map(tags.map(t => [t.slug, t]));

  const rawPosts = await readDirJson(path.join(CONTENT, "posts"));
  const rawPages = await readDirJson(path.join(CONTENT, "pages"));

  // ---- Renderer
  const md = createRenderer();
  const eta = new Eta({ views: TEMPLATES, cache: true, autoEscape: false });

  // ---- Enrich posts
  const published = rawPosts.filter(p => p.status === "published");
  const posts = published.map(p => {
    const { primary, rest } = tagsWithPrimary(p.tags || [], tagsBySlug);
    const content_html = renderMarkdown(md, p.content);
    return {
      ...p,
      primary_tag: primary,
      tags: [primary, ...rest].filter(Boolean),
      content_html,
      subtitle: p.excerpt || null,                       // explicit only — shown under post title
      excerpt: p.excerpt || buildExcerpt(p.content),     // derived — used for cards + meta description
      reading_time: readingTime(p.content),
      published_at_formatted: formatDate(p.published_at, site.locale),
    };
  }).sort((a, b) => new Date(b.published_at) - new Date(a.published_at));

  const pages = rawPages.map(p => ({
    ...p,
    content_html: renderMarkdown(md, p.content),
    excerpt: p.excerpt || buildExcerpt(p.content),
  }));

  // ---- Clear output dir contents.
  //
  // EBUSY (Windows) and EACCES (WSL-on-NTFS) are expected whenever something
  // is holding a file open — most commonly `npm run preview` serving site/
  // files while the build runs. The subsequent file writes overwrite in place
  // regardless, so these are safe to ignore silently. Any other error is
  // genuinely unexpected and gets surfaced.
  await fs.mkdir(SITE, { recursive: true });
  for (const entry of await fs.readdir(SITE)) {
    const p = path.join(SITE, entry);
    try {
      await fs.rm(p, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
    } catch (e) {
      if (e.code === "EBUSY" || e.code === "EACCES" || e.code === "EPERM") continue;
      console.warn(`  (warn) could not remove ${path.relative(ROOT, p)}: ${e.code || e.message}`);
    }
  }

  // ---- Copy images + static JS
  await copyDir(path.join(CONTENT, "images"), path.join(SITE, "images"));
  await fs.mkdir(path.join(SITE, "assets"), { recursive: true });
  await fs.copyFile(path.join(ASSETS, "main.js"), path.join(SITE, "assets", "main.js"));
  await fs.copyFile(path.join(ASSETS, "logo.png"), path.join(SITE, "assets", "logo.png"));

  // ---- Render layout helper
  function renderPage({ body, pageTitle, pageDescription, canonicalPath, ogType, ogImage, bodyClass, articleMeta }) {
    return eta.render("layout", {
      site,
      body,
      socialIcon,
      pageTitle: pageTitle || site.title,
      pageDescription: pageDescription || site.description || "",
      canonicalUrl: absoluteUrl(site.url, canonicalPath || "/"),
      baseUrl: site.url.replace(/\/$/, ""),
      ogType: ogType || "website",
      ogImage: ogImage ? absoluteUrl(site.url, ogImage) : "",
      bodyClass: bodyClass || "",
      articleMeta: articleMeta || null,
    });
  }

  // ---- Homepage (paginated)
  const totalPages = Math.max(1, Math.ceil(posts.length / POSTS_PER_PAGE));
  for (let i = 1; i <= totalPages; i++) {
    const start = (i - 1) * POSTS_PER_PAGE;
    const slice = posts.slice(start, start + POSTS_PER_PAGE);
    const body = eta.render("home", {
      site, posts: slice,
      isFirstPage: i === 1,
      pagination: {
        current: i, totalPages,
        prev: i === 2 ? "/" : i > 2 ? `/page/${i - 1}/` : null,
        next: i < totalPages ? `/page/${i + 1}/` : null,
      },
    });
    const html = renderPage({
      body,
      pageTitle: site.meta_title || site.title,
      pageDescription: site.meta_description || site.description || "",
      canonicalPath: i === 1 ? "/" : `/page/${i}/`,
      ogImage: site.cover_image,
      bodyClass: "home-template" + (i === 1 ? " is-home" : ""),
    });
    const outPath = i === 1
      ? path.join(SITE, "index.html")
      : path.join(SITE, "page", String(i), "index.html");
    await writeHtml(outPath, html);
  }
  console.log(`  ${totalPages} home page(s)`);

  // ---- Posts
  for (const p of posts) {
    const related = posts.filter(r => r.slug !== p.slug && r.primary_tag?.slug === p.primary_tag?.slug).slice(0, 3);
    const body = eta.render("post", { post: p, related });
    const html = renderPage({
      body,
      pageTitle: `${p.title} — ${site.title}`,
      pageDescription: p.excerpt,
      canonicalPath: `/${p.slug}/`,
      ogType: "article",
      ogImage: p.feature_image,
      bodyClass: "post-template",
      articleMeta: {
        published_at: p.published_at,
        updated_at: p.updated_at,
        primary_tag: p.primary_tag,
      },
    });
    await writeHtml(path.join(SITE, p.slug, "index.html"), html);
  }
  console.log(`  ${posts.length} posts`);

  // ---- Pages
  for (const pg of pages) {
    const body = eta.render("page", { page: pg });
    const html = renderPage({
      body,
      pageTitle: `${pg.title} — ${site.title}`,
      pageDescription: pg.excerpt || site.description || "",
      canonicalPath: `/${pg.slug}/`,
      ogImage: pg.feature_image || site.cover_image,
      bodyClass: "page-template",
    });
    await writeHtml(path.join(SITE, pg.slug, "index.html"), html);
  }
  console.log(`  ${pages.length} pages`);

  // ---- Tag pages
  let nTagsRendered = 0;
  for (const t of tags) {
    const tagPosts = posts.filter(p => p.primary_tag?.slug === t.slug || p.tags?.some(x => x.slug === t.slug));
    if (!tagPosts.length) continue;
    const body = eta.render("tag", { tag: t, posts: tagPosts });
    const html = renderPage({
      body,
      pageTitle: `${t.name} — ${site.title}`,
      pageDescription: t.description || `Posts tagged ${t.name}`,
      canonicalPath: `/tag/${t.slug}/`,
      bodyClass: "tag-template",
    });
    await writeHtml(path.join(SITE, "tag", t.slug, "index.html"), html);
    nTagsRendered++;
  }
  console.log(`  ${nTagsRendered} tag pages`);

  // ---- RSS + Sitemap + robots
  const rss = buildRss({ site, posts, baseUrl: site.url.replace(/\/$/, "") });
  await fs.writeFile(path.join(SITE, "rss.xml"), rss);

  const sitemap = buildSitemap({
    posts, pages, tags: tags.filter(t => posts.some(p => p.tags?.some(x => x.slug === t.slug))),
    baseUrl: site.url.replace(/\/$/, ""),
  });
  await fs.writeFile(path.join(SITE, "sitemap.xml"), sitemap);

  await fs.writeFile(path.join(SITE, "robots.txt"),
    `User-agent: *\nAllow: /\nSitemap: ${site.url.replace(/\/$/, "")}/sitemap.xml\n`);

  // ---- Tailwind
  console.log("  running tailwind…");
  await runTailwind();

  console.log(`Done in ${((Date.now() - t0) / 1000).toFixed(1)}s → site/`);
}

main().catch(err => { console.error(err); process.exit(1); });
