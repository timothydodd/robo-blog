import { useEffect, useRef, useState } from "react";
import { Upload, X, ImagePlus } from "lucide-react";
import { api, type ImageRecord } from "@/lib/api";
import { Button } from "./ui/Button";

interface Props {
  value: string | null;
  onChange: (path: string | null) => void;
}

export function ImagePicker({ value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [images, setImages] = useState<ImageRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  async function load() {
    setLoading(true);
    try { setImages(await api.listImages()); } finally { setLoading(false); }
  }

  useEffect(() => { if (open) load(); }, [open]);

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    const uploaded = await api.uploadImages(Array.from(files));
    if (uploaded[0]) onChange(uploaded[0].path);
    await load();
  }

  return (
    <div>
      <div className="aspect-video rounded-lg border border-dashed border-zinc-300 bg-zinc-50 overflow-hidden relative group">
        {value ? (
          <>
            <img src={value} alt="" className="w-full h-full object-cover" />
            <button
              type="button"
              onClick={() => onChange(null)}
              className="absolute top-2 right-2 bg-black/60 text-white rounded-full w-7 h-7 flex items-center justify-center opacity-0 group-hover:opacity-100 transition"
              aria-label="Remove image"
            >
              <X size={14} />
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="w-full h-full flex flex-col items-center justify-center text-zinc-400 hover:text-[color:var(--color-brand)] hover:bg-white transition"
          >
            <ImagePlus size={26} />
            <span className="text-xs mt-1.5">Choose feature image</span>
          </button>
        )}
      </div>
      <div className="flex items-center gap-2 mt-2">
        <Button type="button" variant="outline" size="sm" onClick={() => fileInput.current?.click()}>
          <Upload size={14} /> Upload
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(true)}>
          Library
        </Button>
        <input ref={fileInput} type="file" accept="image/*" hidden onChange={(e) => { upload(e.target.files); e.target.value = ""; }} />
      </div>

      {open && (
        <div className="fixed inset-0 z-40 bg-black/40 flex items-center justify-center p-6" onClick={() => setOpen(false)}>
          <div
            className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[80vh] flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 border-b border-zinc-200 flex items-center justify-between">
              <h3 className="text-base font-semibold">Image library</h3>
              <div className="flex items-center gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => fileInput.current?.click()}>
                  <Upload size={14} /> Upload
                </Button>
                <button className="p-1 rounded hover:bg-zinc-100" onClick={() => setOpen(false)} aria-label="Close">
                  <X size={16} />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-auto scrollbar-thin p-4">
              {loading ? (
                <p className="text-sm text-zinc-500">Loading…</p>
              ) : images.length === 0 ? (
                <p className="text-sm text-zinc-500">No images yet. Upload some.</p>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {images.map((img) => (
                    <button
                      key={img.path}
                      type="button"
                      onClick={() => { onChange(img.path); setOpen(false); }}
                      className="group relative aspect-square rounded-lg overflow-hidden border border-zinc-200 bg-zinc-50 hover:border-[color:var(--color-brand)]"
                      title={img.path}
                    >
                      <img src={img.url} alt="" className="w-full h-full object-cover" />
                      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent text-white text-[11px] text-left px-2 py-1 opacity-0 group-hover:opacity-100 transition truncate">
                        {img.path.replace(/^\/images\//, "")}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
