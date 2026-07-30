import {
  offlinePaymentLines,
  type OfflinePaymentSettings,
} from "@/lib/business/payment-instructions";

export function OfflinePaymentInstructions({
  settings,
  compact = false,
}: {
  settings: OfflinePaymentSettings | null | undefined;
  compact?: boolean;
}) {
  const lines = offlinePaymentLines(settings);
  if (!lines.length) return null;

  return (
    <div className={compact ? "invoice-offline-pay compact" : "invoice-offline-pay"}>
      <h2 style={{ marginTop: compact ? 0 : undefined }}>How to pay</h2>
      <p className="mini-meta" style={{ marginBottom: 10 }}>
        Arrangements are offline — no card checkout on this site. Use one of the options below, then Bridget will record your payment.
      </p>
      <ul className="list">
        {lines.map((line) => (
          <li key={line.label}>
            <span>{line.label}</span>
            <span className="status" style={{ whiteSpace: "pre-wrap", textAlign: "right" }}>
              {line.value}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
