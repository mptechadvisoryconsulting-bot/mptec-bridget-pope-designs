import { NextResponse } from "next/server";
import { requireAdminProfile } from "@/lib/auth/require-admin";
import { generateProposalPdf } from "@/lib/pdf/generate-proposal-pdf";
import { createAdminClient } from "@/lib/supabase/admin";
import { first } from "@/lib/supabase/relations";

export async function GET(_request: Request, { params }: { params: Promise<{ proposalId: string }> }) {
  const admin = await requireAdminProfile();
  if (admin.error) return admin.error;

  const { proposalId } = await params;
  const supabase = createAdminClient();
  const { data: proposal } = await supabase
    .from("proposals")
    .select(
      "*, bpd_proposal_items(*), bpd_projects(event_name,event_date,venue_name,bpd_clients(bpd_profiles(first_name,last_name,email)))",
    )
    .eq("id", proposalId)
    .maybeSingle();

  if (!proposal) {
    return NextResponse.json({ success: false, message: "Proposal not found." }, { status: 404 });
  }

  const project = first(proposal.bpd_projects);
  const client = first(project?.bpd_clients);
  const profile = first(client?.bpd_profiles);
  const clientName = [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") || "Client";

  const pdf = await generateProposalPdf({
    proposalNumber: proposal.proposal_number,
    title: proposal.title ?? "Event Design Proposal",
    status: proposal.status,
    introduction: proposal.introduction,
    clientName,
    clientEmail: profile?.email,
    projectName: project?.event_name,
    venue: project?.venue_name,
    eventDate: project?.event_date,
    items: (proposal.bpd_proposal_items ?? []).map((item: { title: string; description?: string | null; quantity?: number; unit_price?: number; total?: number }) => ({
      title: item.title,
      description: item.description,
      quantity: item.quantity,
      unitPrice: item.unit_price,
      total: item.total,
    })),
    subtotal: Number(proposal.subtotal ?? 0),
    taxAmount: Number(proposal.tax_amount ?? 0),
    discountAmount: Number(proposal.discount_amount ?? 0),
    total: Number(proposal.total ?? 0),
    depositAmount: Number(proposal.deposit_amount ?? 0),
    expirationDate: proposal.expiration_date,
  });

  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${proposal.proposal_number}.pdf"`,
    },
  });
}
