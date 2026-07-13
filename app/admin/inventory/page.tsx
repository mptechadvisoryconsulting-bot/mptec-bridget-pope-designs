import { currency } from "@/lib/currency";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type InventoryRow = {
  id: string;
  name: string;
  category?: string | null;
  quantity_total?: number | null;
  quantity_available?: number | null;
  replacement_value?: number | null;
  active?: boolean | null;
};

export default async function InventoryPage() {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("inventory_items")
    .select("id,name,category,quantity_total,quantity_available,replacement_value,active")
    .order("category", { ascending: true })
    .limit(200);

  const items = (data ?? []) as InventoryRow[];
  const totalUnits = items.reduce((sum, item) => sum + Number(item.quantity_total ?? 0), 0);
  const availableUnits = items.reduce((sum, item) => sum + Number(item.quantity_available ?? 0), 0);

  return (
    <div>
      <div className="dashboard-topbar">
        <div>
          <span className="eyebrow">Rentals</span>
          <h1>Inventory</h1>
          <p className="mini-meta">Rental assets, quantities, availability, and replacement values for event planning.</p>
        </div>
      </div>

      <section className="stats-grid" aria-label="Inventory statistics">
        <article className="stat-card"><span>Tracked Items</span><strong>{items.length}</strong></article>
        <article className="stat-card"><span>Total Units</span><strong>{totalUnits}</strong></article>
        <article className="stat-card"><span>Available Units</span><strong>{availableUnits}</strong></article>
      </section>

      <section className="panel" style={{ marginTop: 16 }}>
        <h2>Inventory Catalog</h2>
        <table className="table">
          <thead>
            <tr><th>Item</th><th>Category</th><th>Quantity</th><th>Available</th><th>Replacement Value</th><th>Status</th></tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id}>
                <td>{item.name}</td>
                <td><span className="status">{(item.category || "General").replace(/_/g, " ")}</span></td>
                <td>{item.quantity_total ?? 0}</td>
                <td>{item.quantity_available ?? 0}</td>
                <td>{currency(Number(item.replacement_value ?? 0))}</td>
                <td><span className="status">{item.active === false ? "Inactive" : "Active"}</span></td>
              </tr>
            ))}
            {!items.length ? (
              <tr>
                <td colSpan={6}>
                  <strong>No inventory loaded</strong>
                  <div className="mini-meta">
                    {error ? "Inventory tracking has not been set up for this workspace yet." : "Tables, chairs, backdrops, linens, florals, and rental packages can be managed here."}
                  </div>
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </section>
    </div>
  );
}
