import { NextResponse } from "next/server";
import { requireAdminProfile } from "@/lib/auth/require-admin";
import { invoiceTemplateActionSchema } from "@/lib/validation/invoice-template-schema";
import { createAdminClient } from "@/lib/supabase/admin";

export async function PATCH(request: Request, { params }: { params: Promise<{ templateId: string }> }) {
  const admin = await requireAdminProfile();
  if (admin.error) return admin.error;

  const { templateId } = await params;
  const input = invoiceTemplateActionSchema.parse(await request.json());
  const supabase = createAdminClient();

  if (input.action === "set_default") {
    await supabase.from("invoice_templates").update({ is_default: false }).eq("is_default", true);
    const { error } = await supabase
      .from("invoice_templates")
      .update({ is_default: true, archived_at: null, updated_at: new Date().toISOString() })
      .eq("id", templateId);
    return NextResponse.json({ success: !error, message: error?.message });
  }

  if (input.action === "archive") {
    const { error } = await supabase
      .from("invoice_templates")
      .update({ is_default: false, archived_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq("id", templateId);
    return NextResponse.json({ success: !error, message: error?.message });
  }

  if (input.action === "duplicate") {
    const { data: template } = await supabase.from("invoice_templates").select("name,config").eq("id", templateId).maybeSingle();
    if (!template) {
      return NextResponse.json({ success: false, message: "Template not found." }, { status: 404 });
    }

    const { data, error } = await supabase
      .from("invoice_templates")
      .insert({
        name: `${template.name} Copy`,
        is_default: false,
        config: template.config,
        created_by: admin.profile.id,
      })
      .select("id")
      .single();
    return NextResponse.json({ success: !error, templateId: data?.id, message: error?.message }, { status: error ? 400 : 201 });
  }

  const { data: existing } = await supabase
    .from("invoice_templates")
    .select("version_number")
    .eq("id", templateId)
    .maybeSingle();
  const { error } = await supabase
    .from("invoice_templates")
    .update({
      name: input.name,
      config: input.config,
      version_number: Number(existing?.version_number ?? 1) + 1,
      updated_at: new Date().toISOString(),
    })
    .eq("id", templateId);

  return NextResponse.json({ success: !error, message: error?.message });
}
