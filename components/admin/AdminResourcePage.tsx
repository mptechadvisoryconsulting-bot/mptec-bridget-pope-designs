import { notFound } from "next/navigation";
import { ButtonLink } from "@/components/ui/button";
import { createAdminClient } from "@/lib/supabase/admin";

type AdminResourcePageProps = {
  title: string;
  eyebrow: string;
  table: string;
  select?: string;
  detailId?: string;
  columns?: string[];
  detailBaseHref?: string;
  actionHref?: string;
  actionLabel?: string;
};

function formatKey(key: string) {
  return key.replace(/^bpd_/, "").replace(/_/g, " ");
}

function formatValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "Not set";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "number") return String(value);
  if (typeof value === "string") {
    if (/^\d{4}-\d{2}-\d{2}T/.test(value)) return new Date(value).toLocaleString("en-US");
    return value;
  }
  return JSON.stringify(value);
}

function rowKeys(row: Record<string, unknown>, columns?: string[]) {
  if (columns?.length) return columns;
  return Object.keys(row)
    .filter((key) => !["id", "auth_user_id"].includes(key))
    .filter((key) => {
      const value = row[key];
      return value === null || ["string", "number", "boolean"].includes(typeof value);
    })
    .slice(0, 6);
}

export async function AdminResourcePage({
  title,
  eyebrow,
  table,
  select = "*",
  detailId,
  columns,
  detailBaseHref,
  actionHref,
  actionLabel,
}: AdminResourcePageProps) {
  const supabase = createAdminClient();

  if (detailId) {
    const { data: row } = await supabase.from(table).select(select).eq("id", detailId).maybeSingle();
    if (!row) notFound();
    const entries = Object.entries(row as unknown as Record<string, unknown>).filter(([key]) => !key.startsWith("bpd_"));

    return (
      <div>
        <div className="dashboard-topbar">
          <div>
            <span className="eyebrow">{eyebrow}</span>
            <h1>{title}</h1>
          </div>
          {actionHref ? <ButtonLink href={actionHref}>{actionLabel ?? "Open"}</ButtonLink> : null}
        </div>
        <section className="panel">
          <h2>Record Details</h2>
          <dl className="resource-details">
            {entries.map(([key, value]) => (
              <div key={key}>
                <dt>{formatKey(key)}</dt>
                <dd>{formatValue(value)}</dd>
              </div>
            ))}
          </dl>
        </section>
      </div>
    );
  }

  const { data } = await supabase.from(table).select(select).order("created_at", { ascending: false }).limit(25);
  const rows = (data ?? []) as unknown as Array<Record<string, unknown>>;
  const keys = rows[0] ? rowKeys(rows[0], columns) : columns ?? [];

  return (
    <div>
      <div className="dashboard-topbar">
        <div>
          <span className="eyebrow">{eyebrow}</span>
          <h1>{title}</h1>
        </div>
        {actionHref ? <ButtonLink href={actionHref}>{actionLabel ?? "Open"}</ButtonLink> : null}
      </div>
      <section className="panel">
        <h2>{title} Records</h2>
        <table className="table">
          <thead>
            <tr>
              {keys.map((key) => <th key={key}>{formatKey(key)}</th>)}
              {detailBaseHref ? <th /> : null}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={String(row.id)}>
                {keys.map((key) => <td key={key}>{formatValue(row[key])}</td>)}
                {detailBaseHref ? <td><a href={`${detailBaseHref}/${row.id}`}>Open</a></td> : null}
              </tr>
            ))}
            {!rows.length ? (
              <tr>
                <td colSpan={Math.max(1, keys.length + (detailBaseHref ? 1 : 0))}>No records are synced for this area yet.</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </section>
    </div>
  );
}
