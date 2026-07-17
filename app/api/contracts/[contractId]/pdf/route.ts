import { NextResponse } from "next/server";
import { requireAdminProfile } from "@/lib/auth/require-admin";
import { generateContractPdf } from "@/lib/pdf/generate-contract-pdf";
import { createAdminClient } from "@/lib/supabase/admin";
import { first } from "@/lib/supabase/relations";

export async function GET(_request: Request, { params }: { params: Promise<{ contractId: string }> }) {
  const admin = await requireAdminProfile();
  if (admin.error) return admin.error;

  const { contractId } = await params;
  const supabase = createAdminClient();
  const { data: contract } = await supabase
    .from("contracts")
    .select("*, bpd_projects(event_name,event_date,venue_name,bpd_clients(bpd_profiles(first_name,last_name,email)))")
    .eq("id", contractId)
    .maybeSingle();

  if (!contract) {
    return NextResponse.json({ success: false, message: "Contract not found." }, { status: 404 });
  }

  const project = first(contract.bpd_projects);
  const client = first(project?.bpd_clients);
  const profile = first(client?.bpd_profiles);
  const clientName = [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") || "Client";

  const pdf = await generateContractPdf({
    contractNumber: contract.contract_number,
    status: contract.status,
    clientName,
    clientEmail: profile?.email,
    projectName: project?.event_name,
    venue: project?.venue_name,
    eventDate: project?.event_date,
    content: contract.content,
    signedAt: contract.client_signed_at,
  });

  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${contract.contract_number}.pdf"`,
    },
  });
}
