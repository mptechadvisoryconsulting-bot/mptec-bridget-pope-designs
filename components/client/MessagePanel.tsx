import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function MessagePanel() {
  return (
    <section className="panel">
      <h2>Planner Messages</h2>
      <div className="message-panel">
        <div className="bubble">Your final design review is scheduled for May 10. We will bring palette options.</div>
        <div className="bubble admin">Perfect. I uploaded the venue measurements to documents.</div>
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
