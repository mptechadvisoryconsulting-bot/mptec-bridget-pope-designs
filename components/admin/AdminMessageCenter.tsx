"use client";

import { Send } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { safeFetch } from "@/lib/safe-fetch";

type MessageRow = {
  id: string;
  conversationId: string;
  body: string;
  senderId?: string | null;
  createdAt: string;
  readAt?: string | null;
};

type ConversationRow = {
  id: string;
  clientName: string;
  clientProfileId?: string | null;
  projectName: string;
  status: string;
  messages: MessageRow[];
};

function unreadCount(conversation: ConversationRow) {
  if (!conversation.clientProfileId) return 0;
  return conversation.messages.filter((message) => message.senderId === conversation.clientProfileId && !message.readAt).length;
}

export function AdminMessageCenter({ conversations, adminId }: { conversations: ConversationRow[]; adminId: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [rows, setRows] = useState(conversations);
  const deepLinkId = searchParams.get("conversation");
  const [activeId, setActiveId] = useState(
    (deepLinkId && conversations.some((row) => row.id === deepLinkId) ? deepLinkId : conversations[0]?.id) ?? "",
  );
  const [body, setBody] = useState("");
  const [status, setStatus] = useState("");
  const [isSending, setIsSending] = useState(false);
  const threadRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const active = useMemo(() => rows.find((row) => row.id === activeId) ?? rows[0], [rows, activeId]);

  useEffect(() => {
    if (threadRef.current) {
      threadRef.current.scrollTop = threadRef.current.scrollHeight;
    }
  }, [active?.messages.length, active?.id]);

  useEffect(() => {
    if (!active?.id) return;
    if (unreadCount(active) === 0) return;

    let cancelled = false;
    void safeFetch("/api/messages/read", { method: "PATCH", body: { conversationId: active.id } }).then((result) => {
      if (cancelled || !result.ok) return;
      setRows((current) =>
        current.map((row) =>
          row.id === active.id ? { ...row, messages: row.messages.map((message) => ({ ...message, readAt: message.readAt ?? new Date().toISOString() })) } : row,
        ),
      );
    });

    return () => {
      cancelled = true;
    };
  }, [active?.id]);

  function selectConversation(conversationId: string) {
    setActiveId(conversationId);
    setStatus("");
    const params = new URLSearchParams(searchParams.toString());
    params.set("conversation", conversationId);
    router.replace(`/admin/messages?${params.toString()}`, { scroll: false });
    inputRef.current?.focus();
  }

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!active?.id || !body.trim()) return;

    setIsSending(true);
    setStatus("");
    const result = await safeFetch<{ success: boolean; message?: { id: string; body: string; sender_id?: string | null; created_at: string } | string }>(
      "/api/messages",
      { method: "POST", body: { conversationId: active.id, body } },
    );
    setIsSending(false);

    const sentMessage = result.ok ? result.data?.message : undefined;
    if (!sentMessage || typeof sentMessage === "string") {
      const fallback = !result.ok ? result.message : "Message could not be sent.";
      setStatus(typeof sentMessage === "string" ? sentMessage : fallback);
      return;
    }

    setRows((current) =>
      current.map((row) =>
        row.id === active.id
          ? {
              ...row,
              messages: [
                ...row.messages,
                {
                  id: sentMessage.id,
                  conversationId: row.id,
                  body: sentMessage.body,
                  senderId: sentMessage.sender_id,
                  createdAt: sentMessage.created_at,
                  readAt: null,
                },
              ],
            }
          : row,
      ),
    );
    setBody("");
  }

  return (
    <div className="message-center">
      <section className="panel message-list-panel">
        <h2>Conversations</h2>
        <div className="message-list" role="list">
          {rows.map((conversation) => {
            const unread = unreadCount(conversation);
            return (
              <button
                aria-current={conversation.id === active?.id ? "true" : undefined}
                className={conversation.id === active?.id ? "message-list-item active" : "message-list-item"}
                key={conversation.id}
                onClick={() => selectConversation(conversation.id)}
                role="listitem"
                type="button"
              >
                <strong>{conversation.clientName}</strong>
                <span>{conversation.projectName}</span>
                <small>{conversation.status.replace(/_/g, " ")}</small>
                {unread ? <span className="status" aria-label={`${unread} unread messages`}>{unread} new</span> : null}
              </button>
            );
          })}
          {!rows.length ? <p className="mini-meta">No client conversations exist yet.</p> : null}
        </div>
      </section>

      <section className="panel message-thread-panel">
        <h2>{active ? `${active.clientName} - ${active.projectName}` : "Messages"}</h2>
        <div aria-live="polite" className="message-panel admin-thread" ref={threadRef}>
          {active?.messages.map((message) => (
            <div className={message.senderId === adminId ? "bubble admin" : "bubble"} key={message.id}>
              {message.body}
              <small>{new Date(message.createdAt).toLocaleString("en-US")}</small>
            </div>
          ))}
          {!active?.messages.length ? <p className="mini-meta">No messages have been sent for this project.</p> : null}
        </div>
        <form onSubmit={sendMessage} style={{ display: "flex", gap: 8, marginTop: 12 }}>
          <Input
            aria-label="Reply to client"
            disabled={!active || isSending}
            onChange={(event) => setBody(event.target.value)}
            placeholder="Reply to client"
            ref={inputRef}
            value={body}
          />
          <Button disabled={!active || isSending || !body.trim()} type="submit" aria-label="Send message">
            <Send size={16} />
          </Button>
        </form>
        {status ? <p className="form-error" role="alert">{status}</p> : null}
      </section>
    </div>
  );
}
