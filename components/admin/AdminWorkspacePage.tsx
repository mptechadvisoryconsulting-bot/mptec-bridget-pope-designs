import { notFound } from "next/navigation";
import { ButtonLink } from "@/components/ui/button";
import { createAdminClient } from "@/lib/supabase/admin";

type AdminWorkspaceColumn = {
  key: string;
  label: string;
  format?: "currency" | "date" | "datetime" | "status" | "boolean" | "text";
};

type AdminWorkspacePageProps = {
  title: string;
  eyebrow: string;
  description: string;
  table: string;
  select?: string;
  detailId?: string;
  columns?: AdminWorkspaceColumn[];
  detailBaseHref?: string;
  actionHref?: string;
  actionLabel?: string;
  emptyTitle: string;
  emptyDescription: string;
};

function titleCase(value: string) {
  return value.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function currency(value: unknown) {
  const amount = Number(value ?? 0);
  return amount.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

function nestedValue(row: Record<string, unknown>, key: string): unknown {
  return key.split(".").reduce<unknown>((current, part) => {
    if (Array.isArray(current)) return nestedValue((current[0] ?? {}) as Record<string, unknown>, part);
    if (current && typeof current === "object") return (current as Record<string, unknown>)[part];
    return undefined;
  }, row);
}

function formatValue(value: unknown, format: AdminWorkspaceColumn["format"] = "text"): string {
  if (value === null || value === undefined || value === "") return "Not set";
  if (Array.isArray(value)) return value.map((item) => formatValue(item, format)).join(", ");
  if (typeof value === "object") {
    const values = Object.entries(value as Record<string, unknown>)
      .filter(([key]) => !["id", "auth_user_id"].includes(key))
      .map(([, nested]) => nested)
      .filter((nested) => nested !== null && nested !== undefined && nested !== "")
      .slice(0, 3);
    return values.length ? values.map((nested) => formatValue(nested)).join(" / ") : "Linked record";
  }

  if (format === "boolean") return value ? "Yes" : "No";
  if (format === "currency") return currency(value);
  if (format === "date" && typeof value === "string") return new Date(`${value}T12:00:00`).toLocaleDateString("en-US");
  if (format === "datetime" && typeof value === "string") return new Date(value).toLocaleString("en-US");
  if (format === "status" && typeof value === "string") return titleCase(value);
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return String(value);
}

function detailColumns(row: Record<string, unknown>, columns?: AdminWorkspaceColumn[]) {
  if (columns?.length) return columns;

  return Object.keys(row)
    .filter((key) => !["id", "auth_user_id"].includes(key))
    .filter((key) => {
      const value = row[key];
      return value === null || ["string", "number", "boolean"].includes(typeof value);
    })
    .slice(0, 12)
    .map((key) => ({ key, label: titleCase(key), format: key.includes("status") ? "status" : "text" }) satisfies AdminWorkspaceColumn);
}

export async function AdminWorkspacePage({
  title,
  eyebrow,
  description,
  table,
  select = "*",
  detailId,
  columns,
  detailBaseHref,
  actionHref,
  actionLabel,
  emptyTitle,
  emptyDescription,
}: AdminWorkspacePageProps) {
  const supabase = createAdminClient();

  if (detailId) {
    const { data: row } = await supabase.from(table).select(select).eq("id", detailId).maybeSingle();
    if (!row) notFound();
    const record = row as unknown as Record<string, unknown>;
    const visibleColumns = detailColumns(record, columns);

    return (
      <div>
        <div className="dashboard-topbar">
          <div>
            <span className="eyebrow">{eyebrow}</span>
            <h1>{title}</h1>
            <p className="mini-meta">{description}</p>
          </div>
          {actionHref ? <ButtonLink href={actionHref}>{actionLabel ?? "Open"}</ButtonLink> : null}
        </div>
        <section className="panel">
          <h2>Workspace Details</h2>
          <dl className="resource-details">
            {visibleColumns.map((column) => (
              <div key={column.key}>
                <dt>{column.label}</dt>
                <dd>{formatValue(nestedValue(record, column.key), column.format)}</dd>
              </div>
            ))}
          </dl>
        </section>
      </div>
    );
  }

  const { data } = await supabase.from(table).select(select).order("created_at", { ascending: false }).limit(50);
  const rows = (data ?? []) as unknown as Array<Record<string, unknown>>;
  const visibleColumns = columns ?? (rows[0] ? detailColumns(rows[0]).slice(0, 6) : []);

  return (
    <div>
      <div className="dashboard-topbar">
        <div>
          <span className="eyebrow">{eyebrow}</span>
          <h1>{title}</h1>
          <p className="mini-meta">{description}</p>
        </div>
        {actionHref ? <ButtonLink href={actionHref}>{actionLabel ?? "Open"}</ButtonLink> : null}
      </div>
      <section className="panel">
        <h2>{title}</h2>
        <table className="table">
          <thead>
            <tr>
              {visibleColumns.map((column) => <th key={column.key}>{column.label}</th>)}
              {detailBaseHref ? <th /> : null}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={String(row.id)}>
                {visibleColumns.map((column) => (
                  <td key={column.key}>{formatValue(nestedValue(row, column.key), column.format)}</td>
                ))}
                {detailBaseHref ? <td><a href={`${detailBaseHref}/${row.id}`}>Open</a></td> : null}
              </tr>
            ))}
            {!rows.length ? (
              <tr>
                <td colSpan={Math.max(1, visibleColumns.length + (detailBaseHref ? 1 : 0))}>
                  <strong>{emptyTitle}</strong>
                  <div className="mini-meta">{emptyDescription}</div>
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </section>
    </div>
  );
}
