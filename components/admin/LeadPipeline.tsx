import { pipeline } from "@/lib/data";

type PipelineStage = {
  label: string;
  value: number;
  color: string;
};

export function LeadPipeline({ stages = pipeline, total = 18 }: { stages?: PipelineStage[]; total?: number }) {
  return (
    <section className="panel">
      <h2>Leads by Status</h2>
      <div className="donut-wrap">
        <div className="donut">
          <strong>{total}</strong>
        </div>
        <ul className="list">
          {stages.map((stage) => (
            <li key={stage.label}>
              <span style={{ alignItems: "center", display: "inline-flex", gap: 8 }}>
                <span style={{ background: stage.color, borderRadius: 99, display: "inline-block", height: 8, width: 8 }} />
                {stage.label}
              </span>
              <strong>{stage.value}</strong>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
