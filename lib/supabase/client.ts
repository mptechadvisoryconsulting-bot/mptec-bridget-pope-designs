import { createBrowserClient } from "@supabase/ssr";
import { withBpdNamespace } from "@/lib/supabase/namespace";

export function getSupabaseBrowserClient() {
  return withBpdNamespace(
    createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
    ),
  );
}
