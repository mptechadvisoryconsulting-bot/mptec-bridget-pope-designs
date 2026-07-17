import { NextResponse } from "next/server";
import { requireAdminProfile } from "@/lib/auth/require-admin";
import { invoiceTemplatePayloadSchema } from "@/lib/validation/invoice-template-schema";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  const admin = await requireAdminProfile();
  if (admin.error) return admin.error;

  const input = invoiceTemplatePayloadSchema.parse(await request.json());
  const supabase = createAdminClient();

  if (input.isDefault) {
    await supabase.from("invoice_templates").update({ is_default: false }).eq("is_default", true);
  }

  const { data, error } = await supabase
    .from("invoice_templates")
    .insert({
      name: input.name,
      is_default: Boolean(input.isDefault),
      config: input.config,
      created_by: admin.profile.id,
    })
    .select("id")
    .single();

  if (error || !data) {
    return NextResponse.json({ success: false, message: error?.message ?? "Unable to create template." }, { status: 400 });
  }

  return NextResponse.json({ success: true, templateId: data.id }, { status: 201 });
}
