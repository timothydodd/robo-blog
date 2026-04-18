import { createContext, useCallback, useContext, useState, type ReactNode } from "react";

type ToastKind = "info" | "success" | "error";
interface ToastItem { id: number; kind: ToastKind; text: string; }

interface ToastCtx { toast: (text: string, kind?: ToastKind) => void; }
const Ctx = createContext<ToastCtx>({ toast: () => {} });

export function useToast() { return useContext(Ctx); }

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const toast = useCallback((text: string, kind: ToastKind = "info") => {
    const id = Date.now() + Math.random();
    setItems((list) => [...list, { id, kind, text }]);
    setTimeout(() => setItems((list) => list.filter((t) => t.id !== id)), 3000);
  }, []);

  return (
    <Ctx.Provider value={{ toast }}>
      {children}
      <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
        {items.map((t) => (
          <div
            key={t.id}
            className={
              "pointer-events-auto min-w-[220px] max-w-sm px-4 py-2.5 rounded-lg shadow-lg border text-sm font-medium " +
              (t.kind === "success"
                ? "bg-emerald-50 border-emerald-200 text-emerald-900"
                : t.kind === "error"
                ? "bg-red-50 border-red-200 text-red-900"
                : "bg-white border-zinc-200 text-zinc-900")
            }
          >
            {t.text}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}
