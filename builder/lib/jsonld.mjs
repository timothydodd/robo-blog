// JSON-LD (schema.org) payload builder. Emitted in <head> to help search
// engines understand posts as BlogPosting, pages as WebPage, and the home
// feed as WebSite. Kept minimal — add fields when there's a real consumer.

function stripUndef(obj) {
  if (Array.isArray(obj)) return obj.map(stripUndef).filter(v => v !== undefined);
  if (obj && typeof obj === "object") {
    const out = {};
    for (const [k, v] of Object.entries(obj)) {
      const cleaned = stripUndef(v);
      if (cleaned !== undefined && cleaned !== null && cleaned !== "") out[k] = cleaned;
    }
    return Object.keys(out).length ? out : undefined;
  }
  return obj;
}

function serialize(obj) {
  // Escape </script> sequences inside string values so the payload can't
  // break out of its <script> tag.
  return JSON.stringify(stripUndef(obj)).replace(/<\/(script)/gi, "<\\/$1");
}

function absUrl(baseUrl, p) {
  if (!p) return undefined;
  if (/^https?:/i.test(p)) return p;
  if (!p.startsWith("/")) p = "/" + p;
  return baseUrl.replace(/\/$/, "") + p;
}

function publisher(site, baseUrl) {
  return {
    "@type": "Organization",
    name: site.title,
    url: baseUrl,
    logo: site.icon ? { "@type": "ImageObject", url: absUrl(baseUrl, site.icon) } : undefined,
  };
}

export function buildArticleJsonLd({ site, post, canonical, baseUrl }) {
  return serialize({
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    mainEntityOfPage: { "@type": "WebPage", "@id": canonical },
    headline: post.title,
    description: post.excerpt || undefined,
    image: post.feature_image ? absUrl(baseUrl, post.feature_image) : undefined,
    author: { "@type": "Person", name: "Timothy Dodd", url: baseUrl },
    publisher: publisher(site, baseUrl),
    datePublished: post.published_at,
    dateModified: post.updated_at || post.published_at,
    keywords: post.tags && post.tags.length ? post.tags.map(t => t.name).join(", ") : undefined,
    articleSection: post.primary_tag ? post.primary_tag.name : undefined,
  });
}

export function buildPageJsonLd({ site, page, canonical, baseUrl }) {
  return serialize({
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: page.title,
    url: canonical,
    description: page.excerpt || site.description,
    isPartOf: { "@type": "WebSite", name: site.title, url: baseUrl },
  });
}

export function buildWebsiteJsonLd({ site, baseUrl }) {
  return serialize({
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: site.title,
    url: baseUrl,
    description: site.description,
    publisher: publisher(site, baseUrl),
  });
}
