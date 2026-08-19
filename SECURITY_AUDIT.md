# Service-Role Route Security Audit

Last reviewed: 2026-08-19

## Summary

The August 2026 production-hardening pass re-reviewed the service-role API routes that were left unclassified in the July audit. The reviewed routes generally enforce authentication plus admin-role or record-ownership checks before service-role reads/writes. The prior audit therefore overstated the amount of unresolved authorization work.

Release validation is now partly complete on the isolated maintenance branch: Next.js has been patched to `15.5.21`, pnpm frozen-lockfile install passes, TypeScript typecheck passes, all 70 unit tests pass, and `next build` succeeds. Dependency audit identified five transitive advisories in `sharp`, `nanoid`, and `postcss`; patched overrides are being validated before this PR can be considered ready.

## Verified Authorization Controls

- `POST /api/invoices`
  - Classification: owner/admin only.
  - Status: previously fixed; retain regression coverage.

- `GET /api/invoices/[invoiceId]`
  - Classification: owner/admin or owning client.
  - Status: previously fixed; unauthorized callers receive a generic response.

- `POST /api/admin/client-accounts`
  - Classification: owner/admin only.
  - Status: previously fixed.

- `PATCH /api/admin/projects/[projectId]/status`
  - Classification: owner/admin only.
  - Status: previously fixed.

- `PUT /api/admin/settings`
  - Classification: owner/admin only.
  - Status: previously fixed.

- `POST /api/uploads`
  - Classification: owner/admin only.
  - Status: verified.
  - Notes: requires `requireAdminProfile()`, limits uploads to JPG/PNG/WebP at 15 MB, and removes the uploaded storage object if the database record cannot be created.

- `POST /api/files`
  - Classification: owner/admin for management; authenticated client for allowed client uploads to an owned project.
  - Status: verified.
  - Notes: validates active profile, role, and project ownership before service-role writes.

- `DELETE /api/files/[fileId]`
  - Classification: owner/admin only.
  - Status: verified.
  - Notes: requires `requireAdminProfile()` and avoids deleting a shared storage object when another file record references the same path.

- `GET /api/leads`, `GET|PATCH|DELETE /api/leads/[leadId]`, `POST /api/leads/[leadId]/convert`
  - Classification: owner/admin only.
  - Status: verified.
  - Notes: all reviewed paths require `requireAdminProfile()` before service-role access; destructive lead deletion uses an explicit confirmation value.

- `POST /api/consultations`, `PATCH /api/consultations/[consultationId]`
  - Classification: owner/admin only.
  - Status: verified.
  - Notes: both paths require `requireAdminProfile()` before service-role writes.

- `POST /api/design-updates`, `PATCH /api/design-updates/[updateId]`
  - Classification: owner/admin only.
  - Status: verified.
  - Notes: both paths require `requireAdminProfile()` and validate request fields.

- `POST /api/messages`, `GET /api/messages/[conversationId]`
  - Classification: authenticated conversation participants; admins may access assigned conversations.
  - Status: verified.
  - Notes: create validates active profile and conversation access and applies per-user/IP rate limiting; reads verify client/admin ownership before returning messages.

- `GET /api/notifications`, `PATCH /api/notifications/[notificationId]`, `POST /api/notifications/mark-all-read`
  - Classification: authenticated notification recipient; admins may explicitly target another recipient where supported.
  - Status: verified.
  - Notes: non-admin callers are always scoped to their own profile ID.

- `POST /api/proposals/[proposalId]/send`
  - Classification: owner/admin only.
  - Status: verified.
  - Notes: requires `requireAdminProfile()`.

- `POST /api/proposals/[proposalId]/approve`
  - Classification: owner/admin, assigned admin, or owning client.
  - Status: verified.
  - Notes: verifies the proposal's project and client profile before approval; lookup failures and unauthorized callers receive a generic not-found response.

- `POST /api/contracts/[contractId]/sign`
  - Classification: owning client for client signature; owner/admin or assigned admin for owner signature.
  - Status: verified.
  - Notes: signer role is checked against the contract's project/client relationship before the service-role update.

