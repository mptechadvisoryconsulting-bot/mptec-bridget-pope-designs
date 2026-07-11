import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Message = {
  id: string;
  body: string;
  fromAdmin?: boolean;
};

export function MessagePanel({ messages = [] }: { messages?: Message[] }) {
  return (
    <section className="panel">
      <h2>Planner Messages</h2>
      <div className="message-panel">
        {messages.map((message) => (
          <div className={message.fromAdmin ? "bubble admin" : "bubble"} key={message.id}>{message.body}</div>
        ))}
        {!messages.length ? <p className="mini-meta">No messages yet.</p> : null}
        <div style={{ display: "flex", gap: 8 }}>
          <Input placeholder="Write a message" />
          <Button type="button" aria-label="Send message">
            <Send size={16} />
          </Button>
        </div>
      </div>
    </section>
  );
}
