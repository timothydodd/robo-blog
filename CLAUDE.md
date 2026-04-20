# robo-blog — notes for Claude

Static blog replacing Ghost at **robododd.com**. Content lives in JSON (+ Markdown) under `content/`, a local React editor writes to it, a Node builder turns it into a static `site/`, a GitHub Action syncs `site/` to Azure Blob `$web`.

## Three processes, three ports

| Purpose             | How to run           | Port |
| ------------------- | -------------------- | ---- |
| Editor UI (Vite)    | `npm run dev`        | 5173 |
| Editor API (Fastify)| (spawned by `dev`)   | 5174 |
| Built site preview  | `npm run preview`    | 4000 |

`npm run dev` runs editor server and Vite concurrently; Vite proxies `/api` → 5174 and the Fastify server also serves uploaded images at `/media/*`.

## Commands

- `npm run import` — one-shot Ghost export → `content/`. Expects the Ghost JSON at repo root. Idempotent; overwrites `content/posts/`, `content/pages/`, `content/tags.json`, `content/site.json`, appends to `content/images/`.
- `npm run build` — renders `content/` → `site/`. Deletes `site/` first. Runs Tailwind CLI at the end against `site/**/*.html` + `builder/templates/**/*.eta`.
- `npm run optimize-images` — re-encodes PNG/JPEG > 100 KB under `content/images/` as WEBP (quality 82), resizes anything wider than 1920 px, rewrites references in `content/posts/*.json` / `content/pages/*.json` / `content/site.json`, deletes originals when the new file is strictly smaller. Idempotent. Run after importing a post with large raw screenshots.
- `npm run dev` — local editor (5173) + backend (5174).
- `npm run preview` — serves `site/` on 4000 via `npx serve`.

## Content model (source of truth = `content/`)

- `content/site.json` — title, description, URL, `accent_color`, `icon`, `cover_image`, `navigation[]`, `secondary_navigation[]`, etc.
- `content/posts/<slug>.json` — one post per file. Schema:
  ```json
  {
    "title": "...", "slug": "...", "status": "draft|published",
    "published_at": "ISO", "updated_at": "ISO", "created_at": "ISO",
    "feature_image": "/images/...|null", "feature_image_alt": null, "feature_image_caption": null,
    "excerpt": null, "tags": ["primary","secondary"], "featured": false,
    "content": "# markdown …"
  }
  ```
  First tag is the primary tag (shown on cards, in article header, on tag pages).
- `content/pages/<slug>.json` — same shape minus `tags` / `featured`.
- `content/drafts/<slug>.json` — same shape as a post with `status: "draft"`. Gitignored. Builder skips drafts; editor lists them alongside published posts. The editor server routes saves by `status`: draft → `content/drafts/`, published → `content/posts/`.
- `content/tags.json` — `[{slug, name, description}]`, sorted by slug.
- `content/images/YYYY/MM/<file>` — served at `/images/...` on the built site, at `/media/...` by the editor's API.

## Markdown conventions (important)

- **Heading anchors** — a trailing `{#custom-id}` after a heading pins an explicit `id`. See `builder/lib/markdown.mjs#explicitIdPlugin`. Used to preserve Ghost's legacy anchors (~490 of them).
- **Raw HTML for Ghost cards** — `kg-bookmark-card`, `kg-gallery-card`, `kg-callout-card`, `kg-file-card`, and captioned `kg-image-card` are kept as raw HTML blocks inside Markdown. They don't round-trip cleanly through Markdown. The theme in `builder/assets/app.css` styles them.
- **Plain images** (no caption) are standard `![alt](/images/…)` Markdown.
- **Fenced code blocks** carry a language tag; the builder highlights them server-side via `markdown-it-prism`. A few Ghost exports had odd language names (`pshell`, `powerShell`, bare `b`) — `builder/lib/markdown.mjs#LANG_ALIASES` remaps them before Prism sees them.

## The Ghost import

