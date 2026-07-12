"use client";

import { Send } from "lucide-react";
import { FormEvent, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type MessageRow = {
  id: string;
  conversationId: string;
  body: string;
  senderId?: string | null;
  createdAt: string;
};

type ConversationRow = {
  id: string;
  clientName: string;
  projectName: string;
  status: string;
  messages: MessageRow[];
};

export function AdminMessageCenter({ conversations, adminId }: { conversations: ConversationRow[]; adminId: string }) {
  const [rows, setRows] = useState(conversations);
  const [activeId, setActiveId] = useState(conversations[0]?.id ?? "");
  const [body, setBody] = useState("");
  const [status, setStatus] = useState("");
  const [isSending, setIsSending] = useState(false);
  const active = useMemo(() => rows.find((row) => row.id === activeId) ?? rows[0], [rows, activeId]);

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!active?.id || !body.trim()) return;

    setIsSending(true);
    setStatus("");
    const response = await fetch("/api/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ conversationId: active.id, body }),
    });
    const payload = await response.json();
    setIsSending(false);

    if (!response.ok) {
      setStatus(payload.message ?? "Message could not be sent.");
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
                  id: payload.message.id,
                  conversationId: row.id,
                  body: payload.message.body,
                  senderId: payload.message.sender_id,
                  createdAt: payload.message.created_at,
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
        <div className="message-list">
          {rows.map((conversation) => (
            <button
              className={conversation.id === active?.id ? "message-list-item active" : "message-list-item"}
              key={conversation.id}
              onClick={() => setActiveId(conversation.id)}
              type="button"
            >
              <strong>{conversation.clientName}</strong>
              <span>{conversation.projectName}</span>
              <small>{conversation.status.replace(/_/g, " ")}</small>
            </button>
          ))}
          {!rows.length ? <p className="mini-meta">No client conversations exist yet.</p> : null}
        </div>
      </section>

      <section className="panel message-thread-panel">
        <h2>{active ? `${active.clientName} - ${active.projectName}` : "Messages"}</h2>
        <div className="message-panel admin-thread">
          {active?.messages.map((message) => (
            <div className={message.senderId === adminId ? "bubble admin" : "bubble"} key={message.id}>
              {message.body}
              <small>{new Date(message.createdAt).toLocaleString("en-US")}</small>
            </div>
          ))}
          {!active?.messages.length ? <p className="mini-meta">No messages have been sent for this project.</p> : null}
        </div>
        <form onSubmit={sendMessage} style={{ display: "flex", gap: 8, marginTop: 12 }}>
          <Input disabled={!active || isSending} onChange={(event) => setBody(event.target.value)} placeholder="Reply to client" value={body} />
          <Button disabled={!active || isSending} type="submit" aria-label="Send message">
            <Send size={16} />
          </Button>
        </form>
        {status ? <p className="form-error">{status}</p> : null}
      </section>
    </div>
  );
}
