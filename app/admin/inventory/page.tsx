import { AdminResourcePage } from "@/components/admin/AdminResourcePage";

export default function InventoryPage() {
  return <AdminResourcePage eyebrow="Rentals" title="Inventory" table="inventory_items" columns={["name", "category", "quantity_total", "quantity_available", "replacement_value", "active"]} />;
}
