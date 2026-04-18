import MarkdownIt from "markdown-it";
import anchor from "markdown-it-anchor";
import prism from "markdown-it-prism";
import { load as loadHtml } from "cheerio";
import { slugifyHeading } from "./util.mjs";

// Support our `{#custom-id}` heading suffix (ported from Ghost's id attributes).
function explicitIdPlugin(md) {
  // Accept any non-whitespace chars in the id — Ghost sometimes emitted URL-encoded
  // code points (%E2%80%93 for en-dash) or literal Unicode.
  const re = /\s+\{#([^}\s]+)\}\s*$/;
  md.core.ruler.before("linkify", "explicit_heading_id", (state) => {
    for (let i = 0; i < state.tokens.length; i++) {
      const t = state.tokens[i];
      if (t.type !== "heading_open") continue;
      const inline = state.tokens[i + 1];
      if (!inline || inline.type !== "inline") continue;
      const last = inline.children[inline.children.length - 1];
      if (!last || last.type !== "text") continue;
      const m = re.exec(last.content);
      if (!m) continue;
      last.content = last.content.replace(re, "");
      inline.content = inline.content.replace(re, "");
      t.attrSet("id", m[1]);
    }
  });
}

export function createRenderer() {
  const md = new MarkdownIt({ html: true, linkify: true, typographer: true, breaks: false });
  md.use(explicitIdPlugin);
  md.use(anchor, {
    slugify: slugifyHeading,
    tabIndex: false,
    // Don't override explicit ids already on the token
    uniqueSlugStartIndex: 1,
  });
  md.use(prism, { defaultLanguage: "text" });
  return md;
}

const LANG_ALIASES = {
  pshell: "powershell",
  powershell: "powershell",
  ps1: "powershell",
  sh: "bash",
  shell: "bash",
  console: "bash",
  "": "text",
  b: "text",
  txt: "text",
  text: "text",
  dockerfile: "docker",
  "docker-compose": "yaml",
  conf: "ini",
};

function normalizeCodeLanguages(source) {
  if (!source) return "";
  return source.replace(/(^|\n)```([^\s\n`]*)([^\n]*)/g, (m, lead, lang, rest) => {
    if (!lang) return m;
    const key = lang.toLowerCase();
    const mapped = LANG_ALIASES[key];
    return `${lead}\`\`\`${mapped || key}${rest}`;
  });
}

export function renderMarkdown(md, source) {
  const html = md.render(normalizeCodeLanguages(source || ""));
  return postProcess(html);
}

function postProcess(html) {
  const $ = loadHtml(`<root>${html}</root>`, null, false);

  // Wrap <pre> in <div class="pre-wrapper"> with a copy button.
  $("pre").each((_, el) => {
    const $el = $(el);
    const wrapper = $(`<div class="pre-wrapper"></div>`);
    $el.replaceWith(wrapper);
    wrapper.append($el);
    wrapper.append(`<button type="button" class="copy-button" aria-label="Copy code"><span class="copy-icon" aria-hidden="true">⧉</span><span class="copied-text">Copy</span></button>`);
  });

  // Lazy-load images, default alt="", and flag content images as zoomable for the lightbox.
  $("img").each((_, el) => {
    const $el = $(el);
    if (!$el.attr("loading")) $el.attr("loading", "lazy");
    if (!$el.attr("decoding")) $el.attr("decoding", "async");
    if ($el.attr("alt") === undefined) $el.attr("alt", "");

    // Exclude bookmark thumbnails, bookmark icons, and file-card icons.
    const inBookmark = $el.closest(".kg-bookmark-card, .kg-file-card").length > 0;
    const isWrappedLink = $el.parents("a").length > 0;
    if (!inBookmark && !isWrappedLink) $el.attr("data-zoom", "");
  });

  // External links: open in new tab, noopener.
  $("a[href^='http']").each((_, el) => {
    const $el = $(el);
    const href = $el.attr("href") || "";
    if (!/^https?:\/\/robododd\.com/.test(href)) {
      $el.attr("target", "_blank");
      $el.attr("rel", "noopener noreferrer");
    }
  });

  return $("root").html() || "";
}
