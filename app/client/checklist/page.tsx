import { Checklist } from "@/components/client/Checklist";

export default function ChecklistPage() {
  return (
    <div>
      <div className="client-hero"><div><span className="eyebrow">Checklist</span><h1>Client Checklist</h1></div></div>
      <Checklist />
    </div>
  );
}