`tools/import-ghost.mjs`:
1. Reads `db[0].data` from the Ghost JSON.
2. Builds `tagsById` + `tagsByPost` (ordered by `sort_order` — primary first).
3. Rewrites `__GHOST_URL__` and stripping `/size/wXXX/` responsive variants.
4. Preserves kg-* cards via `data-kg-preserve="true"` markers that Turndown turns back into raw HTML.
5. Downloads images using a browser `User-Agent` + `Referer` — Cloudflare on robododd.com was blocking bare `fetch`. If download 403s again, user may need to temporarily disable CF challenge for the `/content/images/*` path.
6. Drops draft post `posts_meta` entries (Ghost had them mostly null anyway).

## Builder pipeline

`builder/build.mjs`:
1. Loads `site.json`, `tags.json`, all `posts/*.json`, `pages/*.json`.
2. For each post/page: `renderMarkdown()` → HTML with anchor IDs + Prism highlighting, then Cheerio post-process (wrap `<pre>` in `.pre-wrapper` + copy button; `loading="lazy"` on `<img>`; external links → `target="_blank" rel="noopener noreferrer"`).
3. Computes reading time (220 wpm) and a plain-text excerpt if `excerpt` is null.
4. Sorts posts desc by `published_at`. Drafts are skipped.
5. Renders Eta templates. `_post-card.eta` is a partial used by `home.eta` and `tag.eta`.
6. Emits paginated home pages (`/` + `/page/N/`), `<slug>/index.html` per post/page, `tag/<slug>/index.html` per used tag, plus `rss.xml`, `sitemap.xml`, `robots.txt`.
7. After the images copy, writes responsive WEBP variants for every `feature_image` (400/800/1200 w) into `site/images/` via `imageSizer.writePendingVariants()`. `_post-card.eta` and `post.eta` emit `srcset` + `sizes` referencing those URLs. The first card on the home feed and the article hero also get `fetchpriority="high"` + `loading="eager"` for LCP.
8. Compiles `builder/assets/app.css` → `site/assets/app.css` via PostCSS + `@tailwindcss/postcss` (scanning already-rendered HTML under `site/**/*.html`). Concatenates `builder/assets/vendor/cookiedialog.min.css` onto the tailwind output and runs a lightweight pure-JS minifier (no cssnano dep). Uses the PostCSS plugin, not the CLI — this avoids the `@parcel/watcher` native binary dance and keeps the toolchain cross-platform (Windows/WSL/Linux/macOS).

Templates mirror Casper's DOM class names (`gh-canvas`, `gh-content`, `post-card-large`, `site-hero-cover`, etc.) — don't rename these casually, the CSS keys off them.

Two easy traps:
- `renderMarkdown()` is **async** — it resolves image dimensions via `sharp` (`builder/lib/imagesize.mjs`) so every `<img>` gets `width`/`height` stamped. Callers must `await` it or the output becomes `[object Promise]`.
- Partial body renders (`eta.render("post", …)`, `eta.render("home", …)`) don't inherit the layout's context. Pass any cross-cutting data the template reads explicitly — e.g. `post.eta` reads `it.site.author` for the byline, so `site` has to be in the render args.
- `imageSizer` has dual purpose: `size(src)` probes metadata; `variants(src, widths)` *queues* variant generation and returns the srcset descriptor. Actual encode/write happens in `writePendingVariants(siteImagesDir)`, which must run **after** `content/images/` has been copied to `site/images/` so the variants land alongside their sources.

## The editor

`editor/` is a **local-only** React + Vite + Tailwind v4 app. Never deployed. Fastify (`editor/server/index.mjs`) is a thin REST wrapper over `content/` file I/O:
- `GET/PUT/POST/DELETE /api/posts[/:slug]`, same for `/api/pages`.
- `GET/PUT /api/tags` (whole array), `GET/PUT /api/site`.
- `GET/POST/DELETE /api/images` — uploads go to `content/images/<YYYY>/<MM>/<base>-<uuid8><ext>`.

The Markdown editor (`editor/src/components/MarkdownEditor.tsx`) is TipTap + `tiptap-markdown`. Call `editor.storage.markdown.getMarkdown()` to read back Markdown. Ctrl/Cmd+S triggers save. Slug auto-generates from title unless the user edits the slug field (`slugEdited` flag).

UI primitives in `editor/src/components/ui/` are hand-rolled (shadcn-style, not the actual shadcn registry) — keep them tiny; add new primitives inline if needed rather than pulling a component library.

