import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type Tone = "default" | "success" | "warn" | "muted" | "brand";

const tones: Record<Tone, string> = {
  default: "bg-zinc-100 text-zinc-700",
  success: "bg-emerald-100 text-emerald-700",
  warn: "bg-amber-100 text-amber-800",
  muted: "bg-zinc-100 text-zinc-500",
  brand: "bg-[#891A43]/10 text-[#891A43]",
};

export function Badge({ tone = "default", className, ...props }: HTMLAttributes<HTMLSpanElement> & { tone?: Tone }) {
  return (
    <span
      className={cn("inline-flex items-center px-2 h-5 rounded-full text-[11px] font-medium uppercase tracking-wide", tones[tone], className)}
      {...props}
    />
  );
}
