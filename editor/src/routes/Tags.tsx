import { useEffect, useState } from "react";
import { Plus, Trash2, Save } from "lucide-react";
import { api, type Tag } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { Input, Label } from "@/components/ui/Input";
import { useToast } from "@/components/ui/Toast";
import { slugify } from "@/lib/utils";

export function Tags() {
  const [tags, setTags] = useState<Tag[]>([]);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => { api.listTags().then(setTags).catch(e => toast(e.message, "error")); }, [toast]);

  function update(i: number, patch: Partial<Tag>) {
    setTags(list => list.map((t, ix) => ix === i ? { ...t, ...patch } : t));
    setDirty(true);
  }
  function add() {
    setTags(list => [...list, { slug: "new-tag", name: "New Tag", description: null }]);
    setDirty(true);
  }
  function remove(i: number) {
    setTags(list => list.filter((_, ix) => ix !== i));
    setDirty(true);
  }
  async function save() {
    setSaving(true);
    try {
      const saved = await api.saveTags(tags);
      setTags(saved);
      setDirty(false);
      toast("Tags saved", "success");
    } catch (e: any) { toast(e.message || "Save failed", "error"); }
    finally { setSaving(false); }
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <header className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Tags</h1>
          <p className="text-sm text-zinc-500 mt-0.5">{tags.length} total</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={add}><Plus size={14} /> Add tag</Button>
          <Button onClick={save} disabled={!dirty || saving}><Save size={14} /> {saving ? "Saving…" : "Save"}</Button>
        </div>
      </header>
      <div className="bg-white rounded-xl border border-zinc-200 divide-y divide-zinc-100">
        {tags.map((t, i) => (
          <div key={i} className="p-4 grid grid-cols-12 gap-3 items-end">
            <div className="col-span-3">
              <Label>Slug</Label>
              <Input value={t.slug} onChange={(e) => update(i, { slug: slugify(e.target.value) })} />
            </div>
            <div className="col-span-3">
              <Label>Name</Label>
              <Input value={t.name} onChange={(e) => update(i, { name: e.target.value })} />
            </div>
            <div className="col-span-5">
              <Label>Description</Label>
              <Input value={t.description || ""} onChange={(e) => update(i, { description: e.target.value || null })} placeholder="Optional" />
            </div>
            <div className="col-span-1 flex justify-end">
              <Button variant="ghost" size="icon" onClick={() => remove(i)} aria-label="Delete"><Trash2 size={15} /></Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
