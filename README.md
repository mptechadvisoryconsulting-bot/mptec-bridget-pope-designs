# Bridget Pope Designs

Luxury event design website, client portal, and admin CRM built with Next.js 15, React, TypeScript, Tailwind CSS, Supabase, and Resend.

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
- The admin and client dashboards read the same project, invoice, message, file, and notification records.
- Invoice PDFs can be generated and emailed to clients. Payments are recorded manually in the admin CRM (offline billing).
