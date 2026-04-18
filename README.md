# robo-blog

Static blog for **robododd.com** — replaces Ghost. Content lives in JSON under `content/`, the editor is a local React app, and the builder produces a static `site/` directory that a GitHub Action syncs to Azure Blob Storage.

## Layout

```
content/          # source of truth (JSON + markdown + images)
editor/           # local editor (React + Vite + Tailwind + shadcn/ui + TipTap)
builder/          # static site generator (markdown-it + Eta + Tailwind v4)
tools/            # one-shot helpers (Ghost importer)
site/             # generated static HTML (committed)
.github/workflows # Azure deploy
```

## Common commands

| Command            | What it does                                                         |
| ------------------ | -------------------------------------------------------------------- |
| `npm run import`   | One-shot: import `robododd.ghost.*.json` into `content/`.            |
| `npm run build`    | Render `content/` → `site/` (HTML + Tailwind CSS + RSS + sitemap).   |
| `npm run preview`  | Serve `site/` locally on http://localhost:4000 (via `npx serve`).    |
| `npm run dev`      | Start the editor on http://localhost:5173.                           |

## Publishing

1. Run `npm run build` locally.
2. `git add site/ content/` and commit.
3. `git push` — the `publish.yml` GitHub Action syncs `site/` to the Azure Storage account's `$web` container.

### Required GitHub secrets

| Secret                   | Value                                                                 |
| ------------------------ | --------------------------------------------------------------------- |
| `AZURE_CREDENTIALS`      | Output of `az ad sp create-for-rbac --sdk-auth` with Storage Blob Data Contributor on the account. |
| `AZURE_STORAGE_ACCOUNT`  | Storage account name.                                                 |
| `AZURE_CDN_PROFILE`      | *(Optional)* CDN profile name, for auto-purge.                        |
| `AZURE_CDN_ENDPOINT`     | *(Optional)* CDN endpoint name.                                       |
| `AZURE_RG`               | *(Optional)* Resource group hosting the CDN profile.                  |

## Content model

- `content/site.json` — title, description, accent color, navigation, etc.
- `content/posts/<slug>.json` — one post per file; content is Markdown.
- `content/pages/<slug>.json` — static pages (About, Privacy).
- `content/tags.json` — tag definitions.
- `content/images/YYYY/MM/...` — images referenced by content.

Posts use `{#anchor-id}` after a heading to pin an explicit anchor (for compatibility with Ghost's prior IDs). Ghost-specific cards (bookmarks, galleries, callouts, files, captioned images) are preserved as raw HTML blocks inside Markdown.

## Known notes

- **Images:** initial Ghost import couldn't auto-download files because Cloudflare throws a JS challenge on robododd.com. See task #5 — resolve by either pausing the CF challenge temporarily, or tarring `/content/images/` off the Ghost server directly into `content/images/`.
- **Drafts:** posts with `status: "draft"` are skipped by the builder.
