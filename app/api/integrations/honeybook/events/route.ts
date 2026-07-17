import { NextResponse } from "next/server";
import { getHoneyBookService } from "@/lib/integrations/honeybook";
import { createAdminClient } from "@/lib/supabase/admin";
import { honeybookIntegrationEventSchema } from "@/lib/validation/honeybook-schema";

export async function POST(request: Request) {
  if (process.env.HONEYBOOK_INTEGRATION_ENABLED !== "true") {
    return NextResponse.json({ success: false, message: "HoneyBook integration is not enabled." }, { status: 404 });
  }

  const expectedSecret = process.env.HONEYBOOK_INTEGRATION_SECRET?.trim();
  if (!expectedSecret) {
    return NextResponse.json(
      { success: false, message: "HoneyBook integration secret is not configured." },
      { status: 503 },
    );
  }

  const providedSecret = request.headers.get("x-honeybook-integration-secret");
  if (providedSecret !== expectedSecret) {
    return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  }

  const parsed = honeybookIntegrationEventSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, message: parsed.error.issues[0]?.message ?? "Invalid HoneyBook event." },
      { status: 400 },
    );
  }

  const supabase = createAdminClient();
  const honeybook = getHoneyBookService(supabase);
  const result = await honeybook.handleInboundEvent(parsed.data);

  return NextResponse.json({
    success: true,
    matched: result.matched,
    duplicate: result.duplicate ?? false,
    projectId: result.projectId ?? null,
    stage: result.stage ?? null,
  });
}
