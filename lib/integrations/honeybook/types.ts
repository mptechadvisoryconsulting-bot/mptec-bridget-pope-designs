export const honeybookPipelineStages = [
  "lead_received",
  "consultation",
  "proposal_draft",
  "honeybook_opened",
  "proposal_sent",
  "proposal_approved",
  "project_started",
  "invoice_paid",
  "completed",
] as const;

export type HoneyBookPipelineStage = (typeof honeybookPipelineStages)[number];

export type HoneyBookOpenContext = {
  projectId: string;
  actorId?: string | null;
  honeybookUrl?: string | null;
  note?: string | null;
};

export type HoneyBookStageContext = {
  projectId: string;
  actorId?: string | null;
  leadId?: string | null;
  note?: string | null;
  metadata?: Record<string, unknown>;
  source?: "manual" | "honeybook_api" | "system";
};

export type HoneyBookInboundEvent = {
  event_id: string;
  event_type: string;
  occurred_at: string;
  honeybook_project_id?: string | null;
  client_email?: string | null;
  invoice_number?: string | null;
  invoice_total?: number | null;
  amount_paid?: number | null;
  balance_remaining?: number | null;
  invoice_status?: string | null;
  due_date?: string | null;
  honeybook_url?: string | null;
  project_id?: string | null;
  stage?: HoneyBookPipelineStage | null;
};

export type HoneyBookOpenResult = {
  url: string;
  stage: HoneyBookPipelineStage;
};

export type HoneyBookStageResult = {
  stage: HoneyBookPipelineStage;
  eventId?: string | null;
};

export type HoneyBookFinancialReferenceResult = {
  referenceId: string;
};

export type HoneyBookInboundResult = {
  matched: boolean;
  duplicate?: boolean;
  projectId?: string | null;
  stage?: HoneyBookPipelineStage | null;
};

export type HoneyBookReferenceUpsertInput = {
  projectId: string;
  clientId: string;
  honeybookProjectId?: string | null;
  honeybookInvoiceNumber?: string | null;
  invoiceTotal?: number | null;
  amountPaid?: number | null;
  balanceRemaining?: number | null;
  invoiceStatus?: string | null;
  invoiceDate?: string | null;
  dueDate?: string | null;
  honeybookUrl?: string | null;
  source?: "manual" | "pdf_import" | "csv_import" | "automation";
};

export interface HoneyBookService {
  getOpenUrl(context: HoneyBookOpenContext): Promise<HoneyBookOpenResult>;
  markStage(stage: HoneyBookPipelineStage, context: HoneyBookStageContext): Promise<HoneyBookStageResult>;
  upsertFinancialReference(
    input: HoneyBookReferenceUpsertInput,
    options?: { actorId?: string | null },
  ): Promise<HoneyBookFinancialReferenceResult>;
  handleInboundEvent(event: HoneyBookInboundEvent): Promise<HoneyBookInboundResult>;
}
