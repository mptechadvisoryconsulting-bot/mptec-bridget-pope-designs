# Bridget Pope Designs

Luxury event design website, client portal, and admin CRM built with Next.js 15, React, TypeScript, Tailwind CSS, Supabase, Resend, and Stripe.

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
- Stripe Checkout is created fresh per invoice payment. Stored Payment Link URLs are disabled.
- Stripe Connect uses destination charges for this single-owner deployment: the platform creates Checkout Sessions and transfers charge proceeds to the Bridget Pope Designs connected Stripe account. Checkout is blocked until both `charges_enabled` and `payouts_enabled` are true.
- Stripe webhooks claim events by inserting the event ID first, then reconcile paid, failed, refunded, disputed, payout, and account-status events.
