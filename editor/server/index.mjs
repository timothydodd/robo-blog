import Fastify from "fastify";
import multipart from "@fastify/multipart";
import fs from "node:fs/promises";
import fssync from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..", "..");
const CONTENT = path.join(ROOT, "content");
const POSTS = path.join(CONTENT, "posts");
const DRAFTS = path.join(CONTENT, "drafts");
const PAGES = path.join(CONTENT, "pages");
const IMAGES = path.join(CONTENT, "images");
const TAGS_FILE = path.join(CONTENT, "tags.json");
const SITE_FILE = path.join(CONTENT, "site.json");

const fastify = Fastify({ logger: { level: "info" } });
await fastify.register(multipart, { limits: { fileSize: 20 * 1024 * 1024 } });

// Serve the images directory at /images/ — same path the built site uses,
// so editor-side <img src="/images/…"> matches production.
fastify.register(async (f) => {
  const st = await import("@fastify/static");
  await f.register(st.default, { root: IMAGES, prefix: "/images/", decorateReply: false });
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

async function readJson(file, fallback) {
  try { return JSON.parse(await fs.readFile(file, "utf8")); }
  catch (e) { if (e.code === "ENOENT" && fallback !== undefined) return fallback; throw e; }
}
async function writeJson(file, data) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, JSON.stringify(data, null, 2) + "\n");
}

function assertSlug(slug) {
  if (!slug || !SLUG_RE.test(slug)) {
    const e = new Error(`Invalid slug: ${slug}`); e.statusCode = 400; throw e;
  }
}

async function listJson(dir) {
  try {
    const files = await fs.readdir(dir);
    const records = [];
    for (const f of files) {
      if (!f.endsWith(".json")) continue;
      const p = path.join(dir, f);
      const r = await readJson(p);
      records.push(r);
    }
    return records;
  } catch (e) { if (e.code === "ENOENT") return []; throw e; }
}

function summary(p) {
  return {
    slug: p.slug, title: p.title, status: p.status,
    published_at: p.published_at, updated_at: p.updated_at,
    feature_image: p.feature_image || null,
    featured: !!p.featured,
    tags: p.tags || [],
    excerpt: p.excerpt || null,
  };
}

// ---------------------------------------------------------------------------
// Posts (drafts live in content/drafts/ — gitignored. Published posts in content/posts/.)
// ---------------------------------------------------------------------------

function postDirFor(status) { return status === "draft" ? DRAFTS : POSTS; }

async function findPostFile(slug) {
  for (const dir of [POSTS, DRAFTS]) {
    const p = path.join(dir, `${slug}.json`);
    try { await fs.access(p); return p; } catch { /* try next */ }
  }
  return null;
}

fastify.get("/api/posts", async () => {
  const all = [...(await listJson(POSTS)), ...(await listJson(DRAFTS))];
  all.sort((a, b) => new Date(b.updated_at || b.published_at || 0) - new Date(a.updated_at || a.published_at || 0));
  return all.map(summary);
});

fastify.get("/api/posts/:slug", async (req) => {
  assertSlug(req.params.slug);
  const f = await findPostFile(req.params.slug);
  if (!f) { const e = new Error("Not found"); e.statusCode = 404; throw e; }
  return await readJson(f);
});

fastify.put("/api/posts/:slug", async (req) => {
  assertSlug(req.params.slug);
  const body = req.body || {};
  const origSlug = req.params.slug;
  const newSlug = body.slug || origSlug;
  assertSlug(newSlug);

  const now = new Date().toISOString();
  const record = {
    ...body,
    slug: newSlug,
    updated_at: now,
  };
  if (!record.created_at) record.created_at = now;
  if (record.status === "published" && !record.published_at) record.published_at = now;

  const targetDir = postDirFor(record.status);
  const origFile = await findPostFile(origSlug);
  const newFile = path.join(targetDir, `${newSlug}.json`);

  // Reject collision only when the target file is a *different* record than the one we're saving.
  if (origSlug !== newSlug || (origFile && origFile !== newFile)) {
    try {
      await fs.access(newFile);
      const e = new Error(`Slug ${newSlug} already exists at ${path.relative(CONTENT, newFile)}`);
      e.statusCode = 409; throw e;
    } catch (err) {
      if (err.code !== "ENOENT") throw err;
    }
  }
  if (origFile && origFile !== newFile) {
    try { await fs.unlink(origFile); } catch (e) { if (e.code !== "ENOENT") throw e; }
  }
  await writeJson(newFile, record);
  return record;
});

