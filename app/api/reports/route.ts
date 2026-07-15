import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json({
    report: "operations",
    message: "Financial reporting lives in HoneyBook. This app reports leads, projects, designs, messages, files, tasks, and HoneyBook references.",
  });
}
