import { useEffect, useRef, useState } from "react";
import { Hammer, X, CheckCircle2, AlertTriangle, Loader2, Terminal } from "lucide-react";
import { Button } from "./ui/Button";
import { cn } from "@/lib/utils";

type Status = "idle" | "running" | "success" | "failed";

interface LogLine { kind: "stdout" | "stderr" | "meta"; text: string; }

export function BuildPanel() {
  const [status, setStatus] = useState<Status>("idle");
  const [open, setOpen] = useState(false);
  const [lines, setLines] = useState<LogLine[]>([]);
  const [duration, setDuration] = useState<number | null>(null);
  const [lastBuilt, setLastBuilt] = useState<Date | null>(null);
  const [relative, setRelative] = useState("");
  const logRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Relative time ticker for "Last built: 12s ago"
  useEffect(() => {
    if (!lastBuilt) { setRelative(""); return; }
    const update = () => {
      const s = Math.floor((Date.now() - lastBuilt.getTime()) / 1000);
      if (s < 60) setRelative(`${s}s ago`);
      else if (s < 3600) setRelative(`${Math.floor(s / 60)}m ago`);
      else setRelative(`${Math.floor(s / 3600)}h ago`);
    };
    update();
    const id = setInterval(update, 5000);
    return () => clearInterval(id);
  }, [lastBuilt]);

  // Auto-scroll log to bottom
  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [lines]);

  async function build() {
    if (status === "running") return;
    setStatus("running");
    setOpen(true);
    setLines([]);
    setDuration(null);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch("/api/build", { signal: controller.signal });
      if (!res.ok || !res.body) {
        const body = await res.json().catch(() => ({}));
        setLines(l => [...l, { kind: "stderr", text: body.error || `Build request failed (${res.status})` }]);
        setStatus("failed");
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let finalCode: number | null = null;

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split("\n\n");
        buffer = parts.pop() || "";
        for (const part of parts) {
          const line = part.replace(/^data: /, "").trim();
          if (!line) continue;
          try {
            const { type, data } = JSON.parse(line);
            if (type === "stdout" || type === "stderr") {
              const text = String(data).replace(/\n$/, "");
              setLines(l => [...l, { kind: type, text }]);
            } else if (type === "start") {
              setLines(l => [...l, { kind: "meta", text: `build started ${new Date(data.time).toLocaleTimeString()}` }]);
            } else if (type === "done") {
              finalCode = data.code;
              setDuration(data.duration_ms);
              setLines(l => [...l, { kind: "meta", text: `exit ${data.code} in ${(data.duration_ms / 1000).toFixed(1)}s` }]);
            } else if (type === "error") {
              setLines(l => [...l, { kind: "stderr", text: String(data) }]);
            }
          } catch { /* ignore malformed line */ }
        }
      }

      if (finalCode === 0) {
        setStatus("success");
        setLastBuilt(new Date());
      } else {
        setStatus("failed");
      }
    } catch (e: any) {
      if (e.name === "AbortError") setStatus("idle");
      else {
        setLines(l => [...l, { kind: "stderr", text: e.message || String(e) }]);
        setStatus("failed");
      }
    } finally {
      abortRef.current = null;
    }
  }

  function cancel() {
    abortRef.current?.abort();
  }

  return (
    <>
      <div className="p-3 border-t border-zinc-200 space-y-2">
        <Button
          onClick={build}
          disabled={status === "running"}
          className="w-full"
          variant={status === "failed" ? "danger" : "primary"}
        >
          {status === "running" ? (
            <><Loader2 size={14} className="animate-spin" /> Building…</>
          ) : (
            <><Hammer size={14} /> Build site</>
          )}
        </Button>
        <div className="flex items-center justify-between text-[11px] text-zinc-500 px-1">
          <span className="flex items-center gap-1">
            {status === "success" && <CheckCircle2 size={11} className="text-emerald-600" />}
            {status === "failed"  && <AlertTriangle size={11} className="text-red-600" />}
            {status === "success" && (duration != null ? `Built in ${(duration / 1000).toFixed(1)}s` : "Built")}
            {status === "failed"  && "Last build failed"}
            {status === "idle" && (lastBuilt ? `Last built ${relative}` : "Not built this session")}
            {status === "running" && "Running…"}
          </span>
          {lines.length > 0 && status !== "running" && (
            <button onClick={() => setOpen(true)} className="hover:text-[color:var(--color-brand)] inline-flex items-center gap-1">
              <Terminal size={11} /> Log
            </button>
          )}
        </div>
      </div>

      {open && (
        <div className="fixed inset-0 z-40 bg-black/40 flex items-end md:items-center justify-center p-4" onClick={() => status !== "running" && setOpen(false)}>
          <div
            className="bg-zinc-950 text-zinc-100 rounded-xl shadow-2xl w-full max-w-3xl max-h-[70vh] flex flex-col overflow-hidden border border-zinc-800"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-zinc-800">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Terminal size={14} className="text-zinc-400" />
                <span>Build log</span>
                {status === "running" && <Loader2 size={13} className="animate-spin text-zinc-400" />}
                {status === "success" && <CheckCircle2 size={13} className="text-emerald-400" />}
                {status === "failed"  && <AlertTriangle size={13} className="text-red-400" />}
              </div>
              <div className="flex items-center gap-1">
                {status === "running" && (
                  <button onClick={cancel} className="text-xs px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200">Cancel</button>
                )}
                <button onClick={() => setOpen(false)} disabled={status === "running"} className="p-1 rounded hover:bg-zinc-800 disabled:opacity-30" aria-label="Close">
                  <X size={15} />
                </button>
              </div>
            </div>
            <div ref={logRef} className="flex-1 overflow-auto scrollbar-thin font-mono text-[12.5px] leading-relaxed p-4 whitespace-pre-wrap">
              {lines.length === 0 ? (
                <span className="text-zinc-500">Starting build…</span>
              ) : (
                lines.map((l, i) => (
                  <div key={i} className={cn(
                    l.kind === "stderr" ? "text-red-300" :
                    l.kind === "meta"   ? "text-zinc-500 italic" :
                    "text-zinc-200"
                  )}>
                    {l.text}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
