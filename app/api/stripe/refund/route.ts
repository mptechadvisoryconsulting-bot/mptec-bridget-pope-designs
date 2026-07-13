import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminProfile } from "@/lib/auth/require-admin";
import { refundPlatformFeePolicy } from "@/lib/payments/config";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripe } from "@/lib/stripe/client";
import { DIRECT_CHARGE_V2, normalizePaymentModel } from "@/lib/stripe/connect";

const refundSchema = z.object({
  paymentId: z.string().uuid().optional(),
  paymentIntentId: z.string().min(5),
  amount: z.number().int().positive().optional(),
});

export async function POST(request: Request) {
  const admin = await requireAdminProfile();
  if (admin.error) return admin.error;

  const input = refundSchema.parse(await request.json());
  const supabase = createAdminClient();
  const { data: payment } = input.paymentId
    ? await supabase.from("payments").select("id,stripe_payment_intent_id,payment_model,stripe_account_context").eq("id", input.paymentId).maybeSingle()
    : await supabase
        .from("payments")
        .select("id,stripe_payment_intent_id,payment_model,stripe_account_context")
        .eq("stripe_payment_intent_id", input.paymentIntentId)
        .maybeSingle();

  if (!payment || payment.stripe_payment_intent_id !== input.paymentIntentId) {
    return NextResponse.json({ success: false, message: "Payment not found." }, { status: 404 });
  }

  const paymentModel = normalizePaymentModel(payment.payment_model);
  const refundParams = {
    payment_intent: input.paymentIntentId,
    amount: input.amount,
    metadata: {
      payment_id: payment.id,
      payment_model: paymentModel,
      stripe_account_context: payment.stripe_account_context ?? "",
      refund_platform_fee_policy: refundPlatformFeePolicy(),
    },
  };
  const requestOptions = paymentModel === DIRECT_CHARGE_V2 && payment.stripe_account_context
    ? { stripeAccount: payment.stripe_account_context }
    : undefined;

  const refund = await getStripe().refunds.create(refundParams, requestOptions);

  return NextResponse.json({ success: true, refundId: refund.id });
}
