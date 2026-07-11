import { NextResponse } from "next/server";
import { ConfigurationError, safeErrorMessage } from "@/lib/env";

const buckets = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(key: string, limit = 5, windowMs = 60_000) {
  const now = Date.now();
  const current = buckets.get(key);

  if (!current || current.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true };
  }

  current.count += 1;
  return { allowed: current.count <= limit };
}

export function getRequestIp(request: Request) {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "local"
  );
}

export function jsonError(error: unknown, fallback = "Request failed") {
  const status = error instanceof ConfigurationError ? 503 : 400;
  return NextResponse.json(
    {
      success: false,
      message: error instanceof ConfigurationError ? safeErrorMessage(error) : fallback,
    },
    { status },
  );
}
