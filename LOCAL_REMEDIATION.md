# Local Remediation Notes

Operational notes for verifying this repo locally and gating the payment-ledger release. Keep
this file up to date whenever the migration order, env gating, or verification commands change.

## Expected local verification commands

Run these from the repo root after making changes:

```bash
npm install
npm run typecheck   # tsc --noEmit
npm test            # vitest run
npm run test:e2e    # playwright test (requires E2E_* credentials, see .env.example)
```

All four should pass before considering local changes verified. `npm run typecheck` and `npm test`
are the minimum bar for any change; `npm run test:e2e` additionally requires a reachable
Supabase project and Playwright browsers installed (`npx playwright install`).

## Local Supabase requires Docker Desktop

`npx supabase start` runs the local Supabase stack (Postgres, Auth, Storage, Studio) inside Docker
containers. **Docker Desktop must be running before you run `npx supabase start`.** If Docker is
not running, the command fails to create containers and local development against Supabase will
not work. Start Docker Desktop first, confirm it is healthy, then run:

```bash
npx supabase start
```

## Production must NOT enable payment creation ahead of the release gate

`PAYMENT_CREATION_ENABLED` gates whether the app will create real Stripe Checkout Sessions /
PaymentIntents in production. **Production must NOT set `PAYMENT_CREATION_ENABLED=true` until the
release gate is explicitly signed off** (payment ledger migrations applied and verified, Stripe
Connect account fully onboarded, E2E payment specs green with `E2E_RELEASE_GATE=true`). Until
then, it must remain `false` in the Vercel production environment. See `.env.example` for the
full list of required production payment envs (`PAYMENT_CREATION_ENABLED`,
`PLATFORM_FEE_BASIS_POINTS=100`, `REFUND_PLATFORM_FEE_POLICY=retain`).

## Migration order

Apply migrations strictly in numeric order — later migrations alter columns/constraints that
earlier ones create:

```
0001 → 0002 → 0003 → 0004 → 0005 → 0006 → 0007 → 0008
```

The payment ledger specifically depends on this chain from `0005` onward:

- **0005** (`owner_readiness_payment_ledger.sql`) — creates `bpd_payment_attempts`, adds owner
  email/payment readiness columns to `bpd_business_settings`.
- **0006** (`payment_setup_resilience.sql`) — adds Stripe Connect provisioning status tracking
  columns/constraints to `bpd_business_settings`.
- **0007** (`payment_model_versioning.sql`) — adds `payment_model` / `stripe_account_context`
  columns to both `bpd_payment_attempts` and `bpd_payments`, backfilling existing rows.
- **0008** (`invoice_template_asset_storage.sql`) — adds the invoice template asset storage
  bucket.

Never apply `0006`/`0007`/`0008` without `0005` already applied — they alter tables and columns
that `0005` creates.

## Do NOT invent `bpd_payment_attempts` manually

`bpd_payment_attempts` is a real ledger table created by migration `0005`. Do not create it (or
any of its columns/constraints) by hand in the Supabase SQL editor, via `execute_sql`, or by
guessing its shape — always apply it through the migration file so the schema, constraints, and
backfills stay in sync with what the application code expects. If the table appears to be
missing or malformed locally, re-run the migrations in order rather than patching the table
directly.
