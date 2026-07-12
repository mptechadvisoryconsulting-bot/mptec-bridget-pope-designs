import { MessagePanel } from "@/components/client/MessagePanel";
import { requireClientPortalContext } from "@/lib/client-portal";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export default async function MessagesPage() {
  const { profile, project } = await requireClientPortalContext("/client/messages");
  const { data: conversation } = project?.id
    ? await createAdminClient().from("conversations").select("id").eq("project_id", project.id).maybeSingle()
    : { data: null };
  const { data: messages } = conversation?.id
    ? await createAdminClient()
        .from("messages")
        .select("id,body,sender_id,created_at")
        .eq("conversation_id", conversation.id)
        .order("created_at", { ascending: true })
    : { data: [] };

  return (
    <div>
      <div className="client-hero">
        <div>
          <span className="eyebrow">Messages</span>
          <h1>Planner Chat</h1>
          <p className="mini-meta">Messages stay attached to your active Bridget Pope Designs project.</p>
        </div>
      </div>
      <MessagePanel
        conversationId={conversation?.id}
        messages={(messages ?? []).map((message) => ({
          id: message.id,
          body: message.body,
          fromAdmin: message.sender_id !== profile.id,
        }))}
      />
    </div>
  );
}
