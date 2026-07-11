import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { requireEnv } from "@/lib/env";
import { withBpdNamespace } from "@/lib/supabase/namespace";

type UntypedDatabase = any;

export function getSupabaseAdminClient() {
  return createAdminClient();
}

let adminClient: SupabaseClient<UntypedDatabase> | null = null;

export function createAdminClient(): SupabaseClient<UntypedDatabase> {
  if (!adminClient) {
    adminClient = withBpdNamespace(
      createClient<UntypedDatabase>(requireEnv("NEXT_PUBLIC_SUPABASE_URL"), requireEnv("SUPABASE_SERVICE_ROLE_KEY"), {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }),
    ) as SupabaseClient<UntypedDatabase>;
  }

  return adminClient;
}