fastify.post("/api/posts", async (req) => {
  const body = req.body || {};
  const slug = body.slug || `post-${Date.now()}`;
  assertSlug(slug);
  const now = new Date().toISOString();
  const record = {
    title: "Untitled",
    status: "draft",
    feature_image: null,
    feature_image_alt: null,
    feature_image_caption: null,
    excerpt: null,
    tags: [],
    featured: false,
    content: "",
    ...body,
    slug,
    created_at: now,
    updated_at: now,
  };
  const existing = await findPostFile(slug);
  if (existing) {
    const e = new Error(`Slug ${slug} exists`); e.statusCode = 409; throw e;
  }
  await writeJson(path.join(postDirFor(record.status), `${slug}.json`), record);
  return record;
});

fastify.delete("/api/posts/:slug", async (req, reply) => {
  assertSlug(req.params.slug);
  const f = await findPostFile(req.params.slug);
  if (!f) { reply.code(404); return { error: "Not found" }; }
  await fs.unlink(f);
  reply.code(204).send();
});

// ---------------------------------------------------------------------------
// Pages (same shape, different dir)
// ---------------------------------------------------------------------------

fastify.get("/api/pages", async () => {
  const all = await listJson(PAGES);
  all.sort((a, b) => (a.title || "").localeCompare(b.title || ""));
  return all.map(summary);
});
fastify.get("/api/pages/:slug", async (req) => {
  assertSlug(req.params.slug);
  return await readJson(path.join(PAGES, `${req.params.slug}.json`));
});
fastify.put("/api/pages/:slug", async (req) => {
  assertSlug(req.params.slug);
  const body = req.body || {};
  const newSlug = body.slug || req.params.slug;
  assertSlug(newSlug);
  const now = new Date().toISOString();
  const record = { ...body, slug: newSlug, updated_at: now };
  if (!record.created_at) record.created_at = now;
  const origPath = path.join(PAGES, `${req.params.slug}.json`);
  const newPath = path.join(PAGES, `${newSlug}.json`);
  if (req.params.slug !== newSlug) {
    try { await fs.unlink(origPath); } catch (e) { if (e.code !== "ENOENT") throw e; }
  }
  await writeJson(newPath, record);
  return record;
});
fastify.post("/api/pages", async (req) => {
  const body = req.body || {};
  const slug = body.slug || `page-${Date.now()}`;
  assertSlug(slug);
  const now = new Date().toISOString();
  const record = {
    title: "Untitled Page", status: "published",
    feature_image: null, feature_image_alt: null, feature_image_caption: null,
    excerpt: null, content: "",
    ...body,
    slug, created_at: now, updated_at: now,
  };
  await writeJson(path.join(PAGES, `${slug}.json`), record);
  return record;
});
fastify.delete("/api/pages/:slug", async (req, reply) => {
  assertSlug(req.params.slug);
  await fs.unlink(path.join(PAGES, `${req.params.slug}.json`));
  reply.code(204).send();
});

// ---------------------------------------------------------------------------
// Tags
// ---------------------------------------------------------------------------

fastify.get("/api/tags", async () => {
  return await readJson(TAGS_FILE, []);
});
fastify.put("/api/tags", async (req) => {
  const body = req.body;
  if (!Array.isArray(body)) { const e = new Error("Body must be an array of tags"); e.statusCode = 400; throw e; }
  for (const t of body) if (!t.slug || !t.name) { const e = new Error("Each tag needs slug + name"); e.statusCode = 400; throw e; }
  const sorted = [...body].sort((a, b) => a.slug.localeCompare(b.slug));
  await writeJson(TAGS_FILE, sorted);
  return sorted;
});

// ---------------------------------------------------------------------------
// Site settings
// ---------------------------------------------------------------------------

