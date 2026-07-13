import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { appUrl } from "@/lib/env";
import { sendTrackedEmail } from "@/lib/email/delivery";
import { emailFrom } from "@/lib/email/resend";
import { getRequestIp, jsonError, rateLimit } from "@/lib/http";
import { generateInquiryPdf } from "@/lib/pdf/generate-inquiry-pdf";
import { createAdminClient } from "@/lib/supabase/admin";
import { inquirySchema, normalizeInquiry } from "@/lib/validation/inquiry-schema";

export const runtime = "nodejs";

function leadNumber() {
  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  return `BPD-${stamp}-${randomBytes(3).toString("hex").toUpperCase()}`;
}

export async function POST(request: Request) {
  try {
    const limiter = rateLimit(`inquiry:${getRequestIp(request)}`, 4, 10 * 60_000);
    if (!limiter.allowed) {
      return NextResponse.json({ success: false, message: "Too many requests. Please try again later." }, { status: 429 });
    }

    const body = await request.json();
    const input = inquirySchema.parse(body);
    const normalized = normalizeInquiry(input);
    const supabase = createAdminClient();
    const generatedLeadNumber = leadNumber();

    const { data: lead, error: leadError } = await supabase
      .from("leads")
      .insert({
        lead_number: generatedLeadNumber,
        first_name: normalized.firstName,
        last_name: normalized.lastName,
        email: normalized.email,
        phone: normalized.phone,
        event_type: normalized.eventType,
        event_date: normalized.eventDate,
        venue: normalized.venue,
        city: normalized.city,
        guest_count: normalized.guestCount,
        estimated_budget: normalized.estimatedBudget,
        preferred_consultation_method: normalized.preferredConsultationMethod,
        preferred_consultation_date: normalized.preferredConsultationDate,
        preferred_consultation_time: normalized.preferredConsultationTime,
        event_colors: normalized.eventColors,
        event_theme: normalized.eventTheme,
        services_needed: normalized.servicesNeeded,
        message: normalized.message,
        status: "new",
        source: "public_website",
      })
      .select("id, lead_number, created_at")
      .single();

    if (leadError || !lead) {
      throw new Error(leadError?.message ?? "Unable to create lead");
    }

    const pdf = await generateInquiryPdf({ lead, input });
    let pdfFileId: string | null = null;
    const pdfPath = `inquiries/${lead.id}/consultation-summary.pdf`;

    const upload = await supabase.storage.from("inquiry-pdfs").upload(pdfPath, pdf, {
      contentType: "application/pdf",
      upsert: true,
    });

    if (!upload.error) {
      const { data: file } = await supabase
        .from("files")
        .insert({
          lead_id: lead.id,
          category: "inquiry_pdf",
          file_name: `consultation-${lead.lead_number}.pdf`,
          storage_path: pdfPath,
          mime_type: "application/pdf",
          file_size: pdf.byteLength,
          visibility: "private_admin",
        })
        .select("id")
        .single();

      pdfFileId = file?.id ?? null;

      if (pdfFileId) {
        await supabase.from("leads").update({ pdf_file_id: pdfFileId }).eq("id", lead.id);
      }
    }

    const { data: admins } = await supabase.from("profiles").select("id").in("role", ["owner", "admin"]).eq("active", true);
    const notifications =
      admins?.map((admin) => ({
        recipient_id: admin.id,
        lead_id: lead.id,
        type: "new_consultation_request",
        title: "New consultation request",
        message: `${input.firstName} ${input.lastName} requested a ${input.eventType} consultation.`,
        action_url: `/admin/leads/${lead.id}`,
      })) ?? [];

    if (notifications.length) {
      await supabase.from("notifications").insert(notifications);
    }

    await supabase.from("consultations").insert({
      lead_id: lead.id,
      timezone: "America/Chicago",
      meeting_type: input.preferredConsultationMethod,
      status: "requested",
      notes: input.message,
    });

    await supabase.from("activity_logs").insert({
      lead_id: lead.id,
      action: "inquiry_submitted",
      entity_type: "lead",
      entity_id: lead.id,
      metadata: { lead_number: lead.lead_number, services_needed: input.servicesNeeded },
      ip_address: getRequestIp(request),
    });

    const { data: settings } = await supabase
      .from("business_settings")
      .select("id,business_email,inquiry_recipient_email,inquiry_notifications_enabled,client_email_notifications_enabled")
      .limit(1)
      .maybeSingle();
    const ownerEmail = settings?.inquiry_recipient_email ?? settings?.business_email ?? process.env.OWNER_EMAIL ?? process.env.ADMIN_EMAIL;
    const adminUrl = `${appUrl()}/admin/leads/${lead.id}`;

    if (ownerEmail && settings?.inquiry_notifications_enabled !== false) {
      const ownerEmailResult = await sendTrackedEmail({
        supabase,
        settingsId: settings?.id,
        from: emailFrom(),
        to: ownerEmail,
        replyTo: input.email,
        subject: `New consultation request: ${input.eventType}`,
        html: `
          <h2>New consultation request</h2>
          <p><strong>Lead:</strong> ${lead.lead_number}</p>
          <p><strong>Client:</strong> ${input.firstName} ${input.lastName}</p>
          <p><strong>Email:</strong> ${input.email}</p>
          <p><strong>Phone:</strong> ${input.phone}</p>
          <p><strong>Event:</strong> ${input.eventType}</p>
          <p><strong>Date:</strong> ${input.eventDate || "Not provided"}</p>
          <p><strong>Venue:</strong> ${input.venue || "Not provided"}</p>
          <p><strong>Guest count:</strong> ${input.guestCount || "Not provided"}</p>
          <p><strong>Budget:</strong> ${input.estimatedBudget || "Not provided"}</p>
          <p><strong>Services:</strong> ${input.servicesNeeded.join(", ")}</p>
          <p><strong>Colors/theme:</strong> ${input.eventColors || "Not provided"} / ${input.eventTheme || "Not provided"}</p>
          <p><strong>Message:</strong> ${input.message}</p>
          <p><a href="${adminUrl}">Review request in admin dashboard</a></p>
        `,
        attachments: [{ filename: `consultation-${lead.lead_number}.pdf`, content: pdf.toString("base64") }],
      });

      await supabase.from("automation_logs").insert({
        automation_type: "inquiry_owner_email",
        lead_id: lead.id,
        recipient: ownerEmail,
        status: ownerEmailResult.status,
        error_message: ownerEmailResult.error ?? null,
        executed_at: new Date().toISOString(),
      });
    }

    if (settings?.client_email_notifications_enabled !== false) {
      const clientEmailResult = await sendTrackedEmail({
        supabase,
        settingsId: settings?.id,
        from: emailFrom(),
        to: input.email,
        subject: "We received your consultation request",
        html: `
          <p>Hello ${input.firstName},</p>
          <p>Bridget Pope Designs received your event request for ${input.eventType}.</p>
          <p>We will review the details and contact you to schedule a consultation.</p>
        `,
      });

      await supabase.from("automation_logs").insert({
        automation_type: "inquiry_client_confirmation_email",
        lead_id: lead.id,
        recipient: input.email,
        status: clientEmailResult.status,
        error_message: clientEmailResult.error ?? null,
        executed_at: new Date().toISOString(),
      });
    }

    return NextResponse.json({ success: true, leadId: lead.id, leadNumber: lead.lead_number });
  } catch (error) {
    console.error("Inquiry submission failed", error);
    return jsonError(error, "Unable to submit your request.");
  }
}
