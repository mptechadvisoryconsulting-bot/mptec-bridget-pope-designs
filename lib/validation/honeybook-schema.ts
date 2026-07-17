import { z } from "zod";
import { honeybookPipelineStages } from "@/lib/integrations/honeybook/types";

const optionalDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD")
  .optional()
  .or(z.literal(""));

const money = z.coerce.number().min(0).optional().or(z.literal(""));

export const honeybookReferenceSchema = z.object({
  projectId: z.string().uuid(),
  clientId: z.string().uuid(),
  honeybookProjectId: z.string().trim().max(160).optional().or(z.literal("")),
  honeybookInvoiceNumber: z.string().trim().max(160).optional().or(z.literal("")),
  invoiceTotal: money,
  amountPaid: money,
  balanceRemaining: money,
  invoiceStatus: z.string().trim().max(80).optional().or(z.literal("")),
  invoiceDate: optionalDate,
  dueDate: optionalDate,
  honeybookUrl: z.string().trim().url().optional().or(z.literal("")),
  source: z.enum(["manual", "pdf_import", "csv_import", "automation"]).default("manual"),
});

export const honeybookIntegrationEventSchema = z.object({
  event_id: z.string().trim().min(4).max(200),
  event_type: z.string().trim().min(2).max(120),
  occurred_at: z.string().datetime(),
  honeybook_project_id: z.string().trim().max(160).optional().nullable(),
  client_email: z.string().trim().email().optional().nullable(),
  invoice_number: z.string().trim().max(160).optional().nullable(),
  invoice_total: z.coerce.number().min(0).optional().nullable(),
  amount_paid: z.coerce.number().min(0).optional().nullable(),
  balance_remaining: z.coerce.number().min(0).optional().nullable(),
  invoice_status: z.string().trim().max(80).optional().nullable(),
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  honeybook_url: z.string().trim().url().optional().nullable(),
  project_id: z.string().uuid().optional().nullable(),
  stage: z.enum(honeybookPipelineStages).optional().nullable(),
});

export const pipelineActionSchema = z.object({
  action: z.enum(["open_honeybook", "proposal_sent", "proposal_approved", "invoice_paid", "project_started"]),
  honeybookUrl: z.string().trim().url().optional().or(z.literal("")),
  proposalId: z.string().uuid().optional(),
  invoiceId: z.string().uuid().optional(),
  note: z.string().trim().max(2000).optional().or(z.literal("")),
});

export type HoneyBookReferenceFormInput = z.infer<typeof honeybookReferenceSchema>;
export type PipelineActionInput = z.infer<typeof pipelineActionSchema>;
