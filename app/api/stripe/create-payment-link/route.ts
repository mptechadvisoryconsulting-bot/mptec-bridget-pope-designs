import { NextResponse } from "next/server";

export async function POST(request: Request) {
  await request.text();
  return NextResponse.json(
    {
      success: false,
      message: "Stored Stripe Payment Links are disabled. Use /api/stripe/create-checkout-session for a fresh secure Checkout Session.",
    },
    { status: 410 },
  );
}
