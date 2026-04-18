import { escapeXml } from "./util.mjs";

export function buildRss({ site, posts, baseUrl }) {
  const items = posts.slice(0, 20).map(p => {
    const url = `${baseUrl}/${p.slug}/`;
    const pubDate = new Date(p.published_at).toUTCString();
    return `
    <item>
      <title>${escapeXml(p.title)}</title>
      <description>${escapeXml(p.excerpt || "")}</description>
      <link>${escapeXml(url)}</link>
      <guid isPermaLink="true">${escapeXml(url)}</guid>
      <pubDate>${pubDate}</pubDate>
      ${p.primary_tag ? `<category>${escapeXml(p.primary_tag.name)}</category>` : ""}
    </item>`;
  }).join("");

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(site.title)}</title>
    <link>${escapeXml(baseUrl)}/</link>
    <description>${escapeXml(site.description || "")}</description>
    <language>${escapeXml(site.locale || "en")}</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <atom:link href="${escapeXml(baseUrl)}/rss.xml" rel="self" type="application/rss+xml"/>${items}
  </channel>
</rss>`;
}
