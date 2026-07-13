import { AdminWorkspacePage } from "@/components/admin/AdminWorkspacePage";

export default function InventoryPage() {
  return (
    <AdminWorkspacePage
      eyebrow="Rentals"
      title="Inventory"
      description="Rental assets, quantities, availability, and replacement values for event planning."
      table="inventory_items"
      columns={[
        { key: "name", label: "Item" },
        { key: "category", label: "Category", format: "status" },
        { key: "quantity_total", label: "Total" },
        { key: "quantity_available", label: "Available" },
        { key: "replacement_value", label: "Replacement", format: "currency" },
        { key: "active", label: "Active", format: "boolean" },
      ]}
      emptyTitle="No inventory loaded"
      emptyDescription="Tables, chairs, backdrops, linens, florals, and rental packages can be managed here."
    />
  );
}