Unsaved-changes guard: `editor/src/lib/dirty.ts` is a module-level coordinator, not React state. `PostEdit` calls `setDirty(true/false)` as its buffer changes; sidebar `NavLink`s and a `beforeunload` handler call `confirmDiscard()` before navigating. The app runs on `BrowserRouter`, so React Router's `useBlocker` isn't available — this module-level flag is the workaround.

## Deployment

`.github/workflows/publish.yml` runs on push to `main` when `site/**` changes. Requires repo secrets: `AZURE_CREDENTIALS` (from `az ad sp create-for-rbac --sdk-auth`), `AZURE_STORAGE_ACCOUNT`; optionally `AZURE_CDN_PROFILE`, `AZURE_CDN_ENDPOINT`, `AZURE_RG` for CDN purge.

**Publishing flow:** edit in editor → `npm run build` → `git add content/ site/` + commit → `git push`. Both `content/` and `site/` are committed. `site/` diff shows what actually goes live; CI just syncs it.

## Constraints / gotchas

- **Windows dev environment.** User runs on Windows (this WSL is just where Claude works). If a build fails, surface the error — don't retry blindly. Scripts must stay cross-platform (no `&&`-chains that assume POSIX, watch shell quoting).
- **Cloudflare on robododd.com.** Image downloads needed a browser UA; live site fetches (WebFetch) may 403. User can disable CF rules on request.
- **Don't try to re-implement search, members, subscriptions, or newsletters.** This is a static read-only blog by design.
- **Tailwind v4 config is CSS-first** (`@theme`, `@source` in `builder/assets/app.css` and `editor/src/index.css`). No `tailwind.config.js`.
- **Third-party assets are self-hosted**, not loaded from CDNs. Drop the file under `builder/assets/vendor/` and reference `/assets/vendor/…` (CSS gets merged into `app.css` at build, JS gets copied to `site/assets/vendor/`). `content/site.json.code_injection_head` must not point at jsDelivr or any other cross-origin CDN — that was a render-blocking perf hit.
- **Two logo files** live side-by-side: `logo.webp` (80×80, referenced by the site-head `<img>`) and `logo.png` (64×64, used for the favicon because browser favicon support for WEBP is uneven). Keep both; `build.mjs` copies both into `site/assets/`.
- **Plan file** `/home/tim/.claude/plans/declarative-wondering-boole.md` holds the approved architecture plan — reference it when large structural changes come up.

## Style

- No emojis in code or docs unless asked.
- Don't add co-authored lines to git commits.
- Commit only when the user asks; otherwise leave them to review the diff.

## Feature image aesthetic

Article `feature_image`s follow a consistent synthwave/cyberpunk-lite look that matches the site's accent color (`#C2368F`). When generating or commissioning a new hero image, target this palette and composition:

- **Background:** deep navy / dark purple, often with a subtle gradient toward magenta and a faint grid or scanline underlay.
- **Accent palette:** hot magenta `#C2368F` + cyan neon, with optional warm orange bloom around focal logos. Avoid muted corporate gradients.
- **Subject styles (pick one, don't mix):**
  - *Isometric 3D neon* — matte cubes/hex-rings/servers with thin neon edge-lighting, soft volumetric glow, floor reflection (e.g. `k3s-135-upgrade.webp`, `cloudflare-storage-connector.webp`).
  - *Outlined cartoon neon* — friendly characters or mascots with magenta/cyan rim-light on a navy backdrop (e.g. the original `cloud-azure.webp`, `itsfine.jpg`).
  - *Robot-at-a-console* — cyberpunk robot facing a glowing UI wall, used for AI / tooling posts (e.g. `computer-a.jpg`).
- **Composition:** 3:2 or 16:9, single clear focal point, generous negative space, no embedded captions or article titles. Logos are fine when the post is about a specific product — keep them glowing/rim-lit so they read as part of the scene, not pasted on.
- **File:** save as WEBP, quality 82, max width 1920 px, under `content/images/<YYYY>/<MM>/<kebab-slug>.webp`. Run `npm run optimize-images` if starting from a large PNG/JPEG.
