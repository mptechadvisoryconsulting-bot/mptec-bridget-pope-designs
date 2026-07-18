import Link from "next/link";
import { ButtonLink } from "@/components/ui/button";

export function OwnerClientPortalGate({ role = "owner" }: { role?: string }) {
  const roleLabel = role === "admin" ? "admin" : "owner";

  return (
    <div className="app-shell" style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24 }}>
      <section className="panel" style={{ maxWidth: 560, width: "100%" }}>
        <span className="eyebrow">Client portal</span>
        <h1 style={{ marginTop: 8 }}>Client portal requires a client login</h1>
        <p className="mini-meta" style={{ marginTop: 12, lineHeight: 1.5 }}>
          You are currently signed in as an {roleLabel}. The client portal is only available to client accounts.
          Visiting <code>/client</code> while logged into the owner dashboard will not open a client workspace.
        </p>
        <ul className="list" style={{ marginTop: 16 }}>
          <li>
            <span>To test the portal</span>
            <strong>Invite a client, then log out and sign in with those credentials</strong>
          </li>
          <li>
            <span>Invite path</span>
            <strong>Admin → Clients → Invite Client</strong>
          </li>
        </ul>
        <div className="topbar-actions" style={{ marginTop: 20, justifyContent: "flex-start" }}>
          <ButtonLink href="/admin/clients#invite-client">Invite Client</ButtonLink>
          <ButtonLink href="/auth/logout" variant="secondary">
            Log out to use client login
          </ButtonLink>
          <ButtonLink href="/admin" variant="light">
            Back to owner dashboard
          </ButtonLink>
        </div>
        <p className="mini-meta" style={{ marginTop: 16 }}>
          Client login URL: <Link href="/auth/login?next=/client/dashboard">/auth/login?next=/client/dashboard</Link>
        </p>
      </section>
    </div>
  );
}
