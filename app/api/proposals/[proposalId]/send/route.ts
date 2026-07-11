import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(_request: Request, { params }: { params: Promise<{ proposalId: string }> }) {
  const { proposalId } = await params;
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("proposals")
    .update({ status: "sent" })
    .eq("id", proposalId)
    .select("id,project_id")
    .single();
  if (error) return NextResponse.json({ success: false, message: error.message }, { status: 400 });
  await supabase.from("activity_logs").insert({
    project_id: data.project_id,
    action: "proposal_sent",
    entity_type: "proposal",
    entity_id: data.id,
  });
  return NextResponse.json({ success: true, proposal: data });
}
