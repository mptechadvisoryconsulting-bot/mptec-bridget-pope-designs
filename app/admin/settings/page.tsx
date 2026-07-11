import { AdminSettingsForm } from "@/components/admin/AdminSettingsForm";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const { data: settings } = await createAdminClient()
    .from("business_settings")
    .select("business_email")
    .limit(1)
    .maybeSingle();

  return (
    <div>
      <div className="dashboard-topbar">
        <div>
          <span className="eyebrow">Business Settings</span>
          <h1>Settings</h1>
        </div>
      </div>
      <AdminSettingsForm businessEmail={settings?.business_email ?? process.env.OWNER_EMAIL ?? ""} />
    </div>
  );
}
