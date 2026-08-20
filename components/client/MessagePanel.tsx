"use client";

import { Paperclip, Send } from "lucide-react";
import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { safeFetch } from "@/lib/safe-fetch";

type MessageAttachment = {
  id: string;
  fileName: string;
  mimeType?: string | null;
  url: string;
};

type ApiMessage = {
  id: string;
  body: string;
  sender_id?: string | null;
  created_at?: string | null;
  read_at?: string | null;
  attachment?: MessageAttachment | null;
};

type Message = {
  id: string;
  body: string;
  senderId?: string | null;
  createdAt?: string | null;
  readAt?: string | null;
  attachment?: MessageAttachment | null;
};

export function MessagePanel({
  conversationId,
  projectId,
  currentProfileId,
  messages = [],
}: {
  conversationId?: string;
  projectId?: string;
  currentProfileId: string;
  messages?: Message[];
}) {
  const [items, setItems] = useState(messages);
  const [body, setBody] = useState("");
  const [attachment, setAttachment] = useState<File | null>(null);
  const [status, setStatus] = useState("");
  const [isSending, setIsSending] = useState(false);
  const threadRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const refreshMessages = useCallback(async () => {
    if (!conversationId) return;
    const result = await safeFetch<{ success: boolean; messages?: ApiMessage[] }>(`/api/messages/${conversationId}`);
    if (!result.ok || !Array.isArray(result.data.messages)) return;
    setItems(
      result.data.messages.map((message) => ({
        id: message.id,
        body: message.body,
        senderId: message.sender_id,
        createdAt: message.created_at,
        readAt: message.read_at,
        attachment: message.attachment ?? null,
      })),
    );
  }, [conversationId]);

  useEffect(() => {
    if (!conversationId) return;
    void refreshMessages();
    const timer = globalThis.setInterval(() => void refreshMessages(), 4_000);
    return () => globalThis.clearInterval(timer);
  }, [conversationId, refreshMessages]);

  useEffect(() => {
    if (threadRef.current) {
      threadRef.current.scrollTop = threadRef.current.scrollHeight;
    }
  }, [items.length]);

  const unreadIncoming = items.filter((message) => message.senderId !== currentProfileId && !message.readAt).length;

  useEffect(() => {
    if (!conversationId || unreadIncoming === 0) return;

    let cancelled = false;
    void safeFetch("/api/messages/read", { method: "PATCH", body: { conversationId } }).then((result) => {
      if (cancelled || !result.ok) return;
      setItems((current) =>
        current.map((message) =>
          message.senderId !== currentProfileId ? { ...message, readAt: message.readAt ?? new Date().toISOString() } : message,
        ),
      );
    });

    return () => {
      cancelled = true;
    };
  }, [conversationId, currentProfileId, unreadIncoming]);

  async function uploadAttachment(file: File) {
    if (!projectId) return { ok: false as const, message: "No active project is available for this attachment." };

    const form = new FormData();
    form.set("projectId", projectId);
    form.set("title", file.name);
    form.set("category", "Message Attachment");
    form.set("visibility", "client_upload");
    form.set("file", file);

    try {
      const response = await fetch("/api/project-files", { method: "POST", body: form });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.file?.id) {
        return { ok: false as const, message: payload?.message ?? "Attachment upload failed." };
      }
      return { ok: true as const, fileId: String(payload.file.id) };
    } catch {
      return { ok: false as const, message: "Attachment upload failed. Check your connection and try again." };
    }
  }

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!conversationId || (!body.trim() && !attachment)) return;

    setIsSending(true);
    setStatus("");

    let attachmentFileId: string | undefined;
    if (attachment) {
      const upload = await uploadAttachment(attachment);
      if (!upload.ok) {
        setIsSending(false);
        setStatus(upload.message);
        return;
      }
      attachmentFileId = upload.fileId;
    }

    const messageBody = body.trim() || `Shared a file: ${attachment?.name ?? "attachment"}`;
    const result = await safeFetch<{ success: boolean; message?: { id: string; body: string } | string }>("/api/messages", {
      method: "POST",
      body: { conversationId, body: messageBody, attachmentFileId },
    });
    setIsSending(false);

    const sentMessage = result.ok ? result.data?.message : undefined;
    if (!sentMessage || typeof sentMessage === "string") {
      const fallback = !result.ok ? result.message : "Message could not be sent.";
      setStatus(typeof sentMessage === "string" ? sentMessage : fallback);
      return;
    }

    setBody("");
    setAttachment(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    await refreshMessages();
  }

  return (
    <section className="panel">
      <div className="section-heading">
        <h2>Planner Messages</h2>
        <span className="mini-meta">Updates automatically</span>
      </div>
      <div className="message-panel">
        <div aria-live="polite" ref={threadRef}>
          {items.map((message) => {
            const fromAdmin = message.senderId !== currentProfileId;
            return (
              <div className={fromAdmin ? "bubble admin" : "bubble"} key={message.id}>
                <div>{message.body}</div>
                {message.attachment ? (
                  <a
                    href={message.attachment.url}
                    rel="noreferrer"
                    target="_blank"
                    style={{ display: "inline-flex", gap: 6, alignItems: "center", marginTop: 8, textDecoration: "underline" }}
                  >
                    <Paperclip size={14} /> {message.attachment.fileName}
                  </a>
                ) : null}
              </div>
            );
          })}
          {!items.length ? <p className="mini-meta">No messages yet.</p> : null}
        </div>
        <form onSubmit={sendMessage} style={{ display: "grid", gap: 8 }}>
          <div style={{ display: "flex", gap: 8 }}>
            <Input
              aria-label="Write a message to your planner"
              disabled={!conversationId || isSending}
              onChange={(event) => setBody(event.target.value)}
              placeholder="Write a message"
              value={body}
            />
            <Button disabled={!conversationId || isSending || (!body.trim() && !attachment)} type="submit" aria-label="Send message">
              <Send size={16} />
            </Button>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <label className="btn btn-light" style={{ cursor: isSending ? "not-allowed" : "pointer" }}>
              <Paperclip size={15} /> Attach File / Photo
              <input
                accept="image/jpeg,image/png,image/webp,image/heic,image/heif,application/pdf,.heic,.heif"
                aria-label="Attach a file or photo"
                disabled={!conversationId || isSending}
                onChange={(event) => setAttachment(event.target.files?.[0] ?? null)}
                ref={fileInputRef}
                style={{ display: "none" }}
                type="file"
              />
            </label>
            {attachment ? <span className="mini-meta">{attachment.name}</span> : null}
          </div>
        </form>
        {status ? <p className="form-error" role="alert">{status}</p> : null}
      </div>
    </section>
  );
}
