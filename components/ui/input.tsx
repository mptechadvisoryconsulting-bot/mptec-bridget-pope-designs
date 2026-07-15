import type { InputHTMLAttributes, Ref, TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function Input({ className, ref, ...props }: InputHTMLAttributes<HTMLInputElement> & { ref?: Ref<HTMLInputElement> }) {
  return <input className={cn("input", className)} ref={ref} suppressHydrationWarning {...props} />;
}

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn("textarea", className)} suppressHydrationWarning {...props} />;
}
