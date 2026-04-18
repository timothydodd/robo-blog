import { escapeXml } from "./util.mjs";

export function buildSitemap({ posts, pages, tags, baseUrl }) {
  const postDate = (p) => p.updated_at || p.published_at || "";
  const maxDate = (items, pick) => items.reduce((m, x) => {
    const d = pick(x) || "";
    return d > m ? d : m;
  }, "").slice(0, 10);

  const homeLastmod = maxDate(posts, postDate);

  const urls = [
    { loc: `${baseUrl}/`, lastmod: homeLastmod, changefreq: "weekly", priority: "1.0" },
    ...posts.map(p => ({
      loc: `${baseUrl}/${p.slug}/`,
      lastmod: postDate(p).slice(0, 10),
      changefreq: "monthly",
      priority: "0.8",
    })),
    ...pages.map(p => ({
      loc: `${baseUrl}/${p.slug}/`,
      lastmod: (p.updated_at || "").slice(0, 10),
      changefreq: "yearly",
      priority: "0.5",
    })),
    ...tags.map(t => {
      const tagged = posts.filter(p => p.tags?.some(x => x.slug === t.slug));
      return {
        loc: `${baseUrl}/tag/${t.slug}/`,
        lastmod: maxDate(tagged, postDate),
        changefreq: "monthly",
        priority: "0.3",
      };
    }),
  ];

  const body = urls.map(u => `
  <url>
    <loc>${escapeXml(u.loc)}</loc>${u.lastmod ? `
    <lastmod>${escapeXml(u.lastmod)}</lastmod>` : ""}
    <changefreq>${u.changefreq}</changefreq>
    <priority>${u.priority}</priority>
  </url>`).join("");

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${body}
</urlset>`;
}
