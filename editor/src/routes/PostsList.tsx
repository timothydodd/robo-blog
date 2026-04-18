import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Plus, Search } from "lucide-react";
import { api, type PostSummary } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { formatDate, slugify } from "@/lib/utils";
import { useToast } from "@/components/ui/Toast";

interface Props { kind: "posts" | "pages" }

export function PostsList({ kind }: Props) {
  const label = kind === "posts" ? "Posts" : "Pages";
  const [items, setItems] = useState<PostSummary[] | null>(null);
  const [query, setQuery] = useState("");
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    (async () => {
      try {
        const list = kind === "posts" ? await api.listPosts() : await api.listPages();
        setItems(list);
      } catch (e: any) { toast(e.message || "Load failed", "error"); }
    })();
  }, [kind, toast]);

  const filtered = useMemo(() => {
    if (!items) return [];
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((p) =>
      p.title.toLowerCase().includes(q) || p.slug.toLowerCase().includes(q) || (p.tags || []).some(t => t.toLowerCase().includes(q))
    );
  }, [items, query]);

  async function createNew() {
    const title = window.prompt(`New ${kind === "posts" ? "post" : "page"} title`);
    if (!title) return;
    const slug = slugify(title) || `${kind === "posts" ? "post" : "page"}-${Date.now()}`;
    const payload = { title, slug, content: "" };
    try {
      if (kind === "posts") await api.createPost(payload);
      else await api.createPage(payload);
      navigate(`/${kind}/${slug}`);
    } catch (e: any) { toast(e.message || "Create failed", "error"); }
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <header className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{label}</h1>
          <p className="text-sm text-zinc-500 mt-0.5">{items ? `${items.length} total` : " "}</p>
        </div>
        <Button onClick={createNew}><Plus size={14} /> New {kind === "posts" ? "post" : "page"}</Button>
      </header>

      <div className="relative mb-4">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
        <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={`Search ${label.toLowerCase()}…`} className="pl-9" />
      </div>

      <div className="bg-white rounded-xl border border-zinc-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 text-zinc-500 text-xs uppercase tracking-wide">
            <tr>
              <th className="text-left px-4 py-2.5 font-medium">Title</th>
              {kind === "posts" && <th className="text-left px-4 py-2.5 font-medium w-40">Primary tag</th>}
              <th className="text-left px-4 py-2.5 font-medium w-28">Status</th>
              <th className="text-left px-4 py-2.5 font-medium w-36">Published</th>
            </tr>
          </thead>
          <tbody>
            {items === null ? (
              <tr><td colSpan={4} className="p-8 text-center text-zinc-400">Loading…</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={4} className="p-8 text-center text-zinc-400">No {label.toLowerCase()} found.</td></tr>
            ) : filtered.map((p) => (
              <tr key={p.slug} className="border-t border-zinc-100 hover:bg-zinc-50 transition">
                <td className="px-4 py-3">
                  <Link to={`/${kind}/${p.slug}`} className="font-medium text-zinc-900 hover:text-[color:var(--color-brand)]">
                    {p.title}
                  </Link>
                  <div className="text-xs text-zinc-400">{p.slug}</div>
                </td>
                {kind === "posts" && (
                  <td className="px-4 py-3">
                    {p.tags?.[0] ? <Badge tone="brand">{p.tags[0]}</Badge> : <span className="text-zinc-300">—</span>}
                  </td>
                )}
                <td className="px-4 py-3">
                  {p.status === "published" ? <Badge tone="success">Published</Badge>
                    : p.status === "draft" ? <Badge tone="warn">Draft</Badge>
                    : <Badge>{p.status}</Badge>}
                </td>
                <td className="px-4 py-3 text-zinc-500">{formatDate(p.published_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
