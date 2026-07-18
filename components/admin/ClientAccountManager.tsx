"use client";

import { useState } from "react";
import { KeyRound, Mail, UserX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { requestClientAccountsApi } from "@/lib/client-accounts-client";

const projectStatuses = [
  "pending",
  "booked",
  "planning",
  "design_in_progress",
  "awaiting_client_approval",
  "finalizing",
  "ready_for_event",
  "event_complete",
  "closed",
  "cancelled",
];

type ClientProject = {
  id: string;
  profileId: string;
  clientName: string;
  username: string;
  email: string;
  active: boolean;
  eventName: string;
  eventType: string;
  eventDate: string;
  status: string;
};

type ClientAction = "resend-invitation" | "deactivate" | "reset-password";

export function ClientAccountManager({ projects }: { projects: ClientProject[] }) {
  const [message, setMessage] = useState("");
  const [messageKind, setMessageKind] = useState<"error" | "success">("success");
  const [rows, setRows] = useState(projects);
  const [isCreating, setIsCreating] = useState(false);
  const [pendingAction, setPendingAction] = useState<string | null>(null);

  async function createClient(formData: FormData) {
    setIsCreating(true);
    setMessage("");

    try {
      const result = await requestClientAccountsApi("/api/admin/client-accounts", {
        body: Object.fromEntries(formData.entries()),
      });

      if (result.ok) {
        setMessageKind("success");
        setMessage(result.message ?? "Invitation sent. The client will receive an email to set up their portal login.");
        window.location.reload();
        return;
      }

      setMessageKind("error");
      setMessage(result.message);
    } finally {
      setIsCreating(false);
    }
  }

  async function updateStatus(projectId: string, status: string) {
    setRows((current) => current.map((row) => (row.id === projectId ? { ...row, status } : row)));

    const result = await requestClientAccountsApi(`/api/admin/projects/${projectId}/status`, {
      method: "PATCH",
      body: { status },
    });

    setMessageKind(result.ok ? "success" : "error");
    setMessage(result.ok ? "Project status updated for the client portal." : result.message);
  }

  async function runAction(profileId: string, action: ClientAction) {
    if (!profileId) return;

    const actionKey = `${profileId}:${action}`;
    setPendingAction(actionKey);
    setMessage("");

    try {
      const result = await requestClientAccountsApi(`/api/admin/client-accounts/${profileId}/${action}`, {});

      if (result.ok) {
        setMessageKind("success");
        setMessage(result.message ?? "Done.");
        if (action === "deactivate") {
          setRows((current) => current.map((row) => (row.profileId === profileId ? { ...row, active: false } : row)));
        }
        return;
      }

      setMessageKind("error");
      setMessage(result.message);
    } finally {
      setPendingAction(null);
    }
  }

  return (
    <div className="dashboard-grid">
      <form action={createClient} className="panel form-grid span-2" id="invite-client-form">
        <h2 className="wide">Invite Client</h2>
        <p className="mini-meta wide">
          Sends a portal invitation email. After the client sets a password, they sign in at the client login — not
          while you remain logged in as owner.
        </p>
        <Field label="First Name"><Input name="firstName" placeholder="First name" required /></Field>
        <Field label="Last Name"><Input name="lastName" placeholder="Johnson" required /></Field>
        <Field label="Client Email"><Input name="email" placeholder="ashley@example.com" required type="email" /></Field>
        <Field label="Username (optional)"><Input name="username" placeholder="Client20" /></Field>
        <Field label="Phone"><Input name="phone" placeholder="(629) 555-0100" /></Field>
        <Field label="Event Name"><Input name="eventName" placeholder="Client Event" required /></Field>
        <Field label="Event Type"><Input name="eventType" placeholder="Wedding" required /></Field>
        <Field label="Event Date"><Input name="eventDate" type="date" /></Field>
        <Field label="Venue"><Input name="venue" placeholder="Murfreesboro, TN" /></Field>
        <label className="field">
          <span>Status</span>
          <select className="input" defaultValue="planning" name="status">
            {projectStatuses.slice(0, 8).map((status) => (
              <option key={status} value={status}>{status.replace(/_/g, " ")}</option>
            ))}
          </select>
        </label>
        {message ? <p className={messageKind === "success" ? "form-success wide" : "form-error wide"}>{message}</p> : null}
        <Button className="wide" disabled={isCreating} type="submit">{isCreating ? "Sending invitation..." : "Send Client Invitation"}</Button>
      </form>

      <section className="panel span-2">
        <h2>Client Portal Projects</h2>
        <table className="table">
          <thead>
            <tr>
              <th>Client</th>
              <th>Email</th>
              <th>Event</th>
              <th>Date</th>
              <th>Status</th>
              <th>Portal Access</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((project) => (
              <tr key={project.id}>
                <td>{project.clientName}</td>
                <td>{project.email || "Not set"}</td>
                <td>{project.eventName}<span className="mini-meta">{project.eventType}</span></td>
                <td>{project.eventDate || "Not set"}</td>
                <td>
                  <select className="input" value={project.status} onChange={(event) => updateStatus(project.id, event.target.value)}>
                    {projectStatuses.map((status) => (
                      <option key={status} value={status}>{status.replace(/_/g, " ")}</option>
                    ))}
                  </select>
                </td>
                <td>
                  <div className="topbar-actions">
                    <Button
                      disabled={!project.profileId || pendingAction === `${project.profileId}:resend-invitation`}
                      onClick={() => runAction(project.profileId, "resend-invitation")}
                      type="button"
                      variant="light"
                    >
                      <Mail size={16} />
                      {pendingAction === `${project.profileId}:resend-invitation` ? "Sending..." : "Resend Invite"}
                    </Button>
                    <Button
                      disabled={!project.profileId || pendingAction === `${project.profileId}:reset-password`}
                      onClick={() => runAction(project.profileId, "reset-password")}
                      type="button"
                      variant="light"
                    >
                      <KeyRound size={16} />
                      {pendingAction === `${project.profileId}:reset-password` ? "Sending..." : "Send Password Reset"}
                    </Button>
                    <Button
                      disabled={!project.profileId || !project.active || pendingAction === `${project.profileId}:deactivate`}
                      onClick={() => runAction(project.profileId, "deactivate")}
                      type="button"
                      variant="light"
                    >
                      <UserX size={16} />
                      {!project.active ? "Deactivated" : pendingAction === `${project.profileId}:deactivate` ? "Deactivating..." : "Deactivate"}
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
            {!rows.length ? (
              <tr>
                <td colSpan={6}>No client portal projects yet.</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </section>
    </div>
  );
}
