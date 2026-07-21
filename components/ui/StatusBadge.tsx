import { formatStatusLabel, statusBadgeClassName } from "@/lib/status-display";

export function StatusBadge({
  status,
  label,
  className,
}: {
  status: string;
  /** Optional override when the visible label is not a direct status map (e.g. counts). */
  label?: string;
  className?: string;
}) {
  return (
    <span className={[statusBadgeClassName(status), className].filter(Boolean).join(" ")}>
      {label ?? formatStatusLabel(status)}
    </span>
  );
}
