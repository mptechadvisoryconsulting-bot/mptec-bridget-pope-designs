import { Download, FileSignature, FolderOpen, Upload } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";

export function ClientSectionPage({
  title,
  eyebrow,
  description = "This workspace shows records shared to your Bridget Pope Designs client portal.",
}: {
  title: string;
  eyebrow: string;
  description?: string;
}) {
  return (
    <div>
      <div className="client-hero">
        <div>
          <span className="eyebrow">{eyebrow}</span>
          <h1>{title}</h1>
          <p className="mini-meta">{description}</p>
        </div>
      </div>
      <div className="placeholder-grid">
        <section className="panel">
          <h2>Shared Records</h2>
          <p className="mini-meta">No records have been shared here yet.</p>
          <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
            <ButtonLink href="/client/messages">
              <FileSignature size={16} /> Ask Planner
            </ButtonLink>
            <ButtonLink href="/client/documents" variant="light">
              <Download size={16} /> Documents
            </ButtonLink>
          </div>
        </section>
        <section className="panel">
          <h2>Project Activity</h2>
          <ul className="list">
            <li><span>Updates from the admin dashboard will appear here.</span><span className="status">Synced</span></li>
            <li><span>Client-visible files and design notes stay attached to your project.</span><span className="status">Private</span></li>
          </ul>
        </section>
        <section className="panel">
          <h2>Related Areas</h2>
          <ul className="list">
            <li><a href="/client/invoices">Invoices</a><span className="mini-meta">Billing</span></li>
            <li><a href="/client/timeline">Timeline</a><span className="mini-meta">Milestones</span></li>
            <li><a href="/client/files">Files</a><span className="mini-meta">Documents</span></li>
          </ul>
        </section>
        <section className="placeholder-hero">
          <FolderOpen color="var(--blush)" size={34} />
          <h1>Project Files</h1>
          <p className="mini-meta">Admin uploads and client submissions appear here after they are attached to your project.</p>
          <Upload color="var(--gold)" size={24} />
        </section>
      </div>
    </div>
  );
}
