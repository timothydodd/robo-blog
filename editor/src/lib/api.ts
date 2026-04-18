export interface PostSummary {
  slug: string;
  title: string;
  status: "draft" | "published" | "scheduled";
  published_at?: string | null;
  updated_at?: string | null;
  feature_image?: string | null;
  featured?: boolean;
  tags?: string[];
  excerpt?: string | null;
}

export interface Post extends PostSummary {
  content: string;
  feature_image_alt?: string | null;
  feature_image_caption?: string | null;
  created_at?: string;
}

export interface Tag { slug: string; name: string; description?: string | null; }

export interface Author {
  name: string;
  avatar?: string | null;
  bio?: string | null;
  url?: string | null;
}

export interface SiteSettings {
  title: string;
  description?: string | null;
  meta_title?: string | null;
  meta_description?: string | null;
  url: string;
  accent_color: string;
  icon?: string | null;
  cover_image?: string | null;
  logo?: string | null;
  timezone?: string;
  locale?: string;
  twitter?: string | null;
  facebook?: string | null;
  author?: Author | null;
  navigation: { label: string; url: string }[];
  secondary_navigation: { label: string; url: string }[];
  custom_css?: string | null;
  code_injection_head?: string | null;
  code_injection_foot?: string | null;
}

export interface ImageRecord { path: string; url: string; size: number; mtime: string; }

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
    ...init,
  });
  if (!res.ok) {
    let msg = res.statusText;
    try { const b = await res.json(); msg = b.error || msg; } catch {}
    throw new Error(msg);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export const api = {
  // Posts
  listPosts: () => request<PostSummary[]>("/api/posts"),
  getPost: (slug: string) => request<Post>(`/api/posts/${slug}`),
  savePost: (slug: string, p: Partial<Post>) => request<Post>(`/api/posts/${slug}`, { method: "PUT", body: JSON.stringify(p) }),
  createPost: (p: Partial<Post>) => request<Post>("/api/posts", { method: "POST", body: JSON.stringify(p) }),
  deletePost: (slug: string) => request<void>(`/api/posts/${slug}`, { method: "DELETE" }),

  // Pages
  listPages: () => request<PostSummary[]>("/api/pages"),
  getPage: (slug: string) => request<Post>(`/api/pages/${slug}`),
  savePage: (slug: string, p: Partial<Post>) => request<Post>(`/api/pages/${slug}`, { method: "PUT", body: JSON.stringify(p) }),
  createPage: (p: Partial<Post>) => request<Post>("/api/pages", { method: "POST", body: JSON.stringify(p) }),
  deletePage: (slug: string) => request<void>(`/api/pages/${slug}`, { method: "DELETE" }),

  // Tags
  listTags: () => request<Tag[]>("/api/tags"),
  saveTags: (tags: Tag[]) => request<Tag[]>("/api/tags", { method: "PUT", body: JSON.stringify(tags) }),

  // Site
  getSite: () => request<SiteSettings>("/api/site"),
  saveSite: (s: SiteSettings) => request<SiteSettings>("/api/site", { method: "PUT", body: JSON.stringify(s) }),

  // Images
  listImages: () => request<ImageRecord[]>("/api/images"),
  uploadImages: async (files: File[]): Promise<{ path: string; url: string }[]> => {
    const fd = new FormData();
    for (const f of files) fd.append("file", f);
    const res = await fetch("/api/images", { method: "POST", body: fd });
    if (!res.ok) throw new Error(`Upload failed: ${res.statusText}`);
    return res.json();
  },
  deleteImage: (path: string) => request<void>(`/api/images/${path.replace(/^\/images\//, "")}`, { method: "DELETE" }),
};
