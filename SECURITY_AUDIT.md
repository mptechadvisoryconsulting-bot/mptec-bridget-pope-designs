# Service-Role Route Security Audit

Date: 2026-07-11

## Fixed In This Pass

- `POST /api/invoices`
  - Classification: owner/admin only
  - Status: fixed
  - Notes: requires an active owner/admin profile, validates project/client ownership, validates optional proposal/project ownership, uses `crypto.randomBytes`, centralizes cent-based totals, and deletes the invoice if line-item creation fails.

- `GET /api/invoices/[invoiceId]`
  - Classification: owner/admin or owning client
  - Status: fixed
  - Notes: unauthenticated or unauthorized callers receive a generic 404.

- `POST /api/admin/client-accounts`
  - Classification: owner/admin only
  - Status: fixed

- `PATCH /api/admin/projects/[projectId]/status`
  - Classification: owner/admin only
  - Status: fixed

- `PUT /api/admin/settings`
  - Classification: owner/admin only
  - Status: fixed

## Existing Acceptable Service-Role Routes

- `POST /api/inquiries`
  - Classification: public
  - Reason: public landing-page form must create leads and notifications. Rate limited and validated.

- `/api/cron/*`
  - Classification: cron secret
  - Reason: requires `CRON_SECRET`.

## Routes Requiring Follow-Up Authorization Classification

These routes still use the service-role client and should be explicitly classified before production hardening is considered complete:

- `/api/uploads`: owner/admin, or authenticated project participant depending on upload type.
- `/api/files` and `/api/files/[fileId]`: owner/admin for management; owning client for visible project files.
- `/api/leads` and `/api/leads/[leadId]`: owner/admin.
- `/api/leads/[leadId]/convert`: owner/admin.
- `/api/consultations` and `/api/consultations/[consultationId]`: owner/admin, with optional owning-client read access.
- `/api/design-updates` and `/api/design-updates/[updateId]`: owner/admin for writes; owning-client read for visible updates.
- `/api/messages` and `/api/messages/[conversationId]`: authenticated conversation participants.
- `/api/notifications`, `/api/notifications/[notificationId]`, `/api/notifications/mark-all-read`: authenticated notification recipient or owner/admin.
- `/api/proposals/[proposalId]/send` and `/api/proposals/[proposalId]/approve`: owner/admin for send; owning client for approve.
- `/api/contracts/[contractId]/sign`: owning client or owner/admin.
- `/api/invoices/[invoiceId]/payments`: owner/admin manual payment recording.

## Current Dependency Audit

After adding Vitest, `npm install` reported 2 moderate vulnerabilities. `npm audit fix --force` was not run because it can introduce breaking dependency upgrades.
