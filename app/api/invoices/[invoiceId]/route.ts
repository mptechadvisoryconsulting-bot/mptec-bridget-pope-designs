import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getSupabaseServerClient } from "@/lib/supabase/server";

const adminRoles = new Set(["owner", "admin"]);

function notFound() {
  return NextResponse.json({ success: false, message: "Invoice not found." }, { status: 404 });
}

export async function GET(_request: Request, { params }: { params: Promise<{ invoiceId: string }> }) {
  const { invoiceId } = await params;
  const server = await getSupabaseServerClient();
  const {
    data: { user },
  } = await server.auth.getUser();

  if (!user) return notFound();

  const supabase = createAdminClient();
  const { data: profile } = await supabase
    .from("profiles")
    .select("id,role,active")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (!profile?.active) return notFound();

  const { data, error } = await supabase
    .from("invoices")
    .select("*, bpd_invoice_items(*), bpd_invoice_versions(*), bpd_projects(client_id,bpd_clients(profile_id))")
    .eq("id", invoiceId)
    .maybeSingle();

  if (error || !data) return notFound();

  const project = Array.isArray(data.bpd_projects) ? data.bpd_projects[0] : data.bpd_projects;
  const client = Array.isArray(project?.bpd_clients) ? project?.bpd_clients[0] : project?.bpd_clients;
  const canAccess = adminRoles.has(profile.role) || client?.profile_id === profile.id;

  if (!canAccess) return notFound();

  return NextResponse.json({ success: true, invoice: data });
}
