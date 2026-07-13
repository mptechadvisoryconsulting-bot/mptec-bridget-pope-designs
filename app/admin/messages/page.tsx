import { Suspense } from "react";
import { AdminMessageCenter } from "@/components/admin/AdminMessageCenter";
import { getCurrentProfile } from "@/lib/auth/current-profile";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type ConversationRow = {
  id: string;
  project_id: string;
  client_id: string;
  bpd_projects?: { event_name?: string | null; status?: string | null } | Array<{ event_name?: string | null; status?: string | null }> | null;
  bpd_clients?: {
    profile_id?: string | null;
    bpd_profiles?: {
      first_name?: string | null;
      last_name?: string | null;
      email?: string | null;
      username?: string | null;
    } | Array<{
      first_name?: string | null;
      last_name?: string | null;
      email?: string | null;
      username?: string | null;
    }> | null;
  } | Array<{
    profile_id?: string | null;
    bpd_profiles?: {
      first_name?: string | null;
      last_name?: string | null;
      email?: string | null;
      username?: string | null;
    } | Array<{
      first_name?: string | null;
      last_name?: string | null;
      email?: string | null;
      username?: string | null;
    }> | null;
  }> | null;
};

type MessageRow = {
  id: string;
  conversation_id: string;
  body: string;
  sender_id?: string | null;
  created_at: string;
  read_at?: string | null;
};

function first<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

export default async function AdminMessagesPage() {
  const { profile } = await getCurrentProfile();
  const supabase = createAdminClient();
  const { data: conversations } = await supabase
    .from("conversations")
    .select("id,project_id,client_id,bpd_projects(event_name,status),bpd_clients(profile_id,bpd_profiles(first_name,last_name,email,username))")
    .order("updated_at", { ascending: false });
  const ids = (conversations ?? []).map((conversation) => conversation.id);
  const { data: messages } = ids.length
    ? await supabase
        .from("messages")
        .select("id,conversation_id,body,sender_id,created_at,read_at")
        .in("conversation_id", ids)
        .order("created_at", { ascending: true })
    : { data: [] };

  const messageRows = (messages ?? []) as MessageRow[];
  const rows = ((conversations ?? []) as ConversationRow[]).map((conversation) => {
    const client = first(conversation.bpd_clients);
    const profileRow = first(client?.bpd_profiles);
    const project = first(conversation.bpd_projects);
    const clientName = [profileRow?.first_name, profileRow?.last_name].filter(Boolean).join(" ") || profileRow?.email || profileRow?.username || "Client";

    return {
      id: conversation.id,
      clientName,
      clientProfileId: client?.profile_id ?? null,
      projectName: project?.event_name ?? "Project",
      status: project?.status ?? "active",
      messages: messageRows
        .filter((message) => message.conversation_id === conversation.id)
        .map((message) => ({
          id: message.id,
          conversationId: message.conversation_id,
          body: message.body,
          senderId: message.sender_id,
          createdAt: message.created_at,
          readAt: message.read_at,
        })),
    };
  });

  return (
    <div>
      <div className="dashboard-topbar">
        <div>
          <span className="eyebrow">Communication</span>
          <h1>Messages</h1>
        </div>
      </div>
      <Suspense fallback={<p className="mini-meta">Loading conversations...</p>}>
        <AdminMessageCenter adminId={profile?.id ?? ""} conversations={rows} />
      </Suspense>
    </div>
  );
}
