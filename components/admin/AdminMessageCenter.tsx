"use client";

import { Paperclip, Send } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
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
  created_at: string;
  read_at?: string | null;
  attachment?: MessageAttachment | null;
};

type MessageRow = {
  id: string;
  conversationId: string;
  body: string;
  senderId?: string | null;
  createdAt: string;
  readAt?: string | null;
  attachment?: MessageAttachment | null;
};

type ConversationRow = {
  id: string;
  projectId: string;
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
  const [attachment, setAttachment] = useState<File | null>(null);
  const [status, setStatus] = useState("");
  const [isSending, setIsSending] = useState(false);
  const threadRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const active = useMemo(() => rows.find((row) => row.id === activeId) ?? rows[0], [rows, activeId]);
  const activeUnread = active ? unreadCount(active) : 0;

  useEffect(() => {
    setRows(conversations);
  }, [conversations]);

  useEffect(() => {
    const timer = globalThis.setInterval(() => router.refresh(), 15_000);
    return () => globalThis.clearInterval(timer);
  }, [router]);

  useEffect(() => {
    if (!active?.id) return;
    let cancelled = false;

    async function refreshActiveThread() {
      if (!active?.id) return;
      const result = await safeFetch<{ success: boolean; messages?: ApiMessage[] }>(`/api/messages/${active.id}`);
      if (cancelled || !result.ok || !Array.isArray(result.data.messages)) return;
      const nextMessages = result.data.messages.map((message) => ({
        id: message.id,
        conversationId: active.id,
        body: message.body,
        senderId: message.sender_id,
        createdAt: message.created_at,
        readAt: message.read_at,
        attachment: message.attachment ?? null,
      }));
      setRows((current) => current.map((row) => (row.id === active.id ? { ...row, messages: nextMessages } : row)));
    }

    void refreshActiveThread();
    const timer = globalThis.setInterval(() => void refreshActiveThread(), 4_000);
    return () => {
      cancelled = true;
      globalThis.clearInterval(timer);
    };
  }, [active?.id]);

  useEffect(() => {
    if (threadRef.current) {
      threadRef.current.scrollTop = threadRef.current.scrollHeight;
    }
  }, [active?.messages.length, active?.id]);

  useEffect(() => {
    if (!active?.id || activeUnread === 0) return;

    let cancelled = false;
    void safeFetch("/api/messages/read", { method: "PATCH", body: { conversationId: active.id } }).then((result) => {
      if (cancelled || !result.ok) return;
      setRows((current) =>
        current.map((row) =>
          row.id === active.id
            ? {
                ...row,
                messages: row.messages.map((message) =>
                  message.senderId === row.clientProfileId ? { ...message, readAt: message.readAt ?? new Date().toISOString() } : message,
                ),
              }
            : row,
        ),
      );
    });

    return () => {
      cancelled = true;
    };
  }, [active?.id, activeUnread]);

  function selectConversation(conversationId: string) {
    setActiveId(conversationId);
    setStatus("");
    setAttachment(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    const params = new URLSearchParams(searchParams.toString());
    params.set("conversation", conversationId);
    router.replace(`/admin/messages?${params.toString()}`, { scroll: false });
    inputRef.current?.focus();
  }

  async function uploadAttachment(file: File, projectId: string) {
    const form = new FormData();
    form.set("projectId", projectId);
    form.set("title", file.name);
    form.set("category", "Message Attachment");
    form.set("visibility", "client_visible");
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

  async function refreshCurrentThread(conversationId: string) {
    const result = await safeFetch<{ success: boolean; messages?: ApiMessage[] }>(`/api/messages/${conversationId}`);
    if (!result.ok || !Array.isArray(result.data.messages)) return;
    setRows((current) =>
      current.map((row) =>
        row.id === conversationId
          ? {
              ...row,
              messages: result.data.messages!.map((message) => ({
                id: message.id,
                conversationId,
                body: message.body,
                senderId: message.sender_id,
                createdAt: message.created_at,
                readAt: message.read_at,
                attachment: message.attachment ?? null,
              })),
            }
          : row,
      ),
    );
  }

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!active?.id || (!body.trim() && !attachment)) return;

    setIsSending(true);
    setStatus("");

    let attachmentFileId: string | undefined;
    if (attachment) {
      const upload = await uploadAttachment(attachment, active.projectId);
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
      body: { conversationId: active.id, body: messageBody, attachmentFileId },
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
    await refreshCurrentThread(active.id);
  }

  return (
    <div className="message-center">
      <section className="panel message-list-panel">
        <div className="section-heading">
          <h2>Conversations</h2>
          <span className="mini-meta">Auto-refreshing</span>
        </div>
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
              <small>{new Date(message.createdAt).toLocaleString("en-US")}</small>
            </div>
          ))}
          {!active?.messages.length ? <p className="mini-meta">No messages have been sent for this project.</p> : null}
        </div>
        <form onSubmit={sendMessage} style={{ display: "grid", gap: 8, marginTop: 12 }}>
          <div style={{ display: "flex", gap: 8 }}>
            <Input
              aria-label="Reply to client"
              disabled={!active || isSending}
              onChange={(event) => setBody(event.target.value)}
              placeholder="Reply to client"
              ref={inputRef}
              value={body}
            />
            <Button disabled={!active || isSending || (!body.trim() && !attachment)} type="submit" aria-label="Send message">
              <Send size={16} />
            </Button>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <label className="btn btn-light" style={{ cursor: isSending ? "not-allowed" : "pointer" }}>
              <Paperclip size={15} /> Attach File / Photo
              <input
                accept="image/jpeg,image/png,image/webp,image/heic,image/heif,application/pdf,.heic,.heif"
                aria-label="Attach a file or photo"
                disabled={!active || isSending}
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
      </section>
    </div>
  );
}
