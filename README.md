# Bridget Pope Designs

Luxury event design website, client portal, and owner CRM built with Next.js 15, React, TypeScript, Tailwind CSS, Supabase, and Resend.

## Local Development

```bash
npm install
npm run dev
```

Primary routes:

- `/` public marketing landing page
- `/admin` admin CRM dashboard
- `/client/dashboard` client portal

## Production Integrations

- Supabase stores the shared business records once, using `bpd_*` tables and row-level-security policies.
- The landing page writes inquiries to leads and creates admin notifications.
- Approved leads become client-specific projects, conversations, design updates, files, milestones, notifications, proposals, contracts, and invoices.
- Internal offline billing is the source of truth: generate or upload invoice PDFs, send proposals/contracts, and record manual payments in the CRM.
- Card checkout is not enabled; payments are collected offline and recorded against invoices.
- Resend handles inquiry, client invitation, project message, design update, and notification email delivery when configured.
