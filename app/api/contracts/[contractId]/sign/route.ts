import { NextResponse } from "next/server";
import { z } from "zod";
import { adminRoles, getCurrentProfile } from "@/lib/auth/current-profile";
import { createAdminClient } from "@/lib/supabase/admin";

const signatureSchema = z.object({
  signer: z.enum(["client", "owner"]),
  signature: z.string().min(2).max(200),
});

export async function POST(request: Request, { params }: { params: Promise<{ contractId: string }> }) {
  const { contractId } = await params;
  const { profile } = await getCurrentProfile();
  if (!profile?.active) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  }

  const input = signatureSchema.parse(await request.json());
  const supabase = createAdminClient();
  const { data: contract } = await supabase
    .from("contracts")
    .select("id,bpd_projects(assigned_admin_id,bpd_clients(profile_id))")
    .eq("id", contractId)
    .maybeSingle();
  const project = Array.isArray(contract?.bpd_projects) ? contract?.bpd_projects[0] : contract?.bpd_projects;
  const client = Array.isArray(project?.bpd_clients) ? project?.bpd_clients[0] : project?.bpd_clients;
  const canSignAsOwner = input.signer === "owner" && (adminRoles.has(profile.role) || project?.assigned_admin_id === profile.id);
  const canSignAsClient = input.signer === "client" && client?.profile_id === profile.id;

  if (!contract || (!canSignAsOwner && !canSignAsClient)) {
    return NextResponse.json({ success: false, message: "Contract not found." }, { status: 404 });
  }

  const fields =
    input.signer === "client"
      ? { client_signature: input.signature, client_signed_at: new Date().toISOString() }
      : { owner_signature: input.signature, owner_signed_at: new Date().toISOString() };
  const { data, error } = await supabase.from("contracts").update(fields).eq("id", contractId).select().single();
  if (error) return NextResponse.json({ success: false, message: error.message }, { status: 400 });
  return NextResponse.json({ success: true, contract: data });
}
