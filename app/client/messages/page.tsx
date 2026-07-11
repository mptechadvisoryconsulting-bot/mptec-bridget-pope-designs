import { MessagePanel } from "@/components/client/MessagePanel";

export default function MessagesPage() {
  return (
    <div>
      <div className="client-hero"><div><span className="eyebrow">Messages</span><h1>Planner Chat</h1></div></div>
      <MessagePanel />
    </div>
  );
}
