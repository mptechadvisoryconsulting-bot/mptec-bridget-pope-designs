import { z } from "zod";

export const pipelineActionSchema = z.object({
  action: z.enum(["open_proposal", "proposal_sent", "proposal_approved", "invoice_paid", "project_started"]),
  proposalId: z.string().uuid().optional(),
  invoiceId: z.string().uuid().optional(),
  note: z.string().trim().max(2000).optional().or(z.literal("")),
});

export type PipelineActionInput = z.infer<typeof pipelineActionSchema>;
