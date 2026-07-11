import type { ReactNode } from "react";

export function Dialog({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

export function DialogContent({ children }: { children: ReactNode }) {
  return <div className="card" role="dialog">{children}</div>;
}
