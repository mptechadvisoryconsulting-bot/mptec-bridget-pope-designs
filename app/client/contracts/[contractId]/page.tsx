import { FileSignature } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";

export default async function ContractDetailPage({ params }: { params: Promise<{ contractId: string }> }) {
  const { contractId } = await params;
  return (
    <div>
      <div className="client-hero">
        <div>
          <span className="eyebrow">Contract {contractId}</span>
          <h1>Event Services Agreement</h1>
          <p className="mini-meta">Electronic signature, date signed, signed PDF storage, and client/admin copies are represented here.</p>
        </div>
      </div>
      <section className="panel">
        <h2>Signature Status</h2>
        <p>Contract signed by Ashley Johnson on May 1, 2025.</p>
        <ButtonLink href="/client/payments"><FileSignature size={16} /> Continue to Deposit</ButtonLink>
      </section>
    </div>
  );
}
