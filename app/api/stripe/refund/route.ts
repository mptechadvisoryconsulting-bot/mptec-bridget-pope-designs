import { NextResponse } from "next/server";
import { z } from "zod";
import { getStripe } from "@/lib/stripe/client";

const refundSchema = z.object({
  paymentIntentId: z.string().min(5),
  amount: z.number().int().positive().optional(),
});

export async function POST(request: Request) {
  const input = refundSchema.parse(await request.json());
  const refund = await getStripe().refunds.create({
    payment_intent: input.paymentIntentId,
    amount: input.amount,
  });

  return NextResponse.json({ success: true, refundId: refund.id });
}
