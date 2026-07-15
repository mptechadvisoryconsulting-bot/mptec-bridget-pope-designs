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
- Approved leads become client-specific projects, conversations, design updates, files, milestones, notifications, and HoneyBook financial references.
- HoneyBook is the source of truth for proposals, contracts, invoices, payment plans, payment collection, receipts, and financial transaction handling.
- The custom app displays HoneyBook reference details by project; it does not process card payments or maintain a competing invoice engine.
- Resend handles inquiry, client invitation, project message, design update, and notification email delivery when configured.
