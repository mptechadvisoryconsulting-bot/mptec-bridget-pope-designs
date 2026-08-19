# Bridget Pope Designs

Luxury event design website, client portal, and owner CRM built with Next.js 15, React, TypeScript, Tailwind CSS, Supabase, and Resend.

## Local Development

This repository declares pnpm in `package.json`. Use pnpm consistently so local installs and CI resolve the same dependency graph.

```bash
pnpm install
pnpm dev
```

Primary routes:

- `/` public marketing landing page
- `/admin` admin CRM dashboard
- `/client/dashboard` client portal

## Validation

Before merging production-impacting changes, run:

```bash
pnpm install --frozen-lockfile
pnpm audit
pnpm typecheck
pnpm test
pnpm build
pnpm exec playwright test tests/e2e/production-audit-smoke.spec.ts
```

## Production Integrations

- Supabase stores the shared business records once, using `bpd_*` tables and row-level-security policies.
- The landing page writes inquiries to leads and creates admin notifications.
- Approved leads become client-specific projects, conversations, design updates, files, milestones, notifications, proposals, contracts, and invoices.
- Internal offline billing is the source of truth: generate or upload invoice PDFs, send proposals/contracts, and record manual payments in the CRM.
- Card checkout is not enabled; payments are collected offline and recorded against invoices.
- Resend handles inquiry, client invitation, project message, design update, and notification email delivery when configured.

## E2E / test data cleanup

- **Read-only production smoke:** `pnpm exec playwright test tests/e2e/production-audit-smoke.spec.ts` (logs in and navigates; does not write CRM data).
- **Destructive suites** (`production-full-flow`, `production-audit-followup`, `owner-client-session`) require `E2E_ALLOW_DESTRUCTIVE=true`. They should clean up when `SUPABASE_SERVICE_ROLE_KEY` is set; otherwise residue may remain.
- **Manual cleanup:** In Admin, use **Delete** on a lead/client/project (owner confirmation dialog — type the name or `DELETE`). Prefer this over any bulk SQL delete of production CRM rows.
- Do not mass-delete production clients automatically. Test emails use the `e2e.*@bridget-pope-designs.us` pattern so they are easy to spot.