- `GET|POST /api/invoices/[invoiceId]/payments`
  - Classification: owner/admin only.
  - Status: verified.
  - Notes: requires `requireAdminProfile()`; payment input is validated and overpayment/cancelled/refunded states are rejected.

## Existing Acceptable Service-Role Routes

- `POST /api/inquiries`
  - Classification: public.
  - Reason: public landing-page form must create leads and notifications. Rate limited and validated.

- `/api/cron/*`
  - Classification: cron secret.
  - Reason: requires `CRON_SECRET`.

## Error-Disclosure Hardening

The August pass changed the reviewed endpoints to log detailed Supabase errors server-side and return generic browser-facing failures where practical. This includes leads, files create/delete, consultations, design updates, conversation reads, notifications, proposal send/approve, contract signing, invoice payment handling, and gallery uploads.

A repository-wide error-disclosure sweep should still be run after the current release-hardening work so remaining endpoints outside this reviewed set can be checked consistently. Authorization review and error-disclosure cleanup are tracked separately: a route can have correct access control while still exposing too much implementation detail on failure.

## Regression Tests Still Required

Before production hardening is considered complete, add or run tests that prove:

- a client cannot read or mutate another client's project, conversation, files, notifications, proposal, contract, or invoice;
- inactive or unauthenticated profiles receive 401/404 responses as intended;
- non-admin users cannot invoke admin-only lead, consultation, design-update, upload, proposal-send, or payment routes;
- admin overrides work only on routes that intentionally support them;
- gallery upload failure removes the just-uploaded object;
- authorization failures do not reveal whether another client's record exists.

## Contract Integrity Follow-Up

The contract signing route verifies signer authorization, but it currently permits a valid signer to submit another signature update to an already-signed side. That behavior may be intentional for corrections, so it was not changed in this low-risk pass. Before relying on these records as immutable signed artifacts, define the business rule for re-signing/versioning and add an audit/history mechanism if signatures must become immutable after execution.

## Dependency Security

Validated on Node 24 with pnpm 11.7.0:

- `pnpm install --frozen-lockfile`: passed after regenerating the lockfile with pnpm.
- `pnpm typecheck`: passed.
- `pnpm test`: 19 files / 70 tests passed.
- `pnpm build`: passed on Next.js `15.5.21`.
- `pnpm audit --audit-level=moderate`: identified five remaining transitive advisories before overrides were applied.

The audit findings were:

- `sharp <0.35.0`: high severity, inherited libvips vulnerabilities; reached through Next.js.
- `nanoid <3.3.18`: high severity infinite-loop issues; reached through PostCSS dependency paths.
- `postcss <=8.5.22`: high/moderate source-map path/file-disclosure issues.

The maintenance branch now requests pnpm overrides for `sharp 0.35.3`, `nanoid 3.3.18`, and `postcss 8.5.26`. These overrides must not be merged until pnpm regenerates the lockfile and frozen install, typecheck, unit tests, production build, dependency audit, and Vercel preview all pass with the overrides in place.

Do not use a force audit fix on production dependencies without reviewing the resulting major-version changes.

## Build Warnings / Follow-Up

The successful CI production build emitted two non-blocking warnings that should be tracked separately:

- Supabase's client package references a Node API through the middleware import trace while Next.js compiles middleware for the Edge runtime.
- CI does not provide `NEXT_PUBLIC_SUPABASE_URL`, so public contact-email lookup logs a configuration warning during static generation; the build still completes.

These warnings are not being silently changed in the security-patch PR because they should be reviewed with the actual Vercel environment configuration.

## Deployment Visibility

GitHub's Vercel integration can build a Bridget Pope Designs preview and has successfully built the patched Next.js branch. The connected Vercel API still returns 404 for the Bridget project, so production environment variables, runtime logs, domain configuration, and Vercel security settings remain unavailable through the connector. Production-level audit remains incomplete until that project is exposed to the connected Vercel account/API.