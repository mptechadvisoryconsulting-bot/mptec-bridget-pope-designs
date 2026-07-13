"use client";

import { Send } from "lucide-react";
import { FormEvent, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { safeFetch } from "@/lib/safe-fetch";

type Message = {
  id: string;
  body: string;
  fromAdmin?: boolean;
  readAt?: string | null;
};

export function MessagePanel({ conversationId, messages = [] }: { conversationId?: string; messages?: Message[] }) {
  const [items, setItems] = useState(messages);
  const [body, setBody] = useState("");
  const [status, setStatus] = useState("");
  const [isSending, setIsSending] = useState(false);
  const threadRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (threadRef.current) {
      threadRef.current.scrollTop = threadRef.current.scrollHeight;
    }
  }, [items.length]);

  useEffect(() => {
    if (!conversationId || !items.some((message) => message.fromAdmin && !message.readAt)) return;

    let cancelled = false;
    void safeFetch("/api/messages/read", { method: "PATCH", body: { conversationId } }).then((result) => {
      if (cancelled || !result.ok) return;
      setItems((current) => current.map((message) => (message.fromAdmin ? { ...message, readAt: message.readAt ?? new Date().toISOString() } : message)));
    });

    return () => {
      cancelled = true;
    };
  }, [conversationId, items]);

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!conversationId || !body.trim()) return;

    setIsSending(true);
    setStatus("");
    const result = await safeFetch<{ success: boolean; message?: { id: string; body: string } | string }>("/api/messages", {
      method: "POST",
      body: { conversationId, body },
    });
    setIsSending(false);

    const sentMessage = result.ok ? result.data?.message : undefined;
    if (!sentMessage || typeof sentMessage === "string") {
      const fallback = !result.ok ? result.message : "Message could not be sent.";
      setStatus(typeof sentMessage === "string" ? sentMessage : fallback);
      return;
    }

    setItems((current) => [...current, { id: sentMessage.id, body: sentMessage.body }]);
    setBody("");
  }

  return (
    <section className="panel">
      <h2>Planner Messages</h2>
      <div className="message-panel">
        <div aria-live="polite" ref={threadRef}>
          {items.map((message) => (
            <div className={message.fromAdmin ? "bubble admin" : "bubble"} key={message.id}>{message.body}</div>
          ))}
          {!items.length ? <p className="mini-meta">No messages yet.</p> : null}
        </div>
        <form onSubmit={sendMessage} style={{ display: "flex", gap: 8 }}>
          <Input
            aria-label="Write a message to your planner"
            disabled={!conversationId || isSending}
            onChange={(event) => setBody(event.target.value)}
            placeholder="Write a message"
            value={body}
          />
          <Button disabled={!conversationId || isSending || !body.trim()} type="submit" aria-label="Send message">
            <Send size={16} />
          </Button>
        </form>
        {status ? <p className="form-error" role="alert">{status}</p> : null}
      </div>
    </section>
  );
}
