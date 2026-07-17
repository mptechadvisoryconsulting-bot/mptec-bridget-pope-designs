import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { ManualHoneyBookService } from "@/lib/integrations/honeybook/manual-service";
import type { HoneyBookService } from "@/lib/integrations/honeybook/types";

/**
 * Returns the active HoneyBook integration adapter.
 * Today: ManualHoneyBookService (DB pipeline + references).
 * Later: swap when HONEYBOOK_API_ENABLED=true and an API adapter exists.
 */
export function getHoneyBookService(supabase?: SupabaseClient): HoneyBookService {
  const client = supabase ?? createAdminClient();
  const apiEnabled = process.env.HONEYBOOK_API_ENABLED === "true";
  // Reserved for future API adapter swap; fall back to manual until one ships.
  if (apiEnabled) {
    return new ManualHoneyBookService(client);
  }
  return new ManualHoneyBookService(client);
}

export type { HoneyBookService } from "@/lib/integrations/honeybook/types";
export { ManualHoneyBookService } from "@/lib/integrations/honeybook/manual-service";
export {
  honeybookPipelineStages,
  type HoneyBookPipelineStage,
} from "@/lib/integrations/honeybook/types";
