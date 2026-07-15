import { z } from "zod";
import { normalizeUsername } from "@/lib/auth/portal-credentials";

export const clientAccountSchema = z.object({
  email: z.string().email().max(160),
  username: z.string().min(3).max(40).optional().or(z.literal("")),
  firstName: z.string().min(2).max(80),
  lastName: z.string().min(2).max(80),
  phone: z.string().max(30).optional().or(z.literal("")),
  eventName: z.string().min(2).max(160),
  eventType: z.string().min(2).max(100),
  eventDate: z.string().optional().or(z.literal("")),
  venue: z.string().max(200).optional().or(z.literal("")),
  status: z
    .enum(["pending", "booked", "planning", "design_in_progress", "awaiting_client_approval", "finalizing", "ready_for_event", "event_complete"])
    .default("planning"),
});

export type ClientAccountInput = z.infer<typeof clientAccountSchema>;

export type SupabaseAdminLike = {
  from(table: string): any;
  auth: {
    admin: {
      inviteUserByEmail: (email: string, options?: { data?: object; redirectTo?: string }) => Promise<{ data: any; error: any }>;
      deleteUser: (id: string) => Promise<{ data: any; error: any }>;
      listUsers?: (params?: { page?: number; perPage?: number }) => Promise<{ data: any; error: any }>;
    };
  };
};

export type ProvisionClientAccountResult =
  | {
      success: true;
      email: string;
      username: string | null;
      authUserId: string;
      profileId: string;
      clientId: string;
      projectId: string;
      conversationId: string;
      warning?: string;
    }
  | {
      success: false;
      status: number;
      message: string;
    };

/** @deprecated Prefer deriveUsername in provision-client; kept for tests/helpers. */
export function deriveClientUsername(email: string, requested?: string) {
  const raw = requested && requested.trim() ? requested : email.split("@")[0] ?? "";
  const normalized = normalizeUsername(raw);
  return normalized || null;
}

export async function provisionClientAccount(
  supabase: SupabaseAdminLike,
  input: ClientAccountInput & { adminProfileId: string },
): Promise<ProvisionClientAccountResult> {
  const { provisionManualClientAccount } = await import("@/lib/provisioning/provision-client");
  return provisionManualClientAccount(supabase, input);
}
