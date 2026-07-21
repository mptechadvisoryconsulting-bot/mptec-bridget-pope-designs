"use client";

import { ChevronDown } from "lucide-react";
import { useEffect, useId, useState, type ReactNode } from "react";

function hashMatches(panelId: string) {
  if (typeof window === "undefined") return false;
  const hash = window.location.hash.replace(/^#/, "");
  return hash === panelId;
}

export function CollapsibleImportPanel({
  id,
  title,
  description,
  children,
  defaultOpen = false,
}: {
  id: string;
  title: string;
  description?: string;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const contentId = useId();

  useEffect(() => {
    function syncFromHash() {
      if (hashMatches(id)) {
        setOpen(true);
        requestAnimationFrame(() => {
          document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
        });
      }
    }

    syncFromHash();
    window.addEventListener("hashchange", syncFromHash);
    return () => window.removeEventListener("hashchange", syncFromHash);
  }, [id]);

  return (
    <section className="panel collapsible-import-panel" id={id}>
      <button
        aria-controls={contentId}
        aria-expanded={open}
        className="collapsible-import-trigger"
        onClick={() => setOpen((current) => !current)}
        type="button"
      >
        <span>
          <strong>{title}</strong>
          {description ? <span className="mini-meta">{description}</span> : null}
        </span>
        <ChevronDown aria-hidden="true" className={open ? "chevron open" : "chevron"} size={16} />
      </button>
      {open ? (
        <div className="collapsible-import-body" id={contentId}>
          {children}
        </div>
      ) : null}
    </section>
  );
}
