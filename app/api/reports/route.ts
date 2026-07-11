import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json({ report: "monthly-revenue", revenue: 28450, bookings: 18 });
}
