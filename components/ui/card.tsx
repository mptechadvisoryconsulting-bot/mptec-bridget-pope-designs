import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("card", className)} {...props} />;
}

export function CardHeader({ children }: { children: ReactNode }) {
  return <div style={{ marginBottom: 16 }}>{children}</div>;
}

export function CardTitle({ children }: { children: ReactNode }) {
  return <h3 style={{ margin: 0 }}>{children}</h3>;
}

export function CardContent({ children }: { children: ReactNode }) {
  return <div>{children}</div>;
}
