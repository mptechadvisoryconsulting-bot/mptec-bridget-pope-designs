import { appUrl } from "@/lib/env";

export function clientAuthRedirectUrl(next = "/auth/reset-password") {
  return `${appUrl()}/auth/callback?next=${encodeURIComponent(next)}`;
}
