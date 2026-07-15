import { NextResponse } from "next/server";
import { z } from "zod";
import { clientAuthRedirectUrl } from "@/lib/auth/client-invite";
import { createAdminClient } from "@/lib/supabase/admin";

const schema = z.object({
  email: z.string().trim().email("Enter a valid email address."),
});

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, message: parsed.error.issues[0]?.message ?? "Enter a valid email address." },
      { status: 400 },
    );
  }

  const supabase = createAdminClient();
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: clientAuthRedirectUrl("/auth/reset-password"),
  });

  // Avoid account enumeration: always return a generic success response to the client.
  if (error) {
    console.error("forgot_password_reset_failed", { message: error.message });
  }

  return NextResponse.json({
    success: true,
    message: "If an account exists for that email, a reset link is on the way.",
  });
}
