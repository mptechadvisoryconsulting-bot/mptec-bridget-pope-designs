import { NextResponse } from "next/server";
import { z } from "zod";
import { requireOwnerProfile } from "@/lib/auth/require-owner";
import { deleteLeadWithConfirm } from "@/lib/admin/delete-records";
import { isLikelyTestRecord } from "@/lib/admin/test-data";
import { createAdminClient } from "@/lib/supabase/admin";

const bodySchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(50),
  confirm: z.literal("DELETE"),
});

export async function POST(request: Request) {
  const owner = await requireOwnerProfile();
  if (owner.error) return owner.error;

  let input: z.infer<typeof bodySchema>;
  try {
    input = bodySchema.parse(await request.json());
  } catch {
    return NextResponse.json({ success: false, message: "Provide up to 50 lead ids and confirm with DELETE." }, { status: 400 });
  }

  const supabase = createAdminClient();
  let deleted = 0;
  const failures: string[] = [];
  const skipped: string[] = [];

  for (const leadId of input.ids) {
    const { data: lead } = await supabase
      .from("leads")
      .select("id,first_name,last_name,email,lead_number")
      .eq("id", leadId)
      .maybeSingle();

    if (!lead) {
      skipped.push(`${leadId}: not found`);
      continue;
    }

    const name = [lead.first_name, lead.last_name].filter(Boolean).join(" ") || lead.lead_number || "Lead";
    const likelyTest = isLikelyTestRecord({
      email: lead.email,
      firstName: lead.first_name,
      lastName: lead.last_name,
      name,
    });

    if (!likelyTest) {
      skipped.push(`${name}: not a test/E2E pattern — skipped for safety`);
      continue;
    }

    const result = await deleteLeadWithConfirm(supabase, leadId, "DELETE", owner.profile.id);
    if (!result.success) {
      failures.push(`${name}: ${result.message}`);
      continue;
    }
    deleted += 1;
  }

  await supabase.from("activity_logs").insert({
    actor_id: owner.profile.id,
    action: "leads_bulk_test_cleanup",
    entity_type: "lead",
    entity_id: null,
    metadata: { deleted, failures: failures.length, skipped: skipped.length, requested: input.ids.length },
  });

  if (!deleted && failures.length) {
    return NextResponse.json(
      { success: false, message: failures[0], dependents: [...failures, ...skipped].slice(0, 10) },
      { status: 400 },
    );
  }

  const parts = [`Deleted ${deleted} test lead(s).`];
  if (skipped.length) parts.push(`${skipped.length} skipped.`);
  if (failures.length) parts.push(`${failures.length} failed.`);

  return NextResponse.json({
    success: true,
    message: parts.join(" "),
    deleted,
    skipped,
    failures,
  });
}
