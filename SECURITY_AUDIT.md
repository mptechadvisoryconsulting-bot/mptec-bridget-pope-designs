# Service-Role Route Security Audit

Last reviewed: 2026-08-19

## Verified Authorization Controls

The following routes were re-reviewed during the August 2026 hardening pass.

- `POST /api/invoices`
  - Classification: owner/admin only
  - Status: previously fixed; retain regression coverage.

- `GET /api/invoices/[invoiceId]`
  - Classification: owner/admin or owning client
  - Status: previously fixed; unauthorized callers receive a generic response.

- `POST /api/admin/client-accounts`
  - Classification: owner/admin only
  - Status: previously fixed.

- `PATCH /api/admin/projects/[projectId]/status`
  - Classification: owner/admin only
  - Status: previously fixed.

- `PUT /api/admin/settings`
  - Classification: owner/admin only
  - Status: previously fixed.

- `POST /api/uploads`
  - Classification: owner/admin only
  - Status: verified.
  - Notes: requires `requireAdminProfile()`, limits uploads to JPG/PNG/WebP at 15 MB, and now removes the uploaded storage object if the database record cannot be created.

- `GET /api/leads`
  - Classification: owner/admin only
  - Status: verified.
  - Notes: requires `requireAdminProfile()` and no longer returns raw database error messages to the caller.

- `POST /api/files`
  - Classification: owner/admin for management; authenticated client for allowed client uploads to an owned project.
  - Status: verified for create path.
  - Notes: validates active profile, role, and project ownership before service-role writes; raw persistence errors are logged server-side instead of returned to the caller.

- `POST /api/messages`
  - Classification: authenticated conversation participants.
  - Status: verified for create path.
  - Notes: validates active profile and conversation access and applies per-user/IP rate limiting before service-role writes.

## Existing Acceptable Service-Role Routes

- `POST /api/inquiries`
  - Classification: public
  - Reason: public landing-page form must create leads and notifications. Rate limited and validated.

- `/api/cron/*`
  - Classification: cron secret
  - Reason: requires `CRON_SECRET`.

## Remaining Authorization Review

Production hardening is not complete until these service-role paths are individually reviewed and covered by authorization tests:

- `/api/files/[fileId]`
- `/api/leads/[leadId]`
- `/api/leads/[leadId]/convert`
- `/api/consultations` and `/api/consultations/[consultationId]`
- `/api/design-updates` and `/api/design-updates/[updateId]`
- `/api/messages/[conversationId]`
- `/api/notifications`, `/api/notifications/[notificationId]`, `/api/notifications/mark-all-read`
- `/api/proposals/[proposalId]/send` and `/api/proposals/[proposalId]/approve`
- `/api/contracts/[contractId]/sign`
- `/api/invoices/[invoiceId]/payments`

For each route, verify authentication, role/ownership checks before service-role access, generic unauthorized/not-found responses, and tests for cross-client access attempts.

## Dependency Security

The previous July audit recorded two moderate vulnerabilities from an `npm install`. That result is stale and must not be treated as the current dependency state.

The repository is pinned to pnpm, so the next validated dependency pass should run:

```bash
pnpm install --frozen-lockfile
pnpm audit
pnpm typecheck
pnpm test
pnpm build
```

As of 2026-08-19, the project still declares Next.js `15.5.20`. The July 2026 Next.js security release requires the 15.5 maintenance line to be upgraded to at least `15.5.21`. Regenerate and commit `pnpm-lock.yaml` with the package update, then run the full validation commands above before merging that dependency change.

Do not use a force audit fix on production dependencies without reviewing the resulting major-version changes.
