import { useEffect, useRef, useState } from "react";
import { Upload, Trash2, Copy } from "lucide-react";
import { api, type ImageRecord } from "@/lib/api";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";

export function Images() {
  const [images, setImages] = useState<ImageRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const fileInput = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  async function load() {
    setLoading(true);
    try { setImages(await api.listImages()); } finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    try {
      const n = await api.uploadImages(Array.from(files));
      toast(`Uploaded ${n.length} image${n.length > 1 ? "s" : ""}`, "success");
      await load();
    } catch (e: any) { toast(e.message || "Upload failed", "error"); }
  }

  async function remove(path: string) {
    if (!window.confirm(`Delete ${path}?`)) return;
    try { await api.deleteImage(path); await load(); }
    catch (e: any) { toast(e.message || "Delete failed", "error"); }
  }

  function copy(path: string) {
    navigator.clipboard.writeText(path);
    toast("Copied path", "success");
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <header className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Images</h1>
          <p className="text-sm text-zinc-500 mt-0.5">{loading ? "Loading…" : `${images.length} total`}</p>
        </div>
        <Button onClick={() => fileInput.current?.click()}>
          <Upload size={14} /> Upload
        </Button>
        <input ref={fileInput} type="file" accept="image/*" multiple hidden onChange={(e) => { upload(e.target.files); e.target.value = ""; }} />
      </header>
      {images.length === 0 && !loading ? (
        <p className="text-zinc-400 p-8 text-center bg-white rounded-xl border border-zinc-200">No images yet.</p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {images.map((img) => (
            <div key={img.path} className="group relative aspect-square bg-white border border-zinc-200 rounded-lg overflow-hidden">
              <img src={img.url} alt="" className="w-full h-full object-cover" loading="lazy" />
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent p-2 opacity-0 group-hover:opacity-100 transition">
                <div className="text-[11px] text-white truncate mb-1">{img.path}</div>
                <div className="flex gap-1.5">
                  <button onClick={() => copy(img.path)} className="flex-1 text-[11px] bg-white/90 hover:bg-white rounded px-2 py-1 inline-flex items-center justify-center gap-1"><Copy size={11} /> Copy</button>
                  <button onClick={() => remove(img.path)} className="text-[11px] bg-red-500/90 hover:bg-red-500 text-white rounded px-2 py-1 inline-flex items-center justify-center"><Trash2 size={11} /></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
