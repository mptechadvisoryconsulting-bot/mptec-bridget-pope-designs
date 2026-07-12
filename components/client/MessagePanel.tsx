"use client";

import { Send } from "lucide-react";
import { FormEvent, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Message = {
  id: string;
  body: string;
  fromAdmin?: boolean;
};

export function MessagePanel({ conversationId, messages = [] }: { conversationId?: string; messages?: Message[] }) {
  const [items, setItems] = useState(messages);
  const [body, setBody] = useState("");
  const [status, setStatus] = useState("");
  const [isSending, setIsSending] = useState(false);

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!conversationId || !body.trim()) return;

    setIsSending(true);
    setStatus("");
    const response = await fetch("/api/messages", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ conversationId, body }),
    });
    const payload = await response.json();
    setIsSending(false);

    if (!response.ok) {
      setStatus(payload.message ?? "Message could not be sent.");
      return;
    }

    setItems((current) => [...current, { id: payload.message.id, body: payload.message.body }]);
    setBody("");
  }

  return (
    <section className="panel">
      <h2>Planner Messages</h2>
      <div className="message-panel">
        {items.map((message) => (
          <div className={message.fromAdmin ? "bubble admin" : "bubble"} key={message.id}>{message.body}</div>
        ))}
        {!items.length ? <p className="mini-meta">No messages yet.</p> : null}
        <form onSubmit={sendMessage} style={{ display: "flex", gap: 8 }}>
          <Input disabled={!conversationId || isSending} onChange={(event) => setBody(event.target.value)} placeholder="Write a message" value={body} />
          <Button disabled={!conversationId || isSending} type="submit" aria-label="Send message">
            <Send size={16} />
          </Button>
        </form>
        {status ? <p className="form-error">{status}</p> : null}
      </div>
    </section>
  );
}
