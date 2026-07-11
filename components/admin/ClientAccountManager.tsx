"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/form";
import { Input } from "@/components/ui/input";

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
  clientName: string;
  username: string;
  eventName: string;
  eventType: string;
  eventDate: string;
  status: string;
};

export function ClientAccountManager({ projects }: { projects: ClientProject[] }) {
  const [message, setMessage] = useState("");
  const [rows, setRows] = useState(projects);
  const [isCreating, setIsCreating] = useState(false);

  async function createClient(formData: FormData) {
    setIsCreating(true);
    setMessage("");

    const response = await fetch("/api/admin/client-accounts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(Object.fromEntries(formData.entries())),
    });
    const payload = await response.json();

    if (payload.success) {
      setMessage(`Client portal created for ${payload.username}. Share that username and the password you entered with the client.`);
      window.location.reload();
      return;
    }

    setMessage(payload.message ?? "Unable to create client portal.");
    setIsCreating(false);
  }

  async function updateStatus(projectId: string, status: string) {
    setRows((current) => current.map((row) => (row.id === projectId ? { ...row, status } : row)));

    const response = await fetch(`/api/admin/projects/${projectId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    const payload = await response.json();

    setMessage(payload.success ? "Project status updated for the client portal." : payload.message ?? "Unable to update status.");
  }

  return (
    <div className="dashboard-grid">
      <form action={createClient} className="panel form-grid span-2">
        <h2 className="wide">Create Client Portal</h2>
        <Field label="Username"><Input name="username" placeholder="Ashley20" required /></Field>
        <Field label="Temporary Password"><Input name="password" placeholder="Give this to the client" required type="password" /></Field>
        <Field label="First Name"><Input name="firstName" placeholder="Ashley" required /></Field>
        <Field label="Last Name"><Input name="lastName" placeholder="Johnson" required /></Field>
        <Field label="Client Email"><Input name="email" placeholder="ashley@example.com" type="email" /></Field>
        <Field label="Phone"><Input name="phone" placeholder="(629) 555-0100" /></Field>
        <Field label="Event Name"><Input name="eventName" placeholder="Elegant Garden Wedding" required /></Field>
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
        {message ? <p className={message.includes("Unable") ? "form-error wide" : "form-success wide"}>{message}</p> : null}
        <Button className="wide" disabled={isCreating} type="submit">{isCreating ? "Creating..." : "Create Portal Account"}</Button>
      </form>

      <section className="panel span-2">
        <h2>Client Portal Projects</h2>
        <table className="table">
          <thead>
            <tr>
              <th>Client</th>
              <th>Username</th>
              <th>Event</th>
              <th>Date</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((project) => (
              <tr key={project.id}>
                <td>{project.clientName}</td>
                <td>{project.username}</td>
                <td>{project.eventName}<span className="mini-meta">{project.eventType}</span></td>
                <td>{project.eventDate || "Not set"}</td>
                <td>
                  <select className="input" value={project.status} onChange={(event) => updateStatus(project.id, event.target.value)}>
                    {projectStatuses.map((status) => (
                      <option key={status} value={status}>{status.replace(/_/g, " ")}</option>
                    ))}
                  </select>
                </td>
              </tr>
            ))}
            {!rows.length ? (
              <tr>
                <td colSpan={5}>No client portal projects yet.</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </section>
    </div>
  );
}
