"use client";

import { QueueItemActions } from "@/components/admin/QueueItemActions";

export function ListPageActions({
  primaryAction,
  importHref,
  importLabel = "Import PDF",
  extraActions = [],
}: {
  primaryAction?: { label: string; href: string } | null;
  importHref: string;
  importLabel?: string;
  extraActions?: Array<{ label: string; href: string }>;
}) {
  return (
    <QueueItemActions
      primaryAction={primaryAction}
      actions={[
        { label: importLabel, href: importHref },
        ...extraActions,
      ]}
    />
  );
}
