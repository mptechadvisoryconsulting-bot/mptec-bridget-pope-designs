import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { requireEnv } from "@/lib/env";

type UntypedDatabase = any;

export function getSupabaseAdminClient() {
  return createAdminClient();
}

let adminClient: SupabaseClient<UntypedDatabase> | null = null;

export function createAdminClient(): SupabaseClient<UntypedDatabase> {
  if (!adminClient) {
    adminClient = createClient<UntypedDatabase>(requireEnv("NEXT_PUBLIC_SUPABASE_URL"), requireEnv("SUPABASE_SERVICE_ROLE_KEY"), {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }

  return adminClient;
}
