"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export function DesignResponseActions({ updateId }: { updateId: string }) {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [isWorking, setIsWorking] = useState(false);

  async function respond(action: "approve" | "request_changes") {
    setIsWorking(true);
    setMessage("");
    try {
      const response = await fetch(`/api/design-updates/${updateId}/respond`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action,
          message: action === "approve" ? "Approved" : "Please review the requested changes.",
        }),
      });
      const result = await response.json().catch(() => ({ success: false, message: "Invalid server response." }));
      if (!response.ok || !result.success) {
        setMessage(result.message ?? "Unable to submit your response.");
        return;
      }
      setMessage(action === "approve" ? "Design approved." : "Change request sent.");
      router.refresh();
    } catch {
      setMessage("Unable to submit your response.");
    } finally {
      setIsWorking(false);
    }
  }

  return (
    <div>
      <div className="topbar-actions">
        <Button disabled={isWorking} onClick={() => respond("approve")} type="button">Approve</Button>
        <Button disabled={isWorking} onClick={() => respond("request_changes")} type="button" variant="secondary">Request Changes</Button>
      </div>
      {message ? <p className={message.includes("Unable") ? "form-error" : "form-success"}>{message}</p> : null}
    </div>
  );
}
