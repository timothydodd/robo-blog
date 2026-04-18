import { useMemo, useRef, useState } from "react";
import { X, Plus } from "lucide-react";
import { cn, slugify } from "@/lib/utils";
import type { Tag } from "@/lib/api";

interface Props {
  value: string[];                 // ordered list of tag slugs
  onChange: (next: string[]) => void;
  tags: Tag[];
  placeholder?: string;
}

export function TagMultiSelect({ value, onChange, tags, placeholder }: Props) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const tagsBySlug = useMemo(() => new Map(tags.map(t => [t.slug, t])), [tags]);

  const suggestions = useMemo(() => {
    const q = query.trim().toLowerCase();
    const picked = new Set(value);
    let list = tags.filter(t => !picked.has(t.slug));
    if (q) list = list.filter(t => t.slug.includes(q) || t.name.toLowerCase().includes(q));
    return list.slice(0, 10);
  }, [tags, value, query]);

  const canCreate = useMemo(() => {
    const slug = slugify(query);
    return slug && !tagsBySlug.has(slug) && !value.includes(slug);
  }, [query, tagsBySlug, value]);

  function add(slug: string) {
    if (!slug || value.includes(slug)) return;
    onChange([...value, slug]);
    setQuery("");
  }
  function remove(slug: string) {
    onChange(value.filter(s => s !== slug));
  }

  return (
    <div ref={containerRef} className="relative" onBlur={(e) => {
      if (!containerRef.current?.contains(e.relatedTarget as Node | null)) setOpen(false);
    }}>
      <div
        className={cn(
          "min-h-9 w-full rounded-md border border-zinc-300 bg-white px-2 py-1 flex flex-wrap gap-1 items-center",
          open ? "ring-2 ring-[color:var(--color-brand)]/30 border-[color:var(--color-brand)]" : ""
        )}
        onClick={() => setOpen(true)}
      >
        {value.map((slug, i) => {
          const t = tagsBySlug.get(slug);
          const primary = i === 0;
          return (
            <span
              key={slug}
              className={cn(
                "inline-flex items-center gap-1 h-6 px-2 rounded-full text-xs",
                primary ? "bg-[#891A43] text-white" : "bg-zinc-100 text-zinc-800"
              )}
            >
              {t?.name || slug}
              <button type="button" onClick={(e) => { e.stopPropagation(); remove(slug); }} className="opacity-70 hover:opacity-100" aria-label={`Remove ${slug}`}>
                <X size={12} />
              </button>
            </span>
          );
        })}
        <input
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "Backspace" && !query && value.length) {
              e.preventDefault();
              onChange(value.slice(0, -1));
            } else if (e.key === "Enter") {
              e.preventDefault();
              if (suggestions[0]) add(suggestions[0].slug);
              else if (canCreate) add(slugify(query));
            }
          }}
          placeholder={value.length ? "" : (placeholder || "Add tags…")}
          className="flex-1 min-w-[120px] h-7 px-1 text-sm bg-transparent outline-none"
        />
      </div>
      {open && (suggestions.length > 0 || canCreate) && (
        <div className="absolute z-20 left-0 right-0 mt-1 bg-white border border-zinc-200 rounded-md shadow-lg max-h-60 overflow-auto scrollbar-thin">
          {suggestions.map((t) => (
            <button
              key={t.slug} type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => add(t.slug)}
              className="w-full text-left px-3 py-2 text-sm hover:bg-zinc-50 flex items-center justify-between"
            >
              <span>{t.name}</span>
              <span className="text-xs text-zinc-400">{t.slug}</span>
            </button>
          ))}
          {canCreate && (
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => add(slugify(query))}
              className="w-full text-left px-3 py-2 text-sm hover:bg-zinc-50 flex items-center gap-2 text-[color:var(--color-brand)] font-medium border-t border-zinc-100"
            >
              <Plus size={14} />
              Create tag "{slugify(query)}"
            </button>
          )}
        </div>
      )}
      {value.length > 0 && (
        <p className="mt-1.5 text-xs text-zinc-500">First tag is the primary tag (shown on cards).</p>
      )}
    </div>
  );
}
