"use client";

import { useEffect, useId, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";

export type QueueAction = {
  label: string;
  href: string;
};

export function QueueItemActions({ actions }: { actions: QueueAction[] }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("mousedown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("mousedown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  if (!actions.length) return null;

  return (
    <div className="queue-actions" ref={rootRef} style={{ position: "relative" }}>
      <button
        aria-controls={menuId}
        aria-expanded={open}
        aria-haspopup="menu"
        className="btn btn-light"
        onClick={() => setOpen((value) => !value)}
        type="button"
      >
        Actions
        <ChevronDown size={14} />
      </button>
      {open ? (
        <div
          className="queue-actions-menu"
          id={menuId}
          role="menu"
          style={{
            position: "absolute",
            right: 0,
            top: "calc(100% + 6px)",
            minWidth: 180,
            zIndex: 20,
            background: "var(--surface, #fff)",
            border: "1px solid var(--border, #e5ddd8)",
            borderRadius: 10,
            boxShadow: "0 10px 30px rgba(40, 24, 20, 0.12)",
            padding: 6,
          }}
        >
          {actions.map((action) => (
            <a
              href={action.href}
              key={`${action.label}-${action.href}`}
              onClick={() => setOpen(false)}
              role="menuitem"
              style={{
                display: "block",
                padding: "8px 10px",
                borderRadius: 8,
                textDecoration: "none",
                color: "inherit",
              }}
            >
              {action.label}
            </a>
          ))}
        </div>
      ) : null}
    </div>
  );
}