fastify.get("/api/site", async () => await readJson(SITE_FILE));
fastify.put("/api/site", async (req) => {
  const body = req.body || {};
  await writeJson(SITE_FILE, body);
  return body;
});

// ---------------------------------------------------------------------------
// Images
// ---------------------------------------------------------------------------

fastify.get("/api/images", async () => {
  const out = [];
  async function walk(dir, rel = "") {
    let entries;
    try { entries = await fs.readdir(dir, { withFileTypes: true }); } catch (e) { if (e.code === "ENOENT") return; throw e; }
    for (const ent of entries) {
      const full = path.join(dir, ent.name);
      const r = path.posix.join(rel, ent.name);
      if (ent.isDirectory()) await walk(full, r);
      else if (/\.(png|jpe?g|gif|webp|svg|avif)$/i.test(ent.name)) {
        const stat = await fs.stat(full);
        const p = `/images/${r}`;
        out.push({ path: p, url: p, size: stat.size, mtime: stat.mtime.toISOString() });
      }
    }
  }
  await walk(IMAGES);
  out.sort((a, b) => b.mtime.localeCompare(a.mtime));
  return out;
});

fastify.post("/api/images", async (req, reply) => {
  const parts = req.parts();
  const uploaded = [];
  const now = new Date();
  const y = String(now.getFullYear());
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const targetDir = path.join(IMAGES, y, m);
  await fs.mkdir(targetDir, { recursive: true });

  for await (const part of parts) {
    if (part.type !== "file") continue;
    const ext = path.extname(part.filename || "").toLowerCase() || ".bin";
    const base = path.basename(part.filename || "file", ext)
      .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "img";
    const filename = `${base}-${randomUUID().slice(0, 8)}${ext}`;
    const full = path.join(targetDir, filename);
    await fs.writeFile(full, await part.toBuffer());
    const p = `/images/${y}/${m}/${filename}`;
    uploaded.push({ path: p, url: p });
  }
  return uploaded;
});

fastify.delete("/api/images/*", async (req, reply) => {
  const rel = req.params["*"] || "";
  if (rel.includes("..")) { reply.code(400); return { error: "bad path" }; }
  const full = path.join(IMAGES, rel);
  if (!full.startsWith(IMAGES + path.sep)) { reply.code(400); return { error: "bad path" }; }
  await fs.unlink(full);
  reply.code(204).send();
});

// ---------------------------------------------------------------------------
// Build — streams `node builder/build.mjs` output via Server-Sent Events
// ---------------------------------------------------------------------------

let buildRunning = false;

fastify.get("/api/build", { logLevel: "warn" }, (req, reply) => {
  if (buildRunning) {
    reply.code(409).send({ error: "A build is already running" });
    return;
  }
  buildRunning = true;

  reply.raw.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    "Connection": "keep-alive",
    "X-Accel-Buffering": "no",
  });
  reply.hijack();

  const send = (type, data) => {
    reply.raw.write(`data: ${JSON.stringify({ type, data })}\n\n`);
  };

  const t0 = Date.now();
  send("start", { time: new Date().toISOString() });

  const child = spawn(process.execPath, ["builder/build.mjs"], {
    cwd: ROOT,
    env: { ...process.env, FORCE_COLOR: "0" },
  });

  child.stdout.on("data", (d) => send("stdout", d.toString()));
  child.stderr.on("data", (d) => send("stderr", d.toString()));
  child.on("error", (e) => { send("error", e.message); });
  child.on("exit", (code) => {
    send("done", { code, duration_ms: Date.now() - t0 });
    reply.raw.end();
    buildRunning = false;
  });

  req.raw.on("close", () => {
    if (!child.killed && child.exitCode === null) child.kill();
    buildRunning = false;
  });
});

fastify.get("/api/build/status", async () => ({ running: buildRunning }));

// ---------------------------------------------------------------------------
// Error handler + startup
// ---------------------------------------------------------------------------

fastify.setErrorHandler((err, req, reply) => {
  req.log.error(err);
  reply.code(err.statusCode || 500).send({ error: err.message || "internal" });
});

const PORT = Number(process.env.PORT) || 5174;
fastify.listen({ port: PORT, host: "127.0.0.1" }).catch((e) => {
  console.error(e);
  process.exit(1);
});
