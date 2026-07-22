import { cache } from "react";
import { createAdminClient } from "@/lib/supabase/admin";

/** Fallback when business_settings / env are unset. Matches the monitored owner inbox. */
export const DEFAULT_PUBLIC_CONTACT_EMAIL = "bpeventsanddesigns@gmail.com";

/**
 * Public-facing contact email shown on marketing pages.
 * Prefer Admin → Business Settings → Inquiry Recipient Email so display matches
 * where inquiry form notifications are delivered (see app/api/inquiries/route.ts).
 */
export const getPublicContactEmail = cache(async (): Promise<string> => {
  try {
    const supabase = createAdminClient();
    const { data } = await supabase
      .from("business_settings")
      .select("inquiry_recipient_email,business_email")
      .limit(1)
      .maybeSingle();

    const fromSettings =
      data?.inquiry_recipient_email?.trim() || data?.business_email?.trim() || "";
    if (fromSettings) return fromSettings;
  } catch (error) {
    console.error("public_contact_email_lookup_failed", error);
  }

  return process.env.OWNER_EMAIL?.trim() || process.env.ADMIN_EMAIL?.trim() || DEFAULT_PUBLIC_CONTACT_EMAIL;
});
