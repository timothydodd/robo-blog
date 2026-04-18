import { useEffect, useState } from "react";
import { Save, Plus, Trash2, GripVertical } from "lucide-react";
import { api, type SiteSettings } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { Input, Label, Textarea } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";

type NavKey = "navigation" | "secondary_navigation";

export function Settings() {
  const [site, setSite] = useState<SiteSettings | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => { api.getSite().then(setSite).catch(e => toast(e.message, "error")); }, [toast]);

  function patch(updates: Partial<SiteSettings>) {
    setSite(prev => prev ? { ...prev, ...updates } : prev);
    setDirty(true);
  }

  function updateNav(k: NavKey, i: number, field: "label" | "url", value: string) {
    setSite(prev => {
      if (!prev) return prev;
      const list = [...prev[k]];
      list[i] = { ...list[i], [field]: value };
      return { ...prev, [k]: list };
    });
    setDirty(true);
  }
  function addNavItem(k: NavKey) {
    setSite(prev => prev ? { ...prev, [k]: [...prev[k], { label: "", url: "" }] } : prev);
    setDirty(true);
  }
  function removeNavItem(k: NavKey, i: number) {
    setSite(prev => prev ? { ...prev, [k]: prev[k].filter((_, ix) => ix !== i) } : prev);
    setDirty(true);
  }

  async function save() {
    if (!site) return;
    setSaving(true);
    try { await api.saveSite(site); setDirty(false); toast("Settings saved", "success"); }
    catch (e: any) { toast(e.message || "Save failed", "error"); }
    finally { setSaving(false); }
  }

  if (!site) return <div className="p-8 text-zinc-400">Loading…</div>;

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <header className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Site settings</h1>
          <p className="text-sm text-zinc-500 mt-0.5">Edits apply at the next build.</p>
        </div>
        <Button onClick={save} disabled={!dirty || saving}><Save size={14} /> {saving ? "Saving…" : "Save"}</Button>
      </header>

      <div className="space-y-4">
        <div className="bg-white rounded-xl border border-zinc-200 p-5 space-y-3">
          <div>
            <Label>Site title</Label>
            <Input value={site.title} onChange={(e) => patch({ title: e.target.value })} />
          </div>
          <div>
            <Label>Description</Label>
            <Textarea rows={2} value={site.description || ""} onChange={(e) => patch({ description: e.target.value || null })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Meta title</Label>
              <Input value={site.meta_title || ""} onChange={(e) => patch({ meta_title: e.target.value || null })} />
            </div>
            <div>
              <Label>Site URL</Label>
              <Input value={site.url} onChange={(e) => patch({ url: e.target.value })} />
            </div>
          </div>
          <div>
            <Label>Meta description</Label>
            <Textarea rows={2} value={site.meta_description || ""} onChange={(e) => patch({ meta_description: e.target.value || null })} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label>Accent color</Label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={site.accent_color}
                  onChange={(e) => patch({ accent_color: e.target.value })}
                  className="h-9 w-12 rounded-md border border-zinc-300 cursor-pointer bg-transparent"
                />
                <Input value={site.accent_color} onChange={(e) => patch({ accent_color: e.target.value })} />
              </div>
            </div>
            <div>
              <Label>Locale</Label>
              <Input value={site.locale || ""} onChange={(e) => patch({ locale: e.target.value })} />
            </div>
            <div>
              <Label>Timezone</Label>
              <Input value={site.timezone || ""} onChange={(e) => patch({ timezone: e.target.value })} />
            </div>
          </div>
          <div>
            <Label>Twitter handle</Label>
            <Input value={site.twitter || ""} onChange={(e) => patch({ twitter: e.target.value || null })} placeholder="@handle" />
          </div>
        </div>

        <div className="bg-white rounded-xl border border-zinc-200 p-5 space-y-4">
          <div>
            <h3 className="text-base font-semibold">Code injection</h3>
            <p className="text-xs text-zinc-500 mt-0.5">Raw HTML inserted into every page. For Google Analytics, Plausible, custom meta tags, etc.</p>
          </div>

          <div>
            <Label>Custom CSS</Label>
            <Textarea
              rows={5}
              value={site.custom_css || ""}
              onChange={(e) => patch({ custom_css: e.target.value || null })}
              placeholder=".my-class { color: rebeccapurple; }"
              className="font-mono !text-[13px] leading-relaxed"
              spellCheck={false}
            />
            <p className="mt-1 text-[11px] text-zinc-400">Wrapped automatically in <code>&lt;style&gt;</code> tags. No need to include them.</p>
          </div>

          <div>
            <Label>Site header (HTML)</Label>
            <Textarea
              rows={7}
              value={site.code_injection_head || ""}
              onChange={(e) => patch({ code_injection_head: e.target.value || null })}
              placeholder={'<!-- Google Analytics -->\n<script async src="https://www.googletagmanager.com/gtag/js?id=G-XXXXXX"></script>\n<script>\n  window.dataLayer = window.dataLayer || [];\n  function gtag(){dataLayer.push(arguments);}\n  gtag(\'js\', new Date());\n  gtag(\'config\', \'G-XXXXXX\');\n</script>'}
              className="font-mono !text-[13px] leading-relaxed"
              spellCheck={false}
            />
            <p className="mt-1 text-[11px] text-zinc-400">Injected before <code>&lt;/head&gt;</code>. Use for analytics snippets, fonts, meta tags.</p>
          </div>

          <div>
            <Label>Site footer (HTML)</Label>
            <Textarea
              rows={5}
              value={site.code_injection_foot || ""}
              onChange={(e) => patch({ code_injection_foot: e.target.value || null })}
              placeholder="<!-- Scripts that should load late -->"
              className="font-mono !text-[13px] leading-relaxed"
              spellCheck={false}
            />
            <p className="mt-1 text-[11px] text-zinc-400">Injected before <code>&lt;/body&gt;</code>. Use for late-loading scripts.</p>
          </div>
        </div>

        <NavEditor
          title="Primary navigation"
          items={site.navigation}
          onChange={(i, f, v) => updateNav("navigation", i, f, v)}
          onAdd={() => addNavItem("navigation")}
          onRemove={(i) => removeNavItem("navigation", i)}
        />
        <NavEditor
          title="Footer navigation"
          items={site.secondary_navigation}
          onChange={(i, f, v) => updateNav("secondary_navigation", i, f, v)}
          onAdd={() => addNavItem("secondary_navigation")}
          onRemove={(i) => removeNavItem("secondary_navigation", i)}
        />
      </div>
    </div>
  );
}

function NavEditor({
  title, items, onChange, onAdd, onRemove,
}: {
  title: string;
  items: { label: string; url: string }[];
  onChange: (i: number, field: "label" | "url", v: string) => void;
  onAdd: () => void;
  onRemove: (i: number) => void;
}) {
  return (
    <div className="bg-white rounded-xl border border-zinc-200 p-5 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold">{title}</h3>
        <Button variant="outline" size="sm" onClick={onAdd}><Plus size={13} /> Add</Button>
      </div>
      {items.length === 0 && <p className="text-sm text-zinc-400">No items.</p>}
      <div className="space-y-2">
        {items.map((item, i) => (
          <div key={i} className="flex items-center gap-2">
            <GripVertical size={15} className="text-zinc-300" />
            <Input placeholder="Label" value={item.label} onChange={(e) => onChange(i, "label", e.target.value)} className="w-40" />
            <Input placeholder="https://..." value={item.url} onChange={(e) => onChange(i, "url", e.target.value)} className="flex-1" />
            <Button variant="ghost" size="icon" onClick={() => onRemove(i)} aria-label="Remove"><Trash2 size={15} /></Button>
          </div>
        ))}
      </div>
    </div>
  );
}
