import type { ReactNode } from "react";

export function Tabs({ children }: { children: ReactNode }) {
  return <div>{children}</div>;
}

export function TabsList({ children }: { children: ReactNode }) {
  return <div className="gallery-tabs">{children}</div>;
}

export function TabsTrigger({ children }: { children: ReactNode }) {
  return <button className="pill">{children}</button>;
}

export function TabsContent({ children }: { children: ReactNode }) {
  return <div>{children}</div>;
}
