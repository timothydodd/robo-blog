import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Save, Trash2, ExternalLink, Share2 } from "lucide-react";
import { api, type Post, type SiteSettings, type Tag } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { Input, Label, Textarea } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { MarkdownEditor } from "@/components/MarkdownEditor";
import { TagMultiSelect } from "@/components/TagMultiSelect";
import { ImagePicker } from "@/components/ImagePicker";
import { useToast } from "@/components/ui/Toast";
import { formatDateTimeLocal, localToIso, slugify } from "@/lib/utils";
import { confirmDiscard, setDirty as setGlobalDirty } from "@/lib/dirty";

interface Props { kind: "posts" | "pages" }

export function PostEdit({ kind }: Props) {
  const { slug = "" } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [post, setPost] = useState<Post | null>(null);
  const [tags, setTags] = useState<Tag[]>([]);
  const [site, setSite] = useState<SiteSettings | null>(null);
  const [slugEdited, setSlugEdited] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [p, t, s] = await Promise.all([
          kind === "posts" ? api.getPost(slug) : api.getPage(slug),
          api.listTags(),
          api.getSite(),
        ]);
        setPost(p);
        setTags(t);
        setSite(s);
        setDirty(false);
        setSlugEdited(false);
      } catch (e: any) { toast(e.message || "Load failed", "error"); }
    })();
  }, [slug, kind, toast]);

  const patch = useCallback((updates: Partial<Post>) => {
    setPost(prev => prev ? { ...prev, ...updates } : prev);
    setDirty(true);
  }, []);

  const save = useCallback(async () => {
    if (!post) return;
    setSaving(true);
    try {
      const saved = kind === "posts"
        ? await api.savePost(slug, post)
        : await api.savePage(slug, post);
      toast("Saved", "success");
      setDirty(false);
      if (saved.slug !== slug) navigate(`/${kind}/${saved.slug}`, { replace: true });
    } catch (e: any) { toast(e.message || "Save failed", "error"); }
    finally { setSaving(false); }
  }, [post, slug, kind, navigate, toast]);

  // Ctrl/Cmd+S
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault(); save();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [save]);

  // Publish dirty state outward + warn on tab-close/refresh while unsaved
  useEffect(() => {
    setGlobalDirty(dirty);
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
    };
  }, [dirty]);

  // Clear on unmount so the next screen doesn't inherit a stale flag
  useEffect(() => () => { setGlobalDirty(false); }, []);

  function goBack() {
    if (!confirmDiscard()) return;
    navigate(`/${kind}`);
  }

  function announceOnX() {
    if (!post || !site) return;
    const base = site.url.replace(/\/$/, "");
    const url = `${base}/${post.slug}/`;
    const primaryTag = post.tags?.[0];
    const hashtag = primaryTag ? ` #${primaryTag.replace(/-/g, "")}` : "";
    const handle = site.twitter ? ` via ${site.twitter}` : "";
    const maxTitle = 240 - url.length - hashtag.length - handle.length - 2;
    const title = post.title.length > maxTitle ? post.title.slice(0, maxTitle - 1) + "…" : post.title;
    const text = `${title}${hashtag}${handle}`;
    const intent = `https://x.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`;
    window.open(intent, "_blank", "noopener,noreferrer");
  }

  async function remove() {
    if (!post) return;
    if (!window.confirm(`Delete "${post.title}"? This cannot be undone.`)) return;
    try {
      if (kind === "posts") await api.deletePost(slug);
      else await api.deletePage(slug);
      setGlobalDirty(false);
      navigate(`/${kind}`);
    } catch (e: any) { toast(e.message || "Delete failed", "error"); }
  }

  if (!post) return <div className="p-8 text-zinc-400">Loading…</div>;

  return (
    <div className="max-w-7xl mx-auto p-6">
      <header className="flex items-center justify-between mb-5 gap-3">
        <Button variant="ghost" size="sm" onClick={goBack}>
          <ArrowLeft size={15} /> All {kind}
        </Button>
        <div className="flex items-center gap-2">
          {post.status === "published" && (
            <a href={`/${post.slug}/`} target="_blank" rel="noreferrer" className="text-xs text-zinc-500 hover:text-[color:var(--color-brand)] inline-flex items-center gap-1">
              <ExternalLink size={12} /> View live
            </a>
          )}
          {kind === "posts" && post.status === "published" && site && (
            <Button variant="ghost" size="sm" onClick={announceOnX} title="Open X with a pre-filled announcement for this post">
              <Share2 size={14} /> Announce on X
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={remove}><Trash2 size={14} /> Delete</Button>
          <Button onClick={save} disabled={saving || !dirty}>
            <Save size={14} /> {saving ? "Saving…" : dirty ? "Save" : "Saved"}
          </Button>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-6">
        <section className="space-y-4 min-w-0">
          <Input
            value={post.title}
            onChange={(e) => {
              const title = e.target.value;
              patch(slugEdited ? { title } : { title, slug: slugify(title) || post.slug });
            }}
            placeholder="Title"
            className="!h-auto !py-3 !text-2xl font-bold !border-transparent focus:!border-zinc-300 focus:!ring-0 !bg-transparent !px-0"
          />

          <MarkdownEditor
            value={post.content}
            onChange={(content) => patch({ content })}
            placeholder="Write something compelling…"
          />
        </section>

        <aside className="space-y-4">
          <div className="bg-white rounded-xl border border-zinc-200 p-5 space-y-4">
            <div>
              <Label htmlFor="slug">Slug</Label>
              <Input
                id="slug"
                value={post.slug}
                onChange={(e) => { setSlugEdited(true); patch({ slug: slugify(e.target.value) }); }}
              />
            </div>
            <div>
              <Label htmlFor="status">Status</Label>
              <Select id="status" value={post.status} onChange={(e) => patch({ status: e.target.value as Post["status"] })}>
                <option value="draft">Draft</option>
                <option value="published">Published</option>
              </Select>
            </div>
            <div>
              <Label htmlFor="published">Publish date</Label>
              <Input
                id="published" type="datetime-local"
                value={formatDateTimeLocal(post.published_at)}
                onChange={(e) => patch({ published_at: localToIso(e.target.value) })}
              />
            </div>
            {kind === "posts" && (
              <label className="flex items-center gap-2 text-sm text-zinc-700">
                <input
                  type="checkbox"
                  checked={!!post.featured}
                  onChange={(e) => patch({ featured: e.target.checked })}
                  className="h-4 w-4 accent-[color:var(--color-brand)]"
                />
                Featured
              </label>
            )}
          </div>

          <div className="bg-white rounded-xl border border-zinc-200 p-5 space-y-3">
            <Label>Feature image</Label>
            <ImagePicker
              value={post.feature_image || null}
              onChange={(p) => patch({ feature_image: p })}
            />
            {post.feature_image && (
              <Input
                value={post.feature_image_alt || ""}
                onChange={(e) => patch({ feature_image_alt: e.target.value || null })}
                placeholder="Alt text"
              />
            )}
          </div>

          <div className="bg-white rounded-xl border border-zinc-200 p-5 space-y-3">
            <Label>Excerpt</Label>
            <Textarea
              rows={3}
              value={post.excerpt || ""}
              onChange={(e) => patch({ excerpt: e.target.value || null })}
              placeholder="Optional — otherwise auto-generated from content"
            />
          </div>

          {kind === "posts" && (
            <div className="bg-white rounded-xl border border-zinc-200 p-5 space-y-3">
              <Label>Tags</Label>
              <TagMultiSelect
                value={post.tags || []}
                onChange={(next) => patch({ tags: next })}
                tags={tags}
              />
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
