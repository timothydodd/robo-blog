import { forwardRef, type InputHTMLAttributes, type TextareaHTMLAttributes, type LabelHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

const inputBase = "w-full h-9 px-3 rounded-md border border-zinc-300 bg-white text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-[color:var(--color-brand)]/30 focus:border-[color:var(--color-brand)] transition";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input ref={ref} className={cn(inputBase, className)} {...props} />
  )
);
Input.displayName = "Input";

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => (
    <textarea
      ref={ref}
      className={cn(inputBase, "h-auto min-h-[5rem] py-2 leading-6 resize-y", className)}
      {...props}
    />
  )
);
Textarea.displayName = "Textarea";

export function Label({ className, children, ...props }: LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label className={cn("block text-xs font-medium uppercase tracking-wide text-zinc-500 mb-1", className)} {...props}>
      {children}
    </label>
  );
}
