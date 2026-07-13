import type Stripe from "stripe";

export type SupabaseAdmin = {
  from(table: string): any;
};

export const MAX_STRIPE_EVENT_RETRIES = 5;

export type ClaimResult =
  | { claimed: true }
  | { claimed: false; processed: boolean; status: string };

export function duplicateError(error: { code?: string; message?: string } | null) {
  return error?.code === "23505" || Boolean(error?.message?.toLowerCase().includes("duplicate"));
}

/**
 * Atomically claims a Stripe event for processing.
 *
 * - First attempt is a plain INSERT; the unique constraint on `stripe_event_id` guarantees only
 *   one concurrent request can win it.
 * - Losers of that race re-read the row. If it is mid-processing or already processed, they back
 *   off (the caller returns 409/200 without reprocessing).
 * - If the existing row previously failed, a retry is attempted via a compare-and-swap UPDATE
 *   (`.eq("processing_status", "failed")`), which only succeeds for exactly one concurrent
 *   retrier — Postgres serializes concurrent UPDATEs on the same row, so a second retrier's WHERE
 *   clause no longer matches once the first has moved the row to "processing".
 * - Retries are capped at `MAX_STRIPE_EVENT_RETRIES` to avoid an event looping forever if Stripe
 *   keeps redelivering a permanently-failing event.
 */
export async function claimStripeEvent(supabase: SupabaseAdmin, event: Stripe.Event): Promise<ClaimResult> {
  const now = new Date().toISOString();
  const { error } = await supabase.from("stripe_events").insert({
    stripe_event_id: event.id,
    event_type: event.type,
    processing_status: "processing",
    claimed_at: now,
    processing_started_at: now,
    payload: event,
  });

  if (!error) return { claimed: true };
  if (!duplicateError(error)) throw new Error(error.message);

  const { data: existing, error: fetchError } = await supabase
    .from("stripe_events")
    .select("id,processed_at,processing_error,processing_status,retry_count")
    .eq("stripe_event_id", event.id)
    .maybeSingle();

  if (fetchError) throw new Error(fetchError.message);

  if (existing?.processing_status !== "failed") {
    return {
      claimed: false,
      processed: Boolean(existing?.processed_at),
      status: existing?.processing_status ?? "unknown",
    };
  }

  const retryCount = Number(existing.retry_count ?? 0);
  if (retryCount >= MAX_STRIPE_EVENT_RETRIES) {
    return { claimed: false, processed: false, status: "retry_limit_exceeded" };
  }

  const { data: retryClaim, error: retryError } = await supabase
    .from("stripe_events")
    .update({
      processing_status: "processing",
      processing_started_at: now,
      processing_error: null,
      retry_count: retryCount + 1,
      payload: event,
    })
    .eq("id", existing.id)
    .eq("processing_status", "failed")
    .select("id")
    .maybeSingle();

  if (retryError) throw new Error(retryError.message);
  if (!retryClaim) {
    return { claimed: false, processed: false, status: "already_retrying" };
  }

  return { claimed: true };
}

export async function completeStripeEvent(supabase: SupabaseAdmin, event: Stripe.Event) {
  const { error } = await supabase
    .from("stripe_events")
    .update({ processed_at: new Date().toISOString(), processing_status: "processed", processing_error: null, payload: event })
    .eq("stripe_event_id", event.id);
  if (error) throw new Error(error.message);
}

export async function failStripeEvent(supabase: SupabaseAdmin, event: Stripe.Event, error: unknown) {
  const message = error instanceof Error ? error.message : "Unknown webhook processing error";
  const { error: updateError } = await supabase
    .from("stripe_events")
    .update({ processing_error: message, processing_status: "failed", failed_at: new Date().toISOString(), payload: event })
    .eq("stripe_event_id", event.id);
  if (updateError) console.error("Stripe event failure persistence failed", { eventId: event.id, code: updateError.code });
}

export async function adminProfileIds(supabase: SupabaseAdmin) {
  const { data, error } = await supabase.from("profiles").select("id").in("role", ["owner", "admin"]).eq("active", true);
  if (error) {
    console.error("Failed to load admin profiles for notification fan-out", { code: error.code, message: error.message });
    return [];
  }
  return (data ?? []).map((profile: { id: string }) => profile.id);
}

export async function notifyAdmins(
  supabase: SupabaseAdmin,
  input: { type: string; title: string; message: string; projectId?: string | null; actionUrl?: string },
) {
  const recipients = await adminProfileIds(supabase);
  if (!recipients.length) return;

  const { error } = await supabase.from("notifications").insert(
    recipients.map((recipientId: string) => ({
      recipient_id: recipientId,
      project_id: input.projectId ?? null,
      type: input.type,
      title: input.title,
      message: input.message,
      action_url: input.actionUrl ?? "/admin/payments",
    })),
  );

  if (error) {
    console.error("Failed to insert admin notifications", { type: input.type, code: error.code, message: error.message });
  }
}
