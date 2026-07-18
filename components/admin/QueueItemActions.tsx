"use client";

import { useEffect, useId, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";

export type QueueAction = {
  label: string;
  href: string;
};

export function QueueItemActions({
  primaryAction,
  actions,
}: {
  primaryAction?: QueueAction | null;
  actions: QueueAction[];
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const menuId = useId();

  const secondaryActions = actions.filter(
    (action) => !primaryAction || action.href !== primaryAction.href || action.label !== primaryAction.label,
  );

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

  if (!primaryAction && !secondaryActions.length) return null;

  return (
    <div className="queue-row-actions" ref={rootRef}>
      {primaryAction ? (
        <a className="btn btn-quiet" href={primaryAction.href}>
          {primaryAction.label}
        </a>
      ) : null}
      {secondaryActions.length ? (
        <div className="queue-actions">
          <button
            aria-controls={menuId}
            aria-expanded={open}
            aria-haspopup="menu"
            className="btn btn-quiet queue-actions-trigger"
            onClick={() => setOpen((value) => !value)}
            type="button"
          >
            Actions
            <ChevronDown size={14} aria-hidden="true" />
          </button>
          {open ? (
            <div className="queue-actions-menu" id={menuId} role="menu">
              {secondaryActions.map((action) => (
                <a
                  href={action.href}
                  key={`${action.label}-${action.href}`}
                  onClick={() => setOpen(false)}
                  role="menuitem"
                >
                  {action.label}
                </a>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
