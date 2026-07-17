"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

/**
 * Lightweight realtime bridge: refresh RSC payloads when the signed-in user
 * receives new notifications or messages.
 */
export function RealtimeRefresh({ userId }: { userId?: string | null }) {
  const router = useRouter();

  useEffect(() => {
    if (!userId) return;

    const supabase = getSupabaseBrowserClient();
    let active = true;

    const channel = supabase
      .channel(`portal-refresh:${userId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "bpd_notifications", filter: `recipient_id=eq.${userId}` },
        () => {
          if (active) router.refresh();
        },
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "bpd_messages" },
        () => {
          if (active) router.refresh();
        },
      )
      .subscribe();

    return () => {
      active = false;
      void supabase.removeChannel(channel);
    };
  }, [router, userId]);

  return null;
}
