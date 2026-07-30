import { NextResponse } from "next/server";
import { z } from "zod";
import { requireOwnerProfile } from "@/lib/auth/require-owner";
import { deleteClientWithConfirm } from "@/lib/admin/delete-records";
import { isLikelyTestRecord } from "@/lib/admin/test-data";
import { createAdminClient } from "@/lib/supabase/admin";
import { first } from "@/lib/supabase/relations";

const bodySchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(50),
  confirm: z.literal("DELETE"),
  cascade: z.boolean().optional().default(true),
});

export async function POST(request: Request) {
  const owner = await requireOwnerProfile();
  if (owner.error) return owner.error;

  let input: z.infer<typeof bodySchema>;
  try {
    input = bodySchema.parse(await request.json());
  } catch {
    return NextResponse.json({ success: false, message: "Provide up to 50 client ids and confirm with DELETE." }, { status: 400 });
  }

  const supabase = createAdminClient();
  let deleted = 0;
  const failures: string[] = [];
  const skipped: string[] = [];

  for (const clientId of input.ids) {
    const { data: client } = await supabase
      .from("clients")
      .select("id,bpd_profiles!profile_id(first_name,last_name,email,username)")
      .eq("id", clientId)
      .maybeSingle();

    if (!client) {
      skipped.push(`${clientId}: not found`);
      continue;
    }

    const profile = first(client.bpd_profiles);
    const name = [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") || profile?.email || "Client";
    const likelyTest = isLikelyTestRecord({
      email: profile?.email,
      firstName: profile?.first_name,
      lastName: profile?.last_name,
      username: profile?.username,
      name,
    });

    if (!likelyTest) {
      skipped.push(`${name}: not a test/E2E pattern — skipped for safety`);
      continue;
    }

    const result = await deleteClientWithConfirm(supabase, clientId, {
      confirm: "DELETE",
      cascade: input.cascade,
      actorId: owner.profile.id,
    });

    if (!result.success) {
      failures.push(`${name}: ${result.message}`);
      continue;
    }
    deleted += 1;
  }

  await supabase.from("activity_logs").insert({
    actor_id: owner.profile.id,
    action: "clients_bulk_test_cleanup",
    entity_type: "client",
    entity_id: null,
    metadata: { deleted, failures: failures.length, skipped: skipped.length, requested: input.ids.length },
  });

  if (!deleted && failures.length) {
    return NextResponse.json(
      { success: false, message: failures[0], dependents: [...failures, ...skipped].slice(0, 10) },
      { status: 400 },
    );
  }

  const parts = [`Deleted ${deleted} test client(s).`];
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
