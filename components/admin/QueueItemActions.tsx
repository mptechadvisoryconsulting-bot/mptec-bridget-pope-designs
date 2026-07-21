"use client";

import { useEffect, useId, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";

export type QueueAction = {
  label: string;
  href?: string;
  onSelect?: () => void | Promise<void>;
  disabled?: boolean;
  destructive?: boolean;
};

function actionKey(action: QueueAction, index: number) {
  return `${action.label}-${action.href ?? "action"}-${index}`;
}

export function QueueItemActions({
  primaryAction,
  actions,
}: {
  primaryAction?: QueueAction | null;
  actions: QueueAction[];
}) {
  const [open, setOpen] = useState(false);
  const [busyLabel, setBusyLabel] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const menuId = useId();

  const secondaryActions = actions.filter((action) => {
    if (!primaryAction) return true;
    if (action.href && primaryAction.href && action.href === primaryAction.href && action.label === primaryAction.label) {
      return false;
    }
    if (!action.href && !primaryAction.href && action.label === primaryAction.label && action.onSelect === primaryAction.onSelect) {
      return false;
    }
    return true;
  });

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

  async function runAction(action: QueueAction) {
    if (action.disabled || busyLabel) return;
    if (action.href && !action.onSelect) {
      setOpen(false);
      window.location.href = action.href;
      return;
    }
    if (!action.onSelect) return;
    setBusyLabel(action.label);
    try {
      await action.onSelect();
      setOpen(false);
    } finally {
      setBusyLabel(null);
    }
  }

  if (!primaryAction && !secondaryActions.length) return null;

  return (
    <div className="queue-row-actions" ref={rootRef}>
      {primaryAction ? (
        primaryAction.href && !primaryAction.onSelect ? (
          <a className="btn btn-primary" href={primaryAction.href}>
            {primaryAction.label}
          </a>
        ) : (
          <button
            className="btn btn-primary"
            disabled={primaryAction.disabled || Boolean(busyLabel)}
            onClick={() => void runAction(primaryAction)}
            type="button"
          >
            {busyLabel === primaryAction.label ? "Working..." : primaryAction.label}
          </button>
        )
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
              {secondaryActions.map((action, index) => {
                const className = [
                  action.destructive ? "is-destructive" : "",
                  action.disabled || busyLabel ? "is-disabled" : "",
                ]
                  .filter(Boolean)
                  .join(" ");

                if (action.href && !action.onSelect) {
                  return (
                    <a
                      className={className || undefined}
                      href={action.disabled ? undefined : action.href}
                      key={actionKey(action, index)}
                      onClick={() => setOpen(false)}
                      role="menuitem"
                    >
                      {action.label}
                    </a>
                  );
                }

                return (
                  <button
                    className={className || undefined}
                    disabled={action.disabled || Boolean(busyLabel)}
                    key={actionKey(action, index)}
                    onClick={() => void runAction(action)}
                    role="menuitem"
                    type="button"
                  >
                    {busyLabel === action.label ? "Working..." : action.label}
                  </button>
                );
              })}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
