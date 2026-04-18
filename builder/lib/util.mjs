export function formatDate(iso, locale = "en-US") {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric" });
}

export function readingTime(markdown) {
  const words = (markdown || "").replace(/```[\s\S]*?```/g, "").split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 220));
}

export function buildExcerpt(markdown, max = 180) {
  if (!markdown) return "";
  const plain = markdown
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/!\[[^\]]*\]\([^)]+\)/g, " ")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/<[^>]+>/g, " ")
    .replace(/\{#[^}\s]+\}/g, " ") // drop our {#anchor-id} markers
    .replace(/[#*_>`~|]/g, " ")
    .replace(/^\s*\d+[.)]\s+/gm, " ")         // drop ordered-list markers
    .replace(/^\s*[-+]\s+/gm, " ")             // drop bullet markers
    .replace(/\s+/g, " ")
    .trim();
  if (plain.length <= max) return plain;
  return plain.slice(0, max).replace(/\s+\S*$/, "") + "…";
}

export function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

export function escapeXml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

export function tagsWithPrimary(postTags, tagsBySlug) {
  if (!postTags?.length) return { primary: null, rest: [] };
  const [primarySlug, ...rest] = postTags;
  return {
    primary: tagsBySlug.get(primarySlug) || { slug: primarySlug, name: primarySlug },
    rest: rest.map(s => tagsBySlug.get(s) || { slug: s, name: s }),
  };
}

export function slugifyHeading(s) {
  return String(s).toLowerCase().trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
